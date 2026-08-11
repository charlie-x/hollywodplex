/*
 * image-disk-cache.js — persistent artwork cache on local disk.
 * plex artwork urls carry a version timestamp, so entries keyed by url
 * never go stale; no ttl and, by design, no size cap. survives restarts.
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = resolve(__dirname, '..', '..', 'data', 'image-cache');

const EXT_BY_TYPE = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
  'image/tiff': '.tif',
};
const TYPE_BY_EXT = Object.fromEntries(
  Object.entries(EXT_BY_TYPE).map(([t, e]) => [e, t]),
);

let dirReady = false;
async function ensureDir() {
  if (!dirReady) {
    await mkdir(CACHE_DIR, { recursive: true });
    dirReady = true;
  }
}

function hashKey(key) {
  return createHash('sha1').update(key).digest('hex');
}

/*
 * look up a cached image. returns { buffer, contentType } or null.
 * the content type is recovered from the file extension, so no
 * sidecar metadata is needed.
 */
export async function getCachedImage(key) {
  const base = hashKey(key);
  for (const ext of Object.keys(TYPE_BY_EXT)) {
    try {
      const buffer = await readFile(resolve(CACHE_DIR, base + ext));
      return { buffer, contentType: TYPE_BY_EXT[ext] };
    } catch {
      // try the next extension
    }
  }
  return null;
}

/*
 * persist an image. best-effort: a failed write only costs a refetch.
 */
export async function putCachedImage(key, buffer, contentType) {
  try {
    await ensureDir();
    const ext = EXT_BY_TYPE[contentType] || '.jpg';
    await writeFile(resolve(CACHE_DIR, hashKey(key) + ext), buffer);
  } catch (err) {
    console.warn('[image-cache] disk write failed:', err.message);
  }
}
