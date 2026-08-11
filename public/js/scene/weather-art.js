/*
 * weather-art.js — canvas textures for the car park weather event:
 * fog banks, the things in it, what they leave on the glass.
 */

import * as THREE from 'three';

/*
 * soft-edged fog: bright noise blobs fading to nothing at the edges so
 * the banks have no hard rectangle edge against the sky.
 */
export function softFogTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 256);

  // a dense base first: thick at the ground, thinning towards the
  // top edge so the bank has no hard line against the sky. blobs
  // alone leave see-through gaps, which reads as thin haze not mist
  const base = ctx.createLinearGradient(0, 0, 0, 256);
  base.addColorStop(0, 'rgba(255,255,255,0.06)');
  base.addColorStop(0.3, 'rgba(255,255,255,0.55)');
  base.addColorStop(0.65, 'rgba(255,255,255,0.85)');
  base.addColorStop(1, 'rgba(255,255,255,0.95)');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 256);

  // billows over the top for texture
  for (let i = 0; i < 70; i++) {
    const x = (i * 73) % 512;
    const y = 40 + ((i * 41) % 200);
    const r = 45 + (i * 17) % 75;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // and a few soft thin patches so the wall churns rather than sits
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 16; i++) {
    const x = (i * 157) % 512;
    const y = 90 + ((i * 61) % 130);
    const r = 30 + (i * 23) % 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = 'source-over';

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping; // the banks drift sideways
  return texture;
}

/*
 * two vague silhouettes, never clearly seen: a single sweeping
 * tentacle, and something far too tall — only its legs pass through
 * the frame. nothing here has an outline clean enough to name.
 */
export function creatureTextures() {
  return [tentacle(), stilts()];
}

function shapeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 160);
  return { canvas, ctx };
}

