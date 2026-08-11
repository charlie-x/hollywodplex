/*
 * gamepad.js — controller support via the gamepad api (xbox, playstation
 * and generic pads; works in edge on xbox consoles). left stick walks,
 * right stick looks, a selects the case under the crosshair, b backs
 * out of overlays, y opens search, right trigger or l3 runs, menu mutes.
 * detection is poll-based: the first input wakes the controls without
 * needing pointer lock.
 */

import store from '../store.js';

const DEADZONE = 0.16;
const LOOK_SPEED = 2.6; // radians per second at full stick deflection

// rescale past the deadzone so slow walking stays possible
function shaped(v) {
  if (Math.abs(v) < DEADZONE) return 0;
  return (v - Math.sign(v) * DEADZONE) / (1 - DEADZONE);
}

export function createGamepadControls(controls, canvas) {
  let prevPressed = [];
  let announced = false;

  function firstPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (p && p.connected) return p;
    }
    return null;
  }

  function update(dt) {
    const pad = firstPad();
    if (!pad) {
      controls.pad.forward = 0;
      controls.pad.right = 0;
      controls.pad.run = false;
      return;
    }

    const lx = shaped(pad.axes[0] || 0);
    const ly = shaped(pad.axes[1] || 0);
    const rx = shaped(pad.axes[2] || 0);
    const ry = shaped(pad.axes[3] || 0);
    const pressed = pad.buttons.map(b => b.pressed);
    const anyInput = lx !== 0 || ly !== 0 || rx !== 0 || ry !== 0 || pressed.some(Boolean);

    // first touch of the pad wakes 3d controls without pointer lock
    if (anyInput && !store.gamepadActive) {
      store.gamepadActive = true;
      controls.enable();
      if (!announced) {
        announced = true;
        store.emit('gamepad-active');
      }
    }

    const overlayOpen = document.activeElement?.tagName === 'INPUT';
    if (store.gamepadActive && store.mode === '3d' && !overlayOpen) {
      controls.pad.forward = -ly; // stick up walks forward
      controls.pad.right = lx;
      controls.pad.lookX += rx * LOOK_SPEED * dt;
      controls.pad.lookY += ry * LOOK_SPEED * dt;
      controls.pad.run = pressed[10] || (pad.buttons[7]?.value ?? 0) > 0.5; // l3 or rt
    } else {
      controls.pad.forward = 0;
      controls.pad.right = 0;
      controls.pad.run = false;
    }

    // edge-triggered buttons
    const down = (i) => pressed[i] && !prevPressed[i];
    if (down(0)) {
      // a: the raycaster's click handler selects whatever the
      // crosshair is on; the synthetic click needs no coordinates
      canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    if (down(1)) {
      // b: escape closes the film card, and reaches the search input
      // via the focused element so its own handler hides the overlay
      (document.activeElement || document).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
      );
    }
    if (down(3)) {
      // y: search terminal
      store.emit('search-toggle');
    }
    if (down(9)) {
      // menu: toggle the ambience like the m key
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'm', code: 'KeyM', bubbles: true }),
      );
    }
    prevPressed = pressed;
  }

  return { update };
}
