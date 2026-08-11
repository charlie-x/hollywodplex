/*
 * mist.js — the mist event. every so often a thick fog rolls across
 * the car park outside the storefront glass, dark shapes drift past,
 * cracks slam into the windows as something tests them — and then it
 * all recedes and the night is ordinary again. an homage to the 2007
 * frank darabont film. visible only through the front windows.
 */

import * as THREE from 'three';
import { STOREFRONT_WIDTH } from './storefront.js';

const FIRST_WAIT = 300;        // five minutes before the first event
const SIEGE_MIN = 60;          // how long the fog sits at full thickness
const SIEGE_MAX = 90;
const ROLL_IN = 15;
const ROLL_OUT = 20;
const MAX_CRACKS = 4;

export function createMistEvent(scene, dims) {
  const cx = dims.cx ?? 0;
  const wallZ = (dims.cz ?? 0) + dims.depth / 2;

  // ---- layered fog banks across the car park ----
  // far banks thicken first so the fog reads as rolling towards the
  // glass rather than fading in evenly
  const banks = [];
  const fogTexture = softFogTexture();
  for (const [dz, maxOpacity, delay] of [
    [14.6, 0.95, 0.0],  // whites out the strip mall first
    [9.0, 0.8, 0.25],
    [5.0, 0.65, 0.5],
    [1.6, 0.5, 0.75],   // finally right up against the pavement
  ]) {
    const bank = new THREE.Mesh(
      new THREE.PlaneGeometry(STOREFRONT_WIDTH + 22, 7),
      new THREE.MeshBasicMaterial({
        map: fogTexture, color: '#c4c6ca', transparent: true, opacity: 0,
        depthWrite: false,
      }),
    );
    bank.position.set(cx, 2.4, wallZ + dz);
    bank.rotation.y = Math.PI; // faces the store
    bank.visible = false;
    scene.add(bank);
    banks.push({ mesh: bank, maxOpacity, delay });
  }

  // a dark shape that drifts through the fog during the siege
  const shape = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 2.2),
    new THREE.MeshBasicMaterial({
      map: creatureTexture(), color: '#14161c', transparent: true, opacity: 0,
      depthWrite: false,
    }),
  );
  shape.position.set(cx, 1.6, wallZ + 3.2);
  shape.rotation.y = Math.PI;
  shape.visible = false;
  scene.add(shape);

  // ---- crack decals on the glass, each with the bug that made it ----
  const crackTexture = cracksTexture();
  const splatTexture = bugSplatTexture();
  const cracks = [];
  for (let i = 0; i < MAX_CRACKS; i++) {
    const crack = new THREE.Mesh(
      new THREE.PlaneGeometry(0.65, 0.65),
      new THREE.MeshBasicMaterial({
        map: crackTexture, transparent: true, opacity: 0,
        depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    crack.position.set(0, 0, wallZ - 0.03);
    crack.visible = false;
    scene.add(crack);
    const splat = new THREE.Mesh(
      new THREE.PlaneGeometry(0.45, 0.45),
      new THREE.MeshBasicMaterial({
        map: splatTexture, transparent: true, opacity: 0,
        depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    splat.position.set(0, 0, wallZ - 0.025);
    splat.visible = false;
    scene.add(splat);
    cracks.push({ mesh: crack, splat, hasSplat: false, age: -1 });
  }

  // ---- event state machine ----
  let state = 'idle';
  let timer = FIRST_WAIT;
  let siegeLeft = 0;
  let thumpIn = 0;
  let shapeT = -1;
  let fogLevel = 0; // 0 clear .. 1 full

  function startEvent() {
    state = 'rollIn';
    timer = ROLL_IN;
    siegeLeft = SIEGE_MIN + Math.random() * (SIEGE_MAX - SIEGE_MIN);
    thumpIn = 6 + Math.random() * 6;
    for (const b of banks) b.mesh.visible = true;
  }

  function thump() {
    const free = cracks.find(c => c.age < 0);
    if (!free) return;
    free.age = 0;
    free.mesh.visible = true;
    // somewhere on the glass, away from the very edges
    const hx = cx + (Math.random() - 0.5) * (STOREFRONT_WIDTH - 1.6);
    const hy = 0.9 + Math.random() * 1.6;
    free.mesh.position.set(hx, hy, wallZ - 0.03);
    free.mesh.rotation.z = Math.random() * Math.PI * 2;
    // most impacts leave the bug that made them smeared on the glass
    free.hasSplat = Math.random() < 0.75;
    if (free.hasSplat) {
      free.splat.visible = true;
      free.splat.position.set(
        hx + (Math.random() - 0.5) * 0.12,
        hy + (Math.random() - 0.5) * 0.12,
        wallZ - 0.025,
      );
      free.splat.rotation.z = Math.random() * Math.PI * 2;
    }
  }

  function applyFog() {
    for (const b of banks) {
      // each bank waits for its share of the roll before thickening
      const local = Math.max(0, Math.min(1, (fogLevel - b.delay) / (1 - b.delay)));
      b.mesh.material.opacity = b.maxOpacity * local;
    }
  }

  function update(dt) {
    // cracks pop in fast, then linger; the splat lands with them
    for (const c of cracks) {
      if (c.age < 0) continue;
      c.age += dt;
      const pop = Math.min(1, c.age / 0.12);
      c.mesh.scale.setScalar(0.3 + 0.7 * pop);
      c.mesh.material.opacity = 0.85 * pop * Math.min(1, fogLevel * 2);
      if (c.hasSplat) {
        c.splat.scale.setScalar(0.4 + 0.6 * pop);
        c.splat.material.opacity = 0.9 * pop * Math.min(1, fogLevel * 2);
      }
    }

    switch (state) {
      case 'idle':
        timer -= dt;
        if (timer <= 0) startEvent();
        break;

      case 'rollIn':
        timer -= dt;
        fogLevel = Math.min(1, 1 - timer / ROLL_IN);
        applyFog();
        if (timer <= 0) {
          fogLevel = 1;
          state = 'siege';
        }
        break;

      case 'siege':
        siegeLeft -= dt;
        thumpIn -= dt;
        if (thumpIn <= 0) {
          thump();
          thumpIn = 8 + Math.random() * 10;
        }
        // the shape drifts past now and then
        if (shapeT < 0 && Math.random() < dt * 0.08) {
          shapeT = 0;
          shape.visible = true;
        }
        if (shapeT >= 0) {
          shapeT += dt;
          const drift = shapeT / 7;
          shape.position.x = cx + (drift - 0.5) * (STOREFRONT_WIDTH + 6);
          shape.material.opacity = 0.5 * Math.sin(Math.min(1, drift) * Math.PI);
          if (drift >= 1) {
            shapeT = -1;
            shape.visible = false;
          }
        }
        if (siegeLeft <= 0) {
          state = 'rollOut';
          timer = ROLL_OUT;
        }
        break;

      case 'rollOut':
        timer -= dt;
        fogLevel = Math.max(0, timer / ROLL_OUT);
        applyFog();
        // the cracks mend as the mist lets go of the glass
        for (const c of cracks) {
          if (c.age >= 0) {
            c.mesh.material.opacity = Math.min(c.mesh.material.opacity, fogLevel);
            if (c.hasSplat) c.splat.material.opacity = Math.min(c.splat.material.opacity, fogLevel);
          }
        }
        if (timer <= 0) {
          fogLevel = 0;
          for (const b of banks) b.mesh.visible = false;
          for (const c of cracks) {
            c.age = -1;
            c.mesh.visible = false;
            c.splat.visible = false;
            c.hasSplat = false;
          }
          shape.visible = false;
          shapeT = -1;
          state = 'idle';
          timer = 360 + Math.random() * 360; // it always comes back
        }
        break;
    }
  }

  return { update };
}

/*
 * soft-edged fog: bright noise blobs fading to nothing at the top so
 * the banks have no hard rectangle edge against the sky.
 */
function softFogTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 256);
  for (let i = 0; i < 90; i++) {
    const x = (i * 73) % 512;
    const y = 60 + ((i * 41) % 180);
    const r = 40 + (i * 17) % 70;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.30)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/*
 * a vague many-limbed silhouette — never clearly seen, as it should be.
 */
function creatureTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 160);
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.beginPath();
  ctx.ellipse(128, 90, 70, 42, 0, 0, Math.PI * 2);
  ctx.fill();
  // trailing limbs
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(90 + i * 18, 110);
    ctx.quadraticCurveTo(80 + i * 20, 150, 60 + i * 26, 158);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/*
 * an alien insect smeared on the glass: greenish ichor spatter with
 * the segmented body and bent legs still in the middle of it.
 */
function bugSplatTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);

  // ichor blob with spatter drops flung outward
  ctx.fillStyle = 'rgba(150,168,60,0.75)';
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const r = 52 + ((i * 37) % 5) * 8;
    const px = 128 + Math.cos(a) * r;
    const py = 128 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26;
    const d = 78 + (i * 23) % 34;
    ctx.beginPath();
    ctx.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 3 + (i % 3) * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // darker core where it hit hardest
  ctx.fillStyle = 'rgba(96,110,34,0.8)';
  ctx.beginPath();
  ctx.ellipse(128, 128, 30, 24, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // the remains: segmented body and bent legs
  ctx.fillStyle = 'rgba(38,42,20,0.9)';
  for (const [sx, r] of [[-14, 12], [2, 10], [15, 8]]) {
    ctx.beginPath();
    ctx.ellipse(128 + sx, 128, r, r * 0.7, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(38,42,20,0.85)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(120 + i * 12, 128 + side * 8);
      ctx.lineTo(112 + i * 12, 128 + side * 26);
      ctx.lineTo(120 + i * 12, 128 + side * 40);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/*
 * radial impact crack, like a stone into a windscreen.
 */
function cracksTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(235,240,245,0.9)';
  ctx.lineCap = 'round';
  // jagged radial legs
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + (i % 3) * 0.15;
    let x = 128, y = 128;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const legLen = 60 + (i * 29) % 55;
    const steps = 4;
    for (let s = 1; s <= steps; s++) {
      const wobble = ((i * 13 + s * 7) % 9 - 4) * 3;
      x = 128 + Math.cos(a) * (legLen * s / steps) + wobble;
      y = 128 + Math.sin(a) * (legLen * s / steps) - wobble;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // concentric shatter rings near the impact point
  ctx.lineWidth = 1.5;
  for (const r of [14, 26]) {
    ctx.beginPath();
    ctx.arc(128, 128, r, 0.3, Math.PI * 2 - 0.4);
    ctx.stroke();
  }
  // bright impact core
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(128, 128, 5, 0, Math.PI * 2);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}