function tentacle() {
  const { canvas, ctx } = shapeCanvas();
  ctx.strokeStyle = 'rgba(0,0,0,0.88)';
  ctx.lineCap = 'round';
  // one thick tapering arc sweeping across the frame
  const spine = [[10, 150], [70, 60], [150, 30], [246, 55]];
  for (let s = 0; s < 3; s++) {
    ctx.lineWidth = 26 - s * 8;
    ctx.beginPath();
    ctx.moveTo(spine[s][0], spine[s][1]);
    ctx.quadraticCurveTo(
      (spine[s][0] + spine[s + 1][0]) / 2 + 12,
      (spine[s][1] + spine[s + 1][1]) / 2 - 18,
      spine[s + 1][0], spine[s + 1][1],
    );
    ctx.stroke();
  }
  // sucker bumps riding the underside of the actual curve — sampled
  // along each bezier segment and offset down its normal, so they
  // cling to the limb instead of marching off on a straight line
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  for (let s = 0; s < 3; s++) {
    const [x0, y0] = spine[s];
    const [x1, y1] = spine[s + 1];
    const cxp = (x0 + x1) / 2 + 12;
    const cyp = (y0 + y1) / 2 - 18;
    const half = (26 - s * 8) / 2;
    for (const t of [0.2, 0.45, 0.7, 0.9]) {
      const mt = 1 - t;
      const px = mt * mt * x0 + 2 * mt * t * cxp + t * t * x1;
      const py = mt * mt * y0 + 2 * mt * t * cyp + t * t * y1;
      const tx = 2 * (mt * (cxp - x0) + t * (x1 - cxp));
      const ty = 2 * (mt * (cyp - y0) + t * (y1 - cyp));
      const len = Math.hypot(tx, ty) || 1;
      let nx = ty / len;
      let ny = -tx / len;
      if (ny < 0) { nx = -nx; ny = -ny; } // hang below, not above
      const r = 6.5 - s * 1.5;
      ctx.beginPath();
      ctx.arc(px + nx * (half + r * 0.6), py + ny * (half + r * 0.6), r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return new THREE.CanvasTexture(canvas);
}

function stilts() {
  const { canvas, ctx } = shapeCanvas();
  // long jointed legs descending from something above the frame —
  // the body is never seen, which is the point
  ctx.strokeStyle = 'rgba(0,0,0,0.88)';
  ctx.lineCap = 'round';
  const legXs = [42, 96, 158, 216];
  for (let i = 0; i < legXs.length; i++) {
    const x = legXs[i];
    const kneeX = x + ((i % 2) ? 18 : -16);
    const kneeY = 55 + (i * 13) % 30;
    const footX = x + ((i % 2) ? -8 : 12);
    // upper leg, thicker
    ctx.lineWidth = 11 - (i % 2) * 2;
    ctx.beginPath();
    ctx.moveTo(x, -6);
    ctx.lineTo(kneeX, kneeY);
    ctx.stroke();
    // lower leg, tapering to the foot
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(kneeX, kneeY);
    ctx.lineTo(footX, 158);
    ctx.stroke();
    // a hard little joint at the knee
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.beginPath();
    ctx.arc(kneeX, kneeY, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

/*
 * insect remains on the glass, three variants: different ichor tones,
 * spatter patterns, and how much of the bug survived the landing.
 */
export function splatTextures() {
  return [
    bugSplat('150,168,60', '96,110,34', 3, 3),
    bugSplat('168,158,44', '110,96,30', 2, 4),
    bugSplat('132,150,72', '80,102,42', 4, 2),
    bugSplat('170,140,120', '112,84,70', 3, 5), // pinkish-grey, leggier
    bugSplat('110,124,48', '64,76,26', 5, 3),   // dark olive, long body
  ];
}

function bugSplat(ichor, core, segments, legsPerSide) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);

  const seed = segments * 7 + legsPerSide * 13;
  ctx.fillStyle = `rgba(${ichor},0.75)`;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const r = 46 + ((i * 37 + seed) % 6) * 9;
    const px = 128 + Math.cos(a) * r;
    const py = 128 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 10 + segments * 2; i++) {
    const a = (i / 12) * Math.PI * 2 + seed * 0.1;
    const d = 74 + (i * 23 + seed) % 40;
    ctx.beginPath();
    ctx.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 2.5 + (i % 3) * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = `rgba(${core},0.8)`;
  ctx.beginPath();
  ctx.ellipse(128, 128, 30, 24, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // whatever is left of the body
  ctx.fillStyle = 'rgba(38,42,20,0.9)';
  for (let s = 0; s < segments; s++) {
    const r = 12 - s * 2;
    ctx.beginPath();
    ctx.ellipse(112 + s * 15, 128 + (s % 2) * 4, r, r * 0.7, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(38,42,20,0.85)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    for (let i = 0; i < legsPerSide; i++) {
      ctx.beginPath();
      ctx.moveTo(114 + i * 11, 128 + side * 8);
      ctx.lineTo(104 + i * 11 + (i % 2) * 6, 128 + side * 27);
      ctx.lineTo(114 + i * 11, 128 + side * 41);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/*
 * the smear a sliding bug leaves behind: vertical ichor streaks,
 * freshest at the bottom where the body is, drying out above.
 */
export function gunkTrailTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 256);
  for (let i = 0; i < 7; i++) {
    const x = 18 + (i * 31) % 92;
    const w = 5 + (i * 13) % 10;
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(140,158,56,0.08)');
    grad.addColorStop(0.6, 'rgba(140,158,56,0.35)');
    grad.addColorStop(1, 'rgba(120,140,44,0.6)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - w / 2, (i * 17) % 40, w, 256);
  }
  // a few clinging droplets along the streaks
  ctx.fillStyle = 'rgba(130,150,50,0.5)';
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc(20 + (i * 37) % 90, 40 + (i * 53) % 190, 3 + (i % 3) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/*
 * a tapered tentacle as live geometry: a cubic bezier tube whose
 * vertices are rebuilt each frame, with organic radius undulation and
 * a draw range so it can grow out of the fog and retract again.
 */
export function makeTentacle(segments = 42, radial = 10, r0 = 0.34, r1 = 0.06) {
  const rings = segments + 1;
  const positions = new Float32Array(rings * radial * 3);
  const normals = new Float32Array(rings * radial * 3);
  const indices = [];
  for (let s = 0; s < segments; s++) {
    for (let r = 0; r < radial; r++) {
      const a = s * radial + r;
      const b = s * radial + (r + 1) % radial;
      const c = (s + 1) * radial + r;
      const d = (s + 1) * radial + (r + 1) % radial;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.setDrawRange(0, 0);

  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: '#181c22', roughness: 0.85,
  }));
  mesh.frustumCulled = false;

  const curve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
  );
  const up = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const pt = new THREE.Vector3();

  /*
   * lay the tube along p0..p3 (root to tip). drawFrac 0..1 grows it
   * from the root; wobble animates the muscle undulation.
   */
  function reshape(p0, p1, p2, p3, drawFrac, wobble = 0) {
    curve.v0.copy(p0);
    curve.v1.copy(p1);
    curve.v2.copy(p2);
    curve.v3.copy(p3);
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      curve.getPoint(t, pt);
      curve.getTangent(t, tangent).normalize();
      normal.crossVectors(tangent, up);
      if (normal.lengthSq() < 1e-4) normal.set(1, 0, 0);
      normal.normalize();
      binormal.crossVectors(tangent, normal).normalize();
      // a gentle low-frequency muscle swell — anything stronger reads
      // as beads on a string once the thin sections fade into the fog
      const radius = (r0 + (r1 - r0) * t) * (1 + 0.05 * Math.sin(t * 9 + wobble));
      for (let r = 0; r < radial; r++) {
        const a = (r / radial) * Math.PI * 2;
        const i = (s * radial + r) * 3;
        const nx = normal.x * Math.cos(a) + binormal.x * Math.sin(a);
        const ny = normal.y * Math.cos(a) + binormal.y * Math.sin(a);
        const nz = normal.z * Math.cos(a) + binormal.z * Math.sin(a);
        positions[i] = pt.x + nx * radius;
        positions[i + 1] = pt.y + ny * radius;
        positions[i + 2] = pt.z + nz * radius;
        normals[i] = nx;
        normals[i + 1] = ny;
        normals[i + 2] = nz;
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
    const frac = Math.max(0, Math.min(1, drawFrac));
    geometry.setDrawRange(0, Math.floor(segments * frac) * radial * 6);
  }

  return { mesh, reshape };
}

/*
 * radial impact cracks, two variants with different spreads.
 */
export function crackTextures() {
  return [impactCrack(11, 60, 55), impactCrack(8, 45, 90)];
}

function impactCrack(legs, baseLen, extraLen) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(235,240,245,0.9)';
  ctx.lineCap = 'round';
  for (let i = 0; i < legs; i++) {
    const a = (i / legs) * Math.PI * 2 + (i % 3) * 0.15;
    let x = 128, y = 128;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const legLen = baseLen + (i * 29) % extraLen;
    const steps = 4;
    for (let s = 1; s <= steps; s++) {
      const wobble = ((i * 13 + s * 7) % 9 - 4) * 3;
      x = 128 + Math.cos(a) * (legLen * s / steps) + wobble;
      y = 128 + Math.sin(a) * (legLen * s / steps) - wobble;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.lineWidth = 1.5;
  for (const r of [14, 26]) {
    ctx.beginPath();
    ctx.arc(128, 128, r, 0.3, Math.PI * 2 - 0.4);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(128, 128, 5, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}
