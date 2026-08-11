/*
 * storefront.js — glass entrance front and the world outside.
 * fills a 10m opening in the front wall with aluminium mullions and
 * glass, double doors in the centre (locked — collision blocks them),
 * and dresses a night-time car park beyond the glass.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const STOREFRONT_WIDTH = 10;
const GLASS_TOP = 3.2; // matches the wall door lintel height

const frameMat = new THREE.MeshStandardMaterial({
  color: '#8a8d94', roughness: 0.35, metalness: 0.8,
});
const glassMat = new THREE.MeshPhysicalMaterial({
  color: '#b8ccce', transparent: true, opacity: 0.14,
  roughness: 0.05, metalness: 0, side: THREE.DoubleSide,
});

export function createStorefront(scene, dims) {
  const { width, depth } = dims;
  const cx = dims.cx ?? 0;
  const cz = dims.cz ?? 0;
  const wallZ = cz + depth / 2;
  const group = new THREE.Group();
  const half = STOREFRONT_WIDTH / 2;

  // ---- mullion frame ----
  // vertical posts: outer edges, window splits, door jambs and the
  // meeting stile where the two doors close against each other
  const frames = [];
  for (const x of [-half, -3.4, -1.8, 0, 1.8, 3.4, half]) {
    const g = new THREE.BoxGeometry(0.09, GLASS_TOP, 0.14);
    g.translate(cx + x, GLASS_TOP / 2, wallZ);
    frames.push(g);
  }
  // top and bottom rails, plus a sill band across the window bays
  for (const [y, h] of [[0.06, 0.12], [GLASS_TOP - 0.06, 0.12], [0.72, 0.08]]) {
    const g = new THREE.BoxGeometry(STOREFRONT_WIDTH, h, 0.12);
    g.translate(cx, y, wallZ);
    frames.push(g);
  }
  // door push bars and kick plates
  for (const x of [-0.9, 0.9]) {
    const bar = new THREE.BoxGeometry(1.5, 0.06, 0.1);
    bar.translate(cx + x, 1.05, wallZ);
    frames.push(bar);
    const kick = new THREE.BoxGeometry(1.7, 0.32, 0.05);
    kick.translate(cx + x, 0.28, wallZ);
    frames.push(kick);
  }
  const frame = new THREE.Mesh(mergeGeometries(frames), frameMat);
  group.add(frame);
  for (const g of frames) g.dispose();

  // ---- glass, one pane across the whole front ----
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(STOREFRONT_WIDTH - 0.1, GLASS_TOP - 0.2),
    glassMat,
  );
  glass.position.set(cx, GLASS_TOP / 2, wallZ);
  group.add(glass);

  // neon open sign hung in a window bay, glowing out at the car park
  const open = makeOpenSign();
  open.position.set(cx - 2.6, 2.5, wallZ + 0.03);
  group.add(open);

  // the neon never burns quite steady: a faint tube buzz with the
  // odd near-dropout, much subtler than the back room bulb
  // the open sign is on its way out: long lit stretches broken by
  // hard stutters and brief outages. the brandys b across the road is
  // properly dead — it spends as long dark as lit
  const openFlicker = makeNeonFlicker([1.5, 5.0], [0.15, 0.7]);
  const bFlicker = makeNeonFlicker([0.5, 2.2], [0.4, 2.0]);
  const update = (dt) => {
    const level = openFlicker(dt);
    open.material.emissiveIntensity = 0.9 * level;
    // darken the tube art itself, or the colour map stays lit-looking
    open.material.color.setScalar(0.25 + 0.75 * level);

    if (outside.brokenB) {
      const b = bFlicker(dt);
      outside.brokenB.emissiveIntensity = 0.8 * b;
      outside.brokenB.opacity = 0.08 + 0.92 * b; // faint dead tube ghost
    }
  };

  // entrance mat just inside the doors
  const mat = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.02, 1.1),
    new THREE.MeshStandardMaterial({ color: '#3a1114', roughness: 1 }),
  );
  mat.position.set(cx, 0.01, wallZ - 0.75);
  group.add(mat);

  // ---- the world outside ----
  const outside = buildCarPark(group, cx, wallZ);

  group.traverse(o => { o.updateMatrix(); o.matrixAutoUpdate = false; });
  scene.add(group);

  // the doors are locked: one box seals the whole glass span
  const collisionBoxes = [new THREE.Box3(
    new THREE.Vector3(cx - half, 0, wallZ - 0.15),
    new THREE.Vector3(cx + half, GLASS_TOP, wallZ + 0.15),
  )];

  return { group, collisionBoxes, update, cars: outside.cars };
}

/*
 * night-time car park diorama beyond the glass: tarmac with painted
 * stalls, a pavement kerb, two parked 90s cars, one sodium street
 * lamp, and a strip of shops glowing across the way.
 */
