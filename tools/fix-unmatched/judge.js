/*
 * judge.js — stage 2 of the fix-unmatched pipeline.
 * asks claude to pick the correct match candidate for each filename-style
 * title, abstaining when unsure. the model bridges translated and
 * alternate titles (e.g. offret = the sacrifice) that string matching
 * cannot. resumable: items with a verdict are skipped.
 *   node tools/fix-unmatched/judge.js [batches]
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { loadState, saveState } from './lib.js';

const BATCH_SIZE = 40;
const maxBatches = parseInt(process.argv[2], 10) || 10;

const state = loadState();
const pending = state.items.filter(i => i.candidates && i.verdict === undefined);
console.log(`${pending.length} judged items pending, doing up to ${maxBatches} batches of ${BATCH_SIZE}`);

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const schema = {
  type: 'object',
  properties: {
    picks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ratingKey: { type: 'string' },
          // index into the candidate list, or -1 to abstain
          choice: { type: 'integer' },
        },
        required: ['ratingKey', 'choice'],
        additionalProperties: false,
      },
    },
  },
  required: ['picks'],
  additionalProperties: false,
};

async function judgeBatch(items) {
  const lines = items.map(i => {
    const cands = i.candidates.length
      ? i.candidates.map((c, n) => `${n}. ${c.name}${c.year ? ` (${c.year})` : ''}`).join(' | ')
      : 'none';
    return `${i.ratingKey} :: file title: "${i.title}"${i.year ? ` (file year ${i.year})` : ''} :: candidates: ${cands}`;
  }).join('\n');

  const stream = client.messages.stream({
    model: 'claude-opus-5',
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    system: 'you match messy video filenames to the correct film. filenames often '
      + 'embed director names, actor names, "aka" alternate titles, release years, '
      + 'or original-language titles. use your film knowledge to bridge translated '
      + 'and alternate titles. pick a candidate only when you are confident it is '
      + 'the same film (year within a year or two when both are present). if the '
      + 'filename is too vague, names only a director, looks like a disc part, or '
      + 'no candidate fits, abstain with -1. one pick per input line, ratingKeys '
      + 'exactly as given.',
    output_config: { format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: lines }],
  });

  const response = await stream.finalMessage();
  if (response.stop_reason === 'refusal') throw new Error('model declined the batch');
  const text = response.content.find(b => b.type === 'text')?.text;
  return JSON.parse(text).picks;
}

for (let b = 0; b < maxBatches; b++) {
  const batch = state.items.filter(i => i.candidates && i.verdict === undefined).slice(0, BATCH_SIZE);
  if (batch.length === 0) break;

  const picks = await judgeBatch(batch);
  const byKey = new Map(picks.map(p => [p.ratingKey, p.choice]));

  for (const item of batch) {
    const choice = byKey.get(item.ratingKey);
    const cand = choice != null && choice >= 0 ? item.candidates[choice] : null;
    item.verdict = cand ? { guid: cand.guid, name: cand.name, year: cand.year } : null;
  }
  saveState(state);
  const picked = batch.filter(i => i.verdict).length;
  console.log(`batch ${b + 1}: ${picked}/${batch.length} picked`);
}

const remaining = state.items.filter(i => i.candidates && i.verdict === undefined).length;
console.log(`judging done for now, ${remaining} items remaining`);
