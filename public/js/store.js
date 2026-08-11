/*
 * store.js — shared application state.
 * modules read and write state here; the event bus notifies subscribers of changes.
 */

import { EventBus } from './utils/event-bus.js';

class Store {
  #bus = new EventBus();

  // state
  libraries = [];
  activeSectionId = null;
  items = new Map();         // ratingKey -> item
  itemOrder = [];            // ordered list of ratingKeys for shelf layout
  selectedItem = null;       // ratingKey of item in modal (null = closed)
  mode = '3d';               // '3d' | '2d'
  loadingProgress = 0;       // 0..1
  searchQuery = '';
  playerPosition = { x: 0, y: 1.7, z: 5 };
  isPointerLocked = false;

  on(event, callback) {
    return this.#bus.on(event, callback);
  }

  emit(event, ...args) {
    this.#bus.emit(event, ...args);
  }

  setMode(mode) {
    if (this.mode !== mode) {
      this.mode = mode;
      this.#bus.emit('mode-changed', mode);
    }
  }

  selectItem(ratingKey) {
    this.selectedItem = ratingKey;
    this.#bus.emit('item-selected', ratingKey);
  }

  closeItem() {
    this.selectedItem = null;
    this.#bus.emit('item-closed');
  }

  setLoadingProgress(ratio) {
    this.loadingProgress = Math.min(1, Math.max(0, ratio));
    this.#bus.emit('loading-progress', this.loadingProgress);
  }
}

// singleton
const store = new Store();
export default store;
