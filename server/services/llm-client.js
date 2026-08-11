/*
 * llm-client.js — one interface over the configured llm backend.
 * anthropic (claude) when ANTHROPIC_API_KEY is set, or a local ollama
 * server when OLLAMA_URL is set. both return schema-shaped json.
 * set LLM_PROVIDER=anthropic|ollama to force a choice when both exist.
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';

/*
 * which backend is active, or null when none is configured.
 */
export function llmProvider() {
  const forced = process.env.LLM_PROVIDER;
  if (forced === 'anthropic' || forced === 'ollama') return forced;
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.OLLAMA_URL) return 'ollama';
  return null;
}

export function llmAvailable() {
  return llmProvider() !== null;
}

export function llmDescription() {
  const provider = llmProvider();
  if (provider === 'anthropic') return `anthropic ${ANTHROPIC_MODEL}`;
  if (provider === 'ollama') {
    return `ollama ${process.env.OLLAMA_MODEL || 'llama3.1:8b'} at ${process.env.OLLAMA_URL}`;
  }
  return 'none';
}

/*
 * ask the configured backend for json matching the given schema.
 * { system, prompt, schema, maxTokens } -> parsed object.
 */
export async function generateStructured({ system, prompt, schema, maxTokens = 8000 }) {
  const provider = llmProvider();
  if (provider === 'anthropic') return askAnthropic(system, prompt, schema, maxTokens);
  if (provider === 'ollama') return askOllama(system, prompt, schema, maxTokens);
  throw new Error('no llm configured: set ANTHROPIC_API_KEY or OLLAMA_URL in .env');
}

async function askAnthropic(system, prompt, schema, maxTokens) {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

  const stream = client.messages.stream({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    system,
    output_config: { format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: prompt }],
  });

  const response = await stream.finalMessage();
  if (response.stop_reason === 'refusal') throw new Error('model declined the request');
  const text = response.content.find(b => b.type === 'text')?.text;
  if (!text) throw new Error('no text in response');
  return JSON.parse(text);
}

async function askOllama(system, prompt, schema, maxTokens) {
  const base = process.env.OLLAMA_URL.replace(/\/+$/, '');
  const model = process.env.OLLAMA_MODEL || 'llama3.1:8b';

  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      // ollama structured outputs: the response is constrained to this schema
      format: schema,
      options: {
        num_predict: maxTokens,
        // long prompts (the full catalogue) need a big context window;
        // the model must actually support this size
        num_ctx: parseInt(process.env.OLLAMA_NUM_CTX, 10) || 32768,
      },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ollama returned ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.message?.content;
  if (!text) throw new Error('no content in ollama response');
  return JSON.parse(text);
}
