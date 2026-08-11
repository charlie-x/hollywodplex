/*
 * lib.js — shared helpers for the fix-unmatched pipeline.
 * state is checkpointed to data/fix-unmatched.json so every stage
 * (scan, judge, apply) is resumable.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const BASE = 'http://localhost:3478';
export const STATE_FILE = resolve(__dirname, '..', '..', 'data', 'fix-unmatched.json');
export const REPORT_FILE = resolve(__dirname, '..', '..', 'notes', 'summary', 'unmatched-fix-report.md');

export async function api(path, opts = {}) {
  const res = await fetch(BASE + path, opts);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

export function loadState() {
  if (!existsSync(STATE_FILE)) return { items: [] };
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

export function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/*
 * best-effort search query from a filename-style title — same logic as
 * the in-store fix-match panel: prefer the part after "aka", drop a
 * trailing year and anything after it.
 */
export function guessTitle(title) {
  let t = title || '';
  const aka = / aka /i.exec(t);
  if (aka) t = t.slice(aka.index + aka[0].length);
  t = t.replace(/\b(19|20)\d{2}\b.*$/, '').trim();
  return t || title;
}
