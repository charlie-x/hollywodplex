/*
 * loading-screen.js — startup loading screen with progress bar and flavour text.
 * shows while the 3d scene initialises and data loads.
 */

import store from '../store.js';

const MESSAGES = [
  { threshold: 0.0, text: 'establishing connection to the video store...' },
  { threshold: 0.2, text: 'checking the back room inventory...' },
  { threshold: 0.4, text: 'stocking the shelves...' },
  { threshold: 0.6, text: 'powering up the neon...' },
  { threshold: 0.8, text: 'dimming the lights...' },
  { threshold: 0.95, text: 'the store is almost open...' },
];

export function createLoadingScreen() {
  const screen = document.getElementById('loading-screen');
  const bar = document.getElementById('loading-bar');
  const message = document.getElementById('loading-message');

  if (!screen || !bar) return { setProgress() {}, hide() {} };

  let currentMessageIdx = 0;

  function setProgress(ratio, customMessage) {
    bar.style.transform = `scaleX(${Math.min(1, Math.max(0, ratio))})`;

    if (customMessage) {
      message.textContent = customMessage;
      return;
    }

    // advance through flavour messages
    for (let i = MESSAGES.length - 1; i >= 0; i--) {
      if (ratio >= MESSAGES[i].threshold && i >= currentMessageIdx) {
        currentMessageIdx = i;
        message.textContent = MESSAGES[i].text;
        break;
      }
    }
  }

  function hide() {
    screen.classList.add('fade-out');
    setTimeout(() => {
      screen.style.display = 'none';
    }, 600);
  }

  // listen to store progress
  store.on('loading-progress', (ratio) => setProgress(ratio));

  return { setProgress, hide };
}
