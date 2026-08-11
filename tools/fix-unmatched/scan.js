/*
 * scan.js — stage 1 of the fix-unmatched pipeline.
 * sweeps the library for items plex never matched (guid local://) and
 * gathers agent match candidates for each via the app's api. resumable:
 * items that already have candidates are skipped, and state is saved
 * after every item. run with an optional item limit per invocation:
 *   node tools/fix-unmatched/scan.js [limit]
 */

import { api, loadState, saveState, guessTitle } from './lib.js';

const limit = parseInt(process.argv[2], 10) || 150;
const state = loadState();

// first run: build the item list from a full library sweep
if (state.items.length === 0) {
  const cfg = await api('/api/config');
  for (const s of cfg.sections) {
    let start = 0, total = 1;
    while (start < total) {
      const d = await api(`/api/plex/sections/${s.key}/items?start=${start}&size=200`);
      total = d.totalSize;
      for (const it of d.items) {
        if (typeof it.guid === 'string' && it.guid.startsWith('local://')) {
          state.items.push({
            ratingKey: it.ratingKey,
            section: s.title,
            title: it.title,
            year: it.year || null,
          });
        }
      }
      start += 200;
    }
  }
  saveState(state);
  console.log(`sweep found ${state.items.length} unmatched items`);
}

// gather candidates for items that do not have them yet
const pending = state.items.filter(i => !i.candidates);
console.log(`${pending.length} items still need candidates, doing up to ${limit}`);

let done = 0;
for (const item of pending.slice(0, limit)) {
  const guess = guessTitle(item.title);
  const params = new URLSearchParams({ title: guess });
  if (item.year) params.set('year', item.year);

  let matches = [];
  try {
    ({ matches } = await api(`/api/plex/matches/${item.ratingKey}?${params}`));
    // a year filter can suppress results when the filename year is wrong
    if (matches.length === 0 && item.year) {
      ({ matches } = await api(`/api/plex/matches/${item.ratingKey}?${new URLSearchParams({ title: guess })}`));
    }
  } catch (err) {
    console.log(`  ${item.ratingKey} search failed: ${err.message}`);
    continue; // left without candidates, retried next run
  }

  item.guess = guess;
  item.candidates = matches.slice(0, 8).map(m => ({ guid: m.guid, name: m.name, year: m.year }));
  saveState(state);
  done++;
  if (done % 20 === 0) console.log(`  ${done}/${Math.min(limit, pending.length)}`);
}

const remaining = state.items.filter(i => !i.candidates).length;
console.log(`candidates gathered for ${done} items, ${remaining} remaining`);
