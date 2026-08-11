/*
 * image-loader.js — texture loading queue with lru cache and concurrency control.
 * downscales images before gpu upload and coordinates eviction with the
 * shelves so cases revert to placeholder when their texture is dropped.
 */

import * as THREE from 'three';
import { LRUCache } from '../utils/cache.js';

const MAX_CACHED = 350;
const MAX_CONCURRENT = 4;
// safety cap only — the server now delivers correctly sized variants,
// so this should never trigger in normal operation
const MAX_TEXTURE_DIM = 1024;

export class ImageLoader {
  #cache;
  #inflight = new Map();
  #queue = new Map(); // url -> { priority, resolvers: [{resolve, reject}] }
  #active = 0;
  #stats = { hits: 0, misses: 0, loads: 0 };
  #placeholders;

  // set by the shelves so evicted textures revert their case to placeholder
  onEvict = null;

  constructor(maxCached = MAX_CACHED, maxConcurrent = MAX_CONCURRENT) {
    this.maxConcurrent = maxConcurrent;
    this.#cache = new LRUCache(maxCached, (url, texture) => {
      if (this.onEvict) this.onEvict(url);
      if (texture) texture.dispose();
    });
  }

  /*
   * load a texture. priority orders the pending queue (lower = sooner,
   * pass the case's distance) so what's in front of the player always
   * downloads before things queued for somewhere they've moved past.
   */
  async loadTexture(url, priority = 0) {
    if (!url) return this.#placeholderTexture('#1a1a2e');

    const cached = this.#cache.get(url);
    if (cached) {
      this.#stats.hits++;
      return cached;
    }

    if (this.#inflight.has(url)) {
      return this.#inflight.get(url);
    }

    this.#stats.misses++;

    if (this.#active >= this.maxConcurrent) {
      return new Promise((resolve, reject) => {
        const entry = this.#queue.get(url);
        if (entry) {
          entry.priority = Math.min(entry.priority, priority);
          entry.resolvers.push({ resolve, reject });
        } else {
          this.#queue.set(url, { priority, resolvers: [{ resolve, reject }] });
        }
      });
    }

    return this.#startLoad(url);
  }

  /*
   * cancel a request that is still queued (in-flight downloads finish
   * regardless — they're nearly free to complete and they warm the
   * cache). resolves the waiter(s) with null so callers can reset.
   */
  cancel(url) {
    const entry = this.#queue.get(url);
    if (!entry) return false;
    this.#queue.delete(url);
    for (const { resolve } of entry.resolvers) resolve(null);
    return true;
  }

  async #startLoad(url) {
    this.#active++;
    const promise = this.#fetchAndCreateTexture(url);
    this.#inflight.set(url, promise);

    try {
      const texture = await promise;
      this.#cache.set(url, texture);
      this.#stats.loads++;
      return texture;
    } catch (err) {
      console.warn(`[image-loader] failed to load texture: ${url}`, err.message);
      return this.#placeholderTexture('#1a1a2e');
    } finally {
      this.#inflight.delete(url);
      this.#active--;
      this.#processQueue();
    }
  }

  #processQueue() {
    while (this.#active < this.maxConcurrent && this.#queue.size > 0) {
      // pick the lowest-priority (nearest) pending url
      let bestUrl = null;
      let bestPriority = Infinity;
      for (const [url, entry] of this.#queue) {
        if (entry.priority < bestPriority) {
          bestPriority = entry.priority;
          bestUrl = url;
        }
      }
      const entry = this.#queue.get(bestUrl);
      this.#queue.delete(bestUrl);

      // a queued url may have been cached by an earlier duplicate request
      const cached = this.#cache.get(bestUrl);
      if (cached) {
        for (const { resolve } of entry.resolvers) resolve(cached);
        continue;
      }
      const p = this.#startLoad(bestUrl);
      for (const { resolve, reject } of entry.resolvers) p.then(resolve, reject);
    }
  }

  async #fetchAndCreateTexture(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        // downscale before upload — full-size posters waste gpu memory
        let source = img;
        const maxDim = Math.max(img.width, img.height);
        if (maxDim > MAX_TEXTURE_DIM) {
          const ratio = MAX_TEXTURE_DIM / maxDim;
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * ratio));
          canvas.height = Math.max(1, Math.round(img.height * ratio));
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          source = canvas;
        }

        const texture = new THREE.Texture(source);
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;

        resolve(texture);
      };

      img.onerror = () => reject(new Error(`failed to load image: ${url}`));
      img.src = url;
    });
  }

  #placeholderTexture(colour) {
    if (!this.#placeholders) this.#placeholders = new Map();
    if (this.#placeholders.has(colour)) return this.#placeholders.get(colour);

    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 3;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, 2, 3);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    this.#placeholders.set(colour, texture);
    return texture;
  }

  disposeTexture(url) {
    const texture = this.#cache.delete(url);
    if (texture) texture.dispose();
  }

  disposeAll() {
    this.#cache.clear();
    this.#inflight.clear();
    this.#queue.length = 0;
    this.#active = 0;
  }

  getCacheStats() {
    return {
      size: this.#cache.size,
      hits: this.#stats.hits,
      misses: this.#stats.misses,
      loads: this.#stats.loads,
    };
  }
}
