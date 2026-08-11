/*
 * audio.js — ambient store audio, synthesised with the web audio api.
 * a quiet muzak chord pad, footsteps while walking, and a soft click
 * on selection. m toggles mute. starts on the first pointer lock
 * because browsers require a user gesture before audio.
 */

import store from '../store.js';

const CHORDS = [
  [261.63, 329.63, 392.0],   // C major
  [220.0, 277.18, 329.63],   // A minor-ish
  [174.61, 220.0, 261.63],   // F major
  [196.0, 246.94, 293.66],   // G major
];

export function createStoreAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let started = false;
  let padOscs = [];
  let chordTimer = null;
  let chordIdx = 0;
  let stepTimer = 0;

  function ensureContext() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
  }

  function startMuzak() {
    if (started) return;
    ensureContext();
    started = true;

    const padGain = ctx.createGain();
    padGain.gain.value = 0.025; // very quiet background pad
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    padGain.connect(filter);
    filter.connect(master);

    const playChord = () => {
      for (const osc of padOscs) {
        try { osc.stop(ctx.currentTime + 1.2); } catch { /* already stopped */ }
      }
      padOscs = [];

      const chord = CHORDS[chordIdx % CHORDS.length];
      chordIdx++;

      for (const freq of chord) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5);
        osc.connect(g);
        g.connect(padGain);
        osc.start();
        padOscs.push(osc);
      }
    };

    playChord();
    chordTimer = setInterval(playChord, 8000);
  }

  /*
   * short filtered noise burst — a soft footstep.
   */
  function footstep() {
    if (!ctx || muted) return;
    const dur = 0.09;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 350;
    const g = ctx.createGain();
    g.gain.value = 0.12;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
  }

  /*
   * soft click for case selection.
   */
  function click() {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.connect(g);
    g.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }

  /*
   * a deep thump with a glass rattle — something heavy against a window.
   */
  function thud() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(70, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + 0.4);

    const dur = 0.12;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 2;
    const g2 = ctx.createGain();
    g2.gain.value = 0.07;
    src.connect(bp);
    bp.connect(g2);
    g2.connect(master);
    src.start(t);
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 1;
    return muted;
  }

  /*
   * call each frame with dt and whether the player is currently moving.
   * paces footsteps at a walking rhythm.
   */
  function update(dt, isMoving) {
    if (!started || muted) return;
    if (isMoving) {
      stepTimer += dt;
      if (stepTimer >= 0.48) {
        stepTimer = 0;
        footstep();
      }
    } else {
      stepTimer = 0.4; // next step lands quickly when moving resumes
    }
  }

  // start on first pointer lock (a user gesture has happened by then)
  store.on('item-selected', click);
  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') {
      const nowMuted = toggleMute();
      store.emit('audio-muted', nowMuted);
    }
  });

  return { startMuzak, update, toggleMute, footstep, click, thud };
}
