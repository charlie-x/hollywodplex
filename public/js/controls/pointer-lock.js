/*
 * pointer-lock.js — pointer lock api wrapper.
 * handles the click-to-lock flow, escape-to-unlock, and browser compatibility.
 */

import store from '../store.js';

export function setupPointerLock(domElement, onLock, onUnlock) {
  let isLocked = false;

  function requestLock() {
    // re-locking right after an escape-unlock can be rejected by the
    // browser's cooldown — swallow it; the "click to explore" prompt
    // is the fallback and a click always succeeds
    try {
      const result = domElement.requestPointerLock();
      if (result && typeof result.catch === 'function') {
        result.catch(() => {});
      }
    } catch { /* unsupported or rejected — prompt covers it */ }
  }

  function exitLock() {
    if (document.pointerLockElement === domElement) {
      document.exitPointerLock();
    }
  }

  function onPointerLockChange() {
    const wasLocked = isLocked;
    isLocked = document.pointerLockElement === domElement;
    store.isPointerLocked = isLocked;

    if (isLocked && !wasLocked) {
      onLock();
    } else if (!isLocked && wasLocked) {
      onUnlock();
    }
  }

  function onPointerLockError() {
    console.warn('[pointer-lock] failed to acquire lock');
    store.isPointerLocked = false;
  }

  // click to lock
  domElement.addEventListener('click', (e) => {
    if (!isLocked && store.mode === '3d') {
      e.preventDefault();
      requestLock();
    }
  });

  document.addEventListener('pointerlockchange', onPointerLockChange);
  document.addEventListener('pointerlockerror', onPointerLockError);

  // esc key also handled by the pointerlockchange event

  return {
    get isLocked() {
      return isLocked;
    },
    requestLock,
    exitLock,
    dispose() {
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('pointerlockerror', onPointerLockError);
      if (isLocked) exitLock();
    },
  };
}
