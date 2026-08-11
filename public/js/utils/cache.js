/*
 * cache.js — generic lru (least-recently-used) cache with eviction callback.
 * used by the image loader to bound gpu texture memory.
 */

export class LRUCache {
  #map = new Map();
  #maxSize;
  #onEvict;

  /*
   * create an lru cache.
   * maxSize — maximum number of entries before eviction begins.
   * onEvict — optional callback(key, value) called when an entry is evicted.
   */
  constructor(maxSize = 100, onEvict = null) {
    this.#maxSize = maxSize;
    this.#onEvict = onEvict;
  }

  get(key) {
    if (!this.#map.has(key)) return undefined;
    // move to end (most recently used)
    const value = this.#map.get(key);
    this.#map.delete(key);
    this.#map.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.#map.has(key)) {
      this.#map.delete(key);
    } else if (this.#map.size >= this.#maxSize) {
      // evict least recently used (first item)
      const [evictKey, evictValue] = this.#map.entries().next().value;
      this.#map.delete(evictKey);
      if (this.#onEvict) {
        this.#onEvict(evictKey, evictValue);
      }
    }
    this.#map.set(key, value);
  }

  has(key) {
    return this.#map.has(key);
  }

  delete(key) {
    const value = this.#map.get(key);
    this.#map.delete(key);
    return value;
  }

  clear() {
    if (this.#onEvict) {
      for (const [key, value] of this.#map) {
        this.#onEvict(key, value);
      }
    }
    this.#map.clear();
  }

  get size() {
    return this.#map.size;
  }

  keys() {
    return this.#map.keys();
  }
}