function buildCarPark(group, cx, wallZ) {
  // pavement right outside the doors
  const pavement = new THREE.Mesh(
    new THREE.BoxGeometry(STOREFRONT_WIDTH + 4, 0.08, 2.2),
    new THREE.MeshStandardMaterial({ color: '#55555c', roughness: 0.95 }),
  );
  pavement.position.set(cx, 0.04, wallZ + 1.1);
  group.add(pavement);

  // tarmac
  const tarmac = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 15),
    new THREE.MeshStandardMaterial({ color: '#111318', roughness: 1 }),
  );
  tarmac.rotation.x = -Math.PI / 2;
  tarmac.position.set(cx, 0.005, wallZ + 9.5);
  group.add(tarmac);

  // painted parking stalls facing the shop
  const lineMat = new THREE.MeshStandardMaterial({ color: '#c9c9bd', roughness: 0.9 });
  const lines = [];
  for (let i = -3; i <= 3; i++) {
    const g = new THREE.BoxGeometry(0.1, 0.011, 4.4);
    g.translate(cx + i * 2.7, 0.012, wallZ + 4.6);
    lines.push(g);
  }
  group.add(new THREE.Mesh(mergeGeometries(lines), lineMat));
  for (const g of lines) g.dispose();

  // two parked cars, nose in towards the glass
  const cars = [
    makeCar('#6b2130', cx - 4.05, wallZ + 4.7),
    makeCar('#274a63', cx + 2.75, wallZ + 4.9),
  ];
  for (const car of cars) group.add(car);

  // street lamp with a warm sodium pool
  const lamp = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 4.6),
    new THREE.MeshStandardMaterial({ color: '#2c2e33', roughness: 0.7 }),
  );
  pole.position.y = 2.3;
  lamp.add(pole);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.14, 0.28),
    new THREE.MeshStandardMaterial({
      color: '#c9c2a8', emissive: '#ffd9a0', emissiveIntensity: 1.6,
    }),
  );
  head.position.set(0, 4.55, 0);
  lamp.add(head);
  const pool = new THREE.PointLight('#ffcf90', 9, 16, 2);
  pool.position.set(0, 4.4, 0);
  lamp.add(pool);
  lamp.position.set(cx + 7.6, 0, wallZ + 3.4);
  group.add(lamp);

  // strip of shops across the car park, windows lit
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(30, 4, 0.6),
    new THREE.MeshStandardMaterial({ color: '#0a0c12', roughness: 0.95 }),
  );
  strip.position.set(cx, 2, wallZ + 15.5);
  group.add(strip);

  const windowMat = new THREE.MeshStandardMaterial({
    color: '#f4e6bd', emissive: '#ffe9b0', emissiveIntensity: 0.55,
  });
  const windows = [];
  for (const x of [-11, -8.4, -3.2, 1.4, 6.2, 10.5]) {
    const g = new THREE.PlaneGeometry(1.5, 0.9);
    g.translate(cx + x, 1.9, wallZ + 15.18);
    g.rotateY(Math.PI); // face the store
    windows.push(g);
  }
  group.add(new THREE.Mesh(mergeGeometries(windows), windowMat));
  for (const g of windows) g.dispose();

  // brandys donuts across the way: roofline neon with a broken first
  // letter, and the iconic giant ring donut standing above the building
  const brandys = makeNeonSign('BRANDYS DONUTS', '#ff5b8f', 4.9, 0);
  brandys.group.rotation.y = Math.PI;
  brandys.group.position.set(cx - 5.8, 3.3, wallZ + 15.15);
  group.add(brandys.group);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.5, 0.62, 14, 32),
    new THREE.MeshStandardMaterial({
      color: '#c98a4b', roughness: 0.75,
      // floodlit at night, so it never falls to silhouette
      emissive: '#7a4d24', emissiveIntensity: 0.35,
    }),
  );
  ring.position.set(cx - 5.8, 5.55, wallZ + 15.5);
  group.add(ring);

  return { brokenB: brandys.brokenMat, cars };
}

