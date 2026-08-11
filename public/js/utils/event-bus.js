/*
 * event-bus.js — tiny pub/sub for decoupled module communication.
 * used by store.js and anywhere modules need to react to state changes.
 */

export class EventBus {
  #listeners = new Map();

  /*
   * subscribe to an event.
   * returns an unsubscribe function.
   */
  on(event, callback) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }
    this.#listeners.get(event).add(callback);
    return () => this.#listeners.get(event)?.delete(callback);
  }

  /*
   * subscribe to an event, but only fire once.
   */
  once(event, callback) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      callback(...args);
    };
    return this.on(event, wrapper);
  }

  /*
   * emit an event to all listeners.
   */
  emit(event, ...args) {
    const listeners = this.#listeners.get(event);
    if (!listeners) return;
    for (const fn of listeners) {
      try {
        fn(...args);
      } catch (err) {
        console.error(`[event-bus] error in handler for "${event}":`, err);
      }
    }
  }

  off(event, callback) {
    this.#listeners.get(event)?.delete(callback);
  }
}
