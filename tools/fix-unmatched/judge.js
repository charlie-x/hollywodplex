/*
 * judge.js — stage 2 of the fix-unmatched pipeline.
 * asks claude to pick the correct match candidate for each filename-style
 * title, abstaining when unsure. the model bridges translated and
 * alternate titles (e.g. offret = the sacrifice) that string matching
 * cannot. resumable: items with a verdict are skipped.
 *   node tools/fix-unmatched/judge.js [batches]
 */

import 'dotenv/config';
import { generateStructured, llmAvailable, llmDescription } from '../../server/services/llm-client.js';
import { loadState, saveState } from './lib.js';

const BATCH_SIZE = 40;
const maxBatches = parseInt(process.argv[2], 10) || 10;

const state = loadState();
const pending = state.items.filter(i => i.candidates && i.verdict === undefined);
if (!llmAvailable()) {
  console.error('no llm configured: set ANTHROPIC_API_KEY, OLLAMA_URL or OPENAI_BASE_URL in .env');
  process.exit(1);
}
console.log(`judging with ${llmDescription()}`);
console.log(`${pending.length} judged items pending, doing up to ${maxBatches} batches of ${BATCH_SIZE}`);

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

  const result = await generateStructured({
    maxTokens: 8000,
    schema,
    system: 'you match messy video filenames to the correct film. filenames often '
      + 'embed director names, actor names, "aka" alternate titles, release years, '
      + 'or original-language titles. use your film knowledge to bridge translated '
      + 'and alternate titles. pick a candidate only when you are confident it is '
      + 'the same film (year within a year or two when both are present). if the '
      + 'filename is too vague, names only a director, looks like a disc part, or '
      + 'no candidate fits, abstain with -1. one pick per input line, ratingKeys '
      + 'exactly as given.',
    prompt: lines,
  });
  return result.picks;
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