/*
 * dying neon state machine: lit for a while, then a burst of hard
 * on/off stutters that settles either lit or dead, over and over.
 * returns an advance(dt) function yielding the current level 0..1.
 */
function makeNeonFlicker(litRange, deadRange) {
  const span = ([a, b]) => a + Math.random() * (b - a);
  let state = 'lit';
  let timer = span(litRange);
  let stutters = 0;
  let level = 1;

  return (dt) => {
    timer -= dt;
    if (timer > 0) return level;

    if (state === 'lit') {
      state = 'stutter';
      stutters = 3 + Math.floor(Math.random() * 5);
      level = 0;
      timer = 0.03 + Math.random() * 0.08;
    } else if (state === 'dead') {
      state = 'stutter';
      stutters = 2 + Math.floor(Math.random() * 4);
      level = 1;
      timer = 0.03 + Math.random() * 0.08;
    } else {
      // mid-stutter: hard alternation until the burst runs out
      level = level > 0.5 ? 0 : 1;
      stutters--;
      timer = 0.03 + Math.random() * 0.09;
      if (stutters <= 0) {
        state = Math.random() < 0.55 ? 'lit' : 'dead';
        level = state === 'lit' ? 1 : 0;
        timer = span(state === 'lit' ? litRange : deadRange);
      }
    }
    return level;
  };
}

/*
 * classic red neon open sign in a blue border, facing outward.
 */
function makeOpenSign() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#07070c';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#3d5bff';
  ctx.lineWidth = 7;
  ctx.shadowColor = '#3d5bff';
  ctx.shadowBlur = 12;
  ctx.strokeRect(12, 12, 232, 104);
  ctx.shadowColor = '#ff2b39';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#ff4b57';
  ctx.font = 'bold 64px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('OPEN', 128, 68);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.45),
    new THREE.MeshStandardMaterial({
      map: texture, emissive: '#ffffff', emissiveMap: texture,
      emissiveIntensity: 0.9, side: THREE.DoubleSide, roughness: 0.6,
    }),
  );
}

/*
 * glowing neon text for the far shopfronts. when brokenIndex names a
 * character, that letter is drawn on its own registered overlay so it
 * can flicker independently of the rest of the sign.
 * returns { group, brokenMat } (brokenMat null when nothing is broken).
 */
function makeNeonSign(text, colour, planeWidth = 3.4, brokenIndex = -1) {
  // one layout pass shared by both layers so the letters register
  const measure = document.createElement('canvas').getContext('2d');
  let font = 'bold 72px Arial, sans-serif';
  measure.font = font;
  const fit = measure.measureText(text).width;
  if (fit > 472) {
    font = `bold ${Math.floor(72 * 472 / fit)}px Arial, sans-serif`;
    measure.font = font;
  }
  const startX = (512 - measure.measureText(text).width) / 2;

  const drawLayer = (wanted) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = colour;
    ctx.shadowBlur = 18;
    ctx.fillStyle = colour;
    let x = startX;
    for (let i = 0; i < text.length; i++) {
      if (wanted(i)) ctx.fillText(text[i], x, 68);
      x += ctx.measureText(text[i]).width;
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: texture, emissive: '#ffffff', emissiveMap: texture,
      emissiveIntensity: 0.8, transparent: true, roughness: 0.6,
    });
  };

  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(planeWidth, planeWidth / 4);
  const steady = new THREE.Mesh(geo, drawLayer(i => i !== brokenIndex));
  group.add(steady);

  let brokenMat = null;
  if (brokenIndex >= 0) {
    brokenMat = drawLayer(i => i === brokenIndex);
    const broken = new THREE.Mesh(geo, brokenMat);
    broken.position.z = 0.005;
    group.add(broken);
  }

  return { group, brokenMat };
}

/*
 * low-poly 90s saloon car, parked.
 */
function makeCar(colour, x, z) {
  const car = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.35, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.52, 4.3), paint);
  body.position.y = 0.52;
  car.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.5, 2.1),
    new THREE.MeshStandardMaterial({ color: '#10141c', roughness: 0.2, metalness: 0.3 }),
  );
  cabin.position.set(0, 1.0, 0.25);
  car.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#0c0c0e', roughness: 0.9 });
  for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.4], [0.85, -1.4]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(wx, 0.32, wz);
    car.add(wheel);
  }
  car.position.set(x, 0, z);
  return car;
}
