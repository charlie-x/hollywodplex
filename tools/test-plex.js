/*
 * test-plex.js — verify connectivity to the plex server and list libraries.
 * run with: node tools/test-plex.js
 * relies on .env for PLEX_SERVER_URL and PLEX_TOKEN.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// crude .env parser — avoids adding a dependency for a test script
function loadEnv() {
  const path = resolve(root, '.env');
  let content;
  try {
    content = readFileSync(path, 'utf-8');
  } catch {
    console.error('missing .env file. copy .env.example to .env and fill in your values.');
    process.exit(1);
  }
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return vars;
}

const env = loadEnv();
const { PLEX_SERVER_URL, PLEX_TOKEN } = env;

if (!PLEX_SERVER_URL || !PLEX_TOKEN || PLEX_TOKEN === 'your-plex-token-here') {
  console.error('set PLEX_SERVER_URL and PLEX_TOKEN in .env');
  process.exit(1);
}

async function main() {
  console.log(`testing connection to ${PLEX_SERVER_URL}...\n`);

  try {
    const res = await fetch(`${PLEX_SERVER_URL}/library/sections`, {
      headers: {
        'X-Plex-Token': PLEX_TOKEN,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      console.error(`plex returned status ${res.status}`);
      const body = await res.text();
      console.error(body.slice(0, 500));
      process.exit(1);
    }

    const data = await res.json();
    const sections = data.MediaContainer?.Directory;

    if (!sections || sections.length === 0) {
      console.log('connected, but no libraries found.');
      return;
    }

    console.log(`found ${sections.length} librar${sections.length === 1 ? 'y' : 'ies'}:\n`);

    for (const s of sections) {
      console.log(`  [${s.key}] ${s.title} (${s.type}) — ${s.refreshedAt ? 'refreshed' : 'available'}`);

      // fetch item count
      try {
        const countRes = await fetch(`${PLEX_SERVER_URL}/library/sections/${s.key}/all?X-Plex-Container-Start=0&X-Plex-Container-Size=0`, {
          headers: { 'X-Plex-Token': PLEX_TOKEN, 'Accept': 'application/json' },
        });
        if (countRes.ok) {
          const countData = await countRes.json();
          const total = countData.MediaContainer?.totalSize ?? '?';
          console.log(`      ${total} items`);
        }
      } catch {
        // skip count on failure
      }
    }

    console.log('\nplex connection verified successfully.');
  } catch (err) {
    console.error(`connection failed: ${err.message}`);
    process.exit(1);
  }
}

main();
