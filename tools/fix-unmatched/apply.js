/*
 * apply.js — stage 3 of the fix-unmatched pipeline.
 * applies the judged matches through the app's api (which invalidates
 * the server metadata cache per item) and writes a report of what was
 * matched and what still needs the in-store fix match button.
 *   node tools/fix-unmatched/apply.js
 */

import { writeFileSync } from 'node:fs';
import { api, loadState, saveState, REPORT_FILE } from './lib.js';

const state = loadState();
const toApply = state.items.filter(i => i.verdict && !i.applied);
console.log(`${toApply.length} matches to apply`);

let done = 0;
for (const item of toApply) {
  const params = new URLSearchParams({ guid: item.verdict.guid, name: item.verdict.name });
  try {
    await api(`/api/plex/matches/${item.ratingKey}?${params}`, { method: 'POST' });
    item.applied = true;
    saveState(state);
    done++;
    if (done % 20 === 0) console.log(`  ${done}/${toApply.length}`);
  } catch (err) {
    console.log(`  ${item.ratingKey} "${item.title}" failed: ${err.message}`);
  }
}

// report
const applied = state.items.filter(i => i.applied);
const abstained = state.items.filter(i => i.verdict === null);
const noCandidates = state.items.filter(i => i.candidates && i.candidates.length === 0 && i.verdict === null);
const failed = state.items.filter(i => i.verdict && !i.applied);

let md = '# unmatched films — fix report\n\n';
md += 'matches were chosen by claude from plex agent candidates and applied\n';
md += 'via the api. abstained items need the in-store fix match button (the\n';
md += 'filename was too vague or no candidate fit).\n\n';
md += `applied: ${applied.length}, abstained: ${abstained.length}`;
md += ` (of which ${noCandidates.length} had no candidates at all), failed: ${failed.length}\n\n`;

md += `## applied (${applied.length})\n\n`;
for (const i of applied) {
  md += `- ${i.ratingKey}  ${i.title}  ->  ${i.verdict.name}${i.verdict.year ? ` (${i.verdict.year})` : ''}\n`;
}
md += `\n## abstained — fix manually in store (${abstained.length})\n\n`;
for (const i of abstained) {
  md += `- ${i.ratingKey}  [${i.section}] ${i.title}${i.candidates.length === 0 ? '  (no candidates)' : ''}\n`;
}
if (failed.length) {
  md += `\n## failed to apply (${failed.length})\n\n`;
  for (const i of failed) md += `- ${i.ratingKey}  ${i.title}\n`;
}

writeFileSync(REPORT_FILE, md);
console.log(`applied ${done}, report written to notes/summary/unmatched-fix-report.md`);
