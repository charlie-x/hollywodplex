/*
 * llm-client.js — one interface over the configured llm backend.
 * anthropic (claude) when ANTHROPIC_API_KEY is set, a local ollama
 * server when OLLAMA_URL is set, or any openai-compatible server
 * (vllm, llama.cpp, lm studio, ...) when OPENAI_BASE_URL is set.
 * all return schema-shaped json. set LLM_PROVIDER=anthropic|ollama|
 * openai to force a choice when several are configured.
 */

import 'dotenv/config';
import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';

/*
 * which backend is active, or null when none is configured.
 */
export function llmProvider() {
  const forced = process.env.LLM_PROVIDER;
  if (forced === 'anthropic' || forced === 'ollama' || forced === 'openai') return forced;
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.OLLAMA_URL) return 'ollama';
  if (process.env.OPENAI_BASE_URL) return 'openai';
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
  if (provider === 'openai') {
    return `openai-compatible ${process.env.OPENAI_MODEL || '(first served model)'} at ${process.env.OPENAI_BASE_URL}`;
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
  if (provider === 'openai') return askOpenAI(system, prompt, schema, maxTokens);
  throw new Error('no llm configured: set ANTHROPIC_API_KEY, OLLAMA_URL or OPENAI_BASE_URL in .env');
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

/*
 * openai-compatible chat completions (vllm, llama.cpp server,
 * lm studio, or openai itself). the base url may be given with or
 * without the /v1 suffix.
 */
function openaiBase() {
  const raw = process.env.OPENAI_BASE_URL.replace(/\/+$/, '');
  return raw.endsWith('/v1') ? raw : `${raw}/v1`;
}

function openaiHeaders() {
  return {
    'content-type': 'application/json',
    ...(process.env.OPENAI_API_KEY
      ? { authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
      : {}),
  };
}

/*
 * model to ask for: OPENAI_MODEL when set, otherwise the first model
 * the server lists — self-hosted servers usually serve exactly one.
 */
let openaiModelPromise = null;
function resolveOpenaiModel() {
  if (process.env.OPENAI_MODEL) return Promise.resolve(process.env.OPENAI_MODEL);
  if (!openaiModelPromise) {
    openaiModelPromise = (async () => {
      const res = await fetch(`${openaiBase()}/models`, { headers: openaiHeaders() });
      if (!res.ok) {
        throw new Error(`could not list models (${res.status}) — set OPENAI_MODEL in .env`);
      }
      const data = await res.json();
      const ids = (data.data || []).map(m => m.id).filter(Boolean);
      // servers often host embedding models alongside the chat model —
      // prefer the first id that doesn't look like one
      const id = ids.find(i => !/embed/i.test(i)) || ids[0];
      if (!id) throw new Error('server lists no models — set OPENAI_MODEL in .env');
      console.log(`[llm] openai-compatible server model: ${id}`);
      return id;
    })();
    // a failed lookup should not poison every later request
    openaiModelPromise.catch(() => { openaiModelPromise = null; });
  }
  return openaiModelPromise;
}

/*
 * structured-output support varies wildly between openai-compatible
 * servers, so requests walk down a ladder until one mode is accepted:
 * strict json_schema, then json_object, then plain text with the
 * schema inlined in the system prompt. the working mode is remembered
 * for the rest of the process.
 */
const OPENAI_MODES = ['json_schema', 'json_object', 'plain'];
let openaiModeIdx = 0;

/*
 * scan json tracking string/escape state; returns the bracket stack
 * still open at the end and the index just past the last value that
 * closed completely.
 */
function scanJson(text) {
  let inString = false;
  let escaped = false;
  const open = [];
  let lastClosed = -1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{' || c === '[') open.push(c);
    else if (c === '}' || c === ']') {
      open.pop();
      lastClosed = i + 1;
    }
  }
  return { open, lastClosed };
}

/*
 * best-effort repair of json cut off mid-generation (a local model
 * hitting its token budget): trim back to the last complete element
 * and close whatever is still open. shelves come out shorter instead
 * of not at all.
 */
function repairTruncatedJson(text) {
  const { lastClosed } = scanJson(text);
  if (lastClosed <= 0) throw new Error('unrepairable json');

  // cut just past the last complete element (this also drops any
  // trailing chatter after balanced json), then close what's open
  let out = text.slice(0, lastClosed);
  const remaining = scanJson(out).open;
  for (let i = remaining.length - 1; i >= 0; i--) {
    out += remaining[i] === '{' ? '}' : ']';
  }
  return JSON.parse(out);
}

function parseLenientJson(text) {
  try {
    return JSON.parse(text);
  } catch { /* try harder below */ }

  // tolerate markdown fences or chatter around the json
  const match = text.match(/[{[][\s\S]*/);
  if (!match) throw new Error('response was not valid json');
  const candidate = match[0].replace(/\s*```\s*$/, '');
  try {
    return JSON.parse(candidate);
  } catch {
    const repaired = repairTruncatedJson(candidate);
    console.warn('[llm] response was truncated mid-json — repaired to the last complete element');
    return repaired;
  }
}

async function askOpenAI(system, prompt, schema, maxTokens) {
  const model = await resolveOpenaiModel();
  // reasoning models spend hidden tokens from the same budget the
  // json answer needs; OPENAI_MAX_TOKENS grants extra headroom
  const budget = Math.max(maxTokens, parseInt(process.env.OPENAI_MAX_TOKENS, 10) || 0);

  // non-streaming on purpose: servers that separate hidden reasoning
  // from the answer only do so reliably in complete responses (some
  // leak reasoning into streamed content deltas). axios with no
  // timeout tolerates the long wait local hardware needs.
  const request = (mode) => axios.post(`${openaiBase()}/chat/completions`, {
    model,
    max_tokens: budget,
    messages: [
      {
        role: 'system',
        content: mode === 'json_schema'
          ? system
          : `${system}\n\nrespond with a single json value matching this json schema exactly, and nothing else. `
            + `keep any hidden reasoning brief:\n${JSON.stringify(schema)}`,
      },
      { role: 'user', content: prompt },
    ],
    ...(mode === 'json_schema'
      ? { response_format: { type: 'json_schema', json_schema: { name: 'result', strict: true, schema } } }
      : mode === 'json_object'
        ? { response_format: { type: 'json_object' } }
        : {}),
    // 'plain' sends no response_format — the schema rides in the
    // system prompt and the reply is parsed leniently
  }, {
    headers: openaiHeaders(),
    timeout: 0,
    validateStatus: () => true,
  });

  let res = await request(OPENAI_MODES[openaiModeIdx]);
  while (res.status === 400 && openaiModeIdx < OPENAI_MODES.length - 1) {
    openaiModeIdx++;
    console.warn(`[llm] server rejected ${OPENAI_MODES[openaiModeIdx - 1]} output, trying ${OPENAI_MODES[openaiModeIdx]} mode`);
    res = await request(OPENAI_MODES[openaiModeIdx]);
  }

  if (res.status < 200 || res.status >= 300) {
    const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    throw new Error(`openai-compatible server returned ${res.status}: ${body.slice(0, 200)}`);
  }

  const choice = res.data.choices?.[0];
  const content = choice?.message?.content;
  const finishReason = choice?.finish_reason || null;
  if (finishReason === 'length') {
    const used = res.data.usage?.completion_tokens;
    if (used && used < budget * 0.9) {
      // the server clamped the request below what we asked for —
      // raising the client budget cannot help
      console.warn(`[llm] generation stopped at ${used} tokens despite a ${budget}-token budget — `
        + 'the server capped it; raise the server\'s context length');
    } else {
      console.warn('[llm] generation hit the token budget — raise OPENAI_MAX_TOKENS in .env if shelves come out short');
    }
  }
  if (!content) {
    throw new Error(choice?.message?.reasoning_content
      ? 'model spent its whole token budget reasoning — raise OPENAI_MAX_TOKENS in .env'
      : 'no content in response');
  }
  try {
    return parseLenientJson(content);
  } catch (err) {
    console.warn(`[llm] unparseable response (finish: ${finishReason}), first 200 chars: ${content.slice(0, 200)}`);
    throw err;
  }
}
