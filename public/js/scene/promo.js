/*
 * promo.js — entrance promotion dressing: a-frame sandwich boards
 * showing the newest releases, a popcorn cart and soda machine by the
 * window, and a 90s cardboard standee shouting about 3-d glasses.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createJaws3D } from './jaws3d.js';

const HV_RED = '#d42027';
const HV_WHITE = '#f2f0ea';

/*
 * place all the entrance promo pieces for a room. posterItems supplies
 * artwork for the a-frames (newest releases first).
 * returns { group, collisionBoxes }.
 */
export function createPromoDisplays(scene, dims, posterItems = []) {
  const { width, depth } = dims;
  const cx = dims.cx ?? 0;
  const cz = dims.cz ?? 0;
  const frontZ = cz + depth / 2;
  const group = new THREE.Group();
  const collisionBoxes = [];
  const updates = [];

  const add = (piece) => {
    group.add(piece.group);
    collisionBoxes.push(...piece.collisionBoxes);
    if (piece.update) updates.push(piece.update);
  };

  // a-frames flanking the doors, angled to greet the walkway
  add(makeAFrame(posterItems[0], 'NEW RELEASE',
    new THREE.Vector3(cx - 3.3, 0, frontZ - 2.1), 0.5));
  add(makeAFrame(posterItems[1], '99c RENTAL',
    new THREE.Vector3(cx + 3.3, 0, frontZ - 2.1), -0.5));

  // concession corner against the front wall, right of the glass
  add(makePopcornCart(new THREE.Vector3(cx + 6.6, 0, frontZ - 1.2), Math.PI));
  add(makeSodaMachine(new THREE.Vector3(cx + 8.4, 0, frontZ - 1.05), Math.PI));

  // jaws 3-d display takes the prime spot left of the doors: the
  // shark lunges out of its own poster over the walkway
  add(createJaws3D(new THREE.Vector3(cx - 6.6, 0, frontZ - 1.5), 2.75));

  // cardboard 3-d glasses standee further along, leaning back a touch
  add(make3DStandee(new THREE.Vector3(cx - 10.2, 0, frontZ - 1.3), 2.65));

  group.traverse(o => { o.updateMatrix(); o.matrixAutoUpdate = false; });
  scene.add(group);
  return {
    group,
    collisionBoxes,
    update(dt) { for (const u of updates) u(dt); },
  };
}

/*
 * sandwich board: two leaning faces, each a header strip over a film
 * poster, on simple feet.
 */
function makeAFrame(item, header, position, rotationY) {
  const group = new THREE.Group();
  const lean = 0.16;
  const boardGeo = new THREE.BoxGeometry(0.9, 1.2, 0.03);
  const boardMat = new THREE.MeshStandardMaterial({ color: '#20232c', roughness: 0.7 });
  const headerTex = textTexture(header, HV_WHITE, HV_RED, 512, 96);
  const stripGeo = new THREE.PlaneGeometry(0.82, 0.18);
  const stripMat = new THREE.MeshStandardMaterial({
    map: headerTex, emissive: '#ffffff', emissiveMap: headerTex,
    emissiveIntensity: 0.3, roughness: 0.6,
  });
  const posterGeo = new THREE.PlaneGeometry(0.78, 0.86);
  // one material and one texture fetch shared by both faces — and a
  // sized variant, not the full-resolution master
  const posterMat = new THREE.MeshStandardMaterial({ color: '#161820', roughness: 0.6 });
  if (item?.thumb) {
    new THREE.TextureLoader().load(`${item.thumb}&width=512`, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      posterMat.map = texture;
      posterMat.color.set('#ffffff');
      posterMat.needsUpdate = true;
    });
  }

  for (const side of [1, -1]) {
    const face = new THREE.Group();
    const board = new THREE.Mesh(boardGeo, boardMat);
    face.add(board);

    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(0, 0.46, 0.017);
    face.add(strip);

    const poster = new THREE.Mesh(posterGeo, posterMat);
    poster.position.set(0, -0.1, 0.017);
    face.add(poster);

    face.position.set(0, 0.68, side * 0.13);
    face.rotation.x = -side * lean;
    if (side < 0) face.rotation.y = Math.PI;
    group.add(face);
  }

  // feet keeping the A standing
  const footGeo = new THREE.BoxGeometry(0.05, 0.05, 0.5);
  const footMat = new THREE.MeshStandardMaterial({ color: '#16181f', roughness: 0.8 });
  for (const x of [-0.4, 0.4]) {
    const foot = new THREE.Mesh(footGeo, footMat);
    foot.position.set(x, 0.025, 0);
    group.add(foot);
  }

  return finishPiece(group, position, rotationY, 1.0, 1.35, 0.7);
}

/*
 * theatre popcorn machine: red cabinet, glass case on aluminium corner
 * posts, stainless kettle hanging under a striped canopy, and a warm
 * mound of popcorn glowing under the warmer lamp.
 */
function makePopcornCart(position, rotationY) {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({
    color: '#b9bcc2', roughness: 0.3, metalness: 0.8,
  });

  // red base cabinet with a recessed door panel and a scoop tray
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.8, 0.7),
    new THREE.MeshStandardMaterial({ color: HV_RED, roughness: 0.5 }),
  );
  base.position.y = 0.4;
  group.add(base);
  const doorPanel = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.5, 0.03),
    new THREE.MeshStandardMaterial({ color: '#a3161c', roughness: 0.6 }),
  );
  doorPanel.position.set(0, 0.38, 0.355);
  group.add(doorPanel);
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.16), steel);
  tray.position.set(0, 0.72, 0.42);
  group.add(tray);

  // stainless counter between cabinet and case
  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.05, 0.76), steel);
  counter.position.y = 0.825;
  group.add(counter);

  // glass case on aluminium corner posts
  const caseH = 0.72;
  const caseY = 0.85 + caseH / 2;
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1.04, caseH, 0.64),
    new THREE.MeshPhysicalMaterial({
      color: '#cfe0dd', transparent: true, opacity: 0.15,
      roughness: 0.06, side: THREE.DoubleSide,
    }),
  );
  glass.position.y = caseY;
  group.add(glass);
  const postGeo = new THREE.BoxGeometry(0.05, caseH, 0.05);
  for (const [px, pz] of [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]]) {
    const post = new THREE.Mesh(postGeo, steel);
    post.position.set(px, caseY, pz);
    group.add(post);
  }

  // kettle hanging in the top of the case: drum, lid, tilt handle
  const kettle = new THREE.Group();
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.18, 16), steel);
  kettle.add(drum);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 16), steel);
  lid.position.y = 0.1;
  kettle.add(lid);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8), steel);
  stack.position.y = 0.16;
  kettle.add(stack);
  const tilt = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8), steel);
  tilt.rotation.z = Math.PI / 2;
  tilt.position.set(0, 0.05, 0);
  kettle.add(tilt);
  // hanger rods up to the canopy
  for (const hx of [-0.12, 0.12]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.22, 6), steel);
    rod.position.set(hx, 0.2, 0);
    kettle.add(rod);
  }
  kettle.position.set(0, caseY + 0.12, 0);
  group.add(kettle);

  // popcorn mound heaped along the case floor, one merged mesh.
  // kernels are a couple of centimetres, so it takes a few hundred
  // stacked in shells to read as a proper heap
  const kernelGeos = [];
  for (let i = 0; i < 320; i++) {
    // deterministic scatter: golden-angle spiral over the case floor
    const a = i * 2.39996;
    const r = 0.47 * Math.sqrt(i / 320);
    const kx = Math.cos(a) * r;
    const kz = Math.sin(a) * r * 0.55;
    const mound = Math.max(0, 0.14 * (1 - r * 2)) + ((i * 7) % 4) * 0.012;
    const g = new THREE.SphereGeometry(0.012 + ((i * 5) % 4) * 0.004, 5, 4);
    g.translate(kx, 0.875 + mound, kz);
    kernelGeos.push(g);
  }
  const popcorn = new THREE.Mesh(
    mergeGeometries(kernelGeos),
    new THREE.MeshStandardMaterial({
      color: '#f5dfa0', emissive: '#8a6b30', emissiveIntensity: 0.3, roughness: 0.9,
    }),
  );
  group.add(popcorn);
  for (const g of kernelGeos) g.dispose();

  // warmer lamp glow inside the case
  const glow = new THREE.PointLight('#ffb545', 2.6, 2.6, 2);
  glow.position.set(0, caseY + 0.2, 0);
  group.add(glow);
  const lamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.04, 0.1),
    new THREE.MeshStandardMaterial({
      color: '#f4c46a', emissive: '#ffb545', emissiveIntensity: 1.4,
    }),
  );
  lamp.position.set(0, caseY + caseH / 2 - 0.05, 0.2);
  group.add(lamp);

  // striped canopy roof with the popcorn header
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(1.16, 0.1, 0.76),
    new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.6 }),
  );
  canopy.position.y = caseY + caseH / 2 + 0.05;
  group.add(canopy);
  const header = makeLabelPlane('HOT POPCORN', HV_WHITE, HV_RED);
  header.scale.set(1.0, 0.22, 1);
  header.position.set(0, caseY + caseH / 2 + 0.22, 0.32);
  group.add(header);

  return finishPiece(group, position, rotationY, 1.2, 1.95, 0.85);
}

/*
 * tall red soda machine with a glowing menu front and striped cups.
 */
function makeSodaMachine(position, rotationY) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.85, 0.7),
    new THREE.MeshStandardMaterial({ color: HV_RED, roughness: 0.45 }),
  );
  body.position.y = 0.925;
  group.add(body);

  const frontTex = textTexture('ICE COLD SODA', HV_WHITE, '#8f1218', 512, 160);
  const front = new THREE.Mesh(
    new THREE.PlaneGeometry(0.78, 0.5),
    new THREE.MeshStandardMaterial({
      map: frontTex, emissive: '#ffffff', emissiveMap: frontTex,
      emissiveIntensity: 0.55, roughness: 0.5,
    }),
  );
  front.position.set(0, 1.45, 0.355);
  group.add(front);

  // dispenser recess
  const recess = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.45, 0.06),
    new THREE.MeshStandardMaterial({ color: '#1a1216', roughness: 0.8 }),
  );
  recess.position.set(0, 0.75, 0.34);
  group.add(recess);

  // striped cups stacked on top
  const cupMat = new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.7 });
  for (const [x, h] of [[-0.22, 0.26], [0.02, 0.34], [0.24, 0.22]]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, h, 10), cupMat);
    cup.position.set(x, 1.85 + h / 2, 0.05);
    group.add(cup);
  }

  return finishPiece(group, position, rotationY, 1.0, 1.9, 0.8);
}

/*
 * cardboard standee: giant anaglyph glasses and a starburst yelling
 * about 3-d, propped up by a strut like real lobby cardboard.
 */
function make3DStandee(position, rotationY) {
  const group = new THREE.Group();

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 1.8),
    new THREE.MeshStandardMaterial({
      map: standeeTexture(), roughness: 0.75, side: THREE.DoubleSide,
    }),
  );
  face.position.y = 0.95;
  face.rotation.x = -0.07; // cardboard lean
  group.add(face);

  const strut = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 1.1, 0.03),
    new THREE.MeshStandardMaterial({ color: '#7d6a4e', roughness: 0.9 }),
  );
  strut.position.set(0, 0.55, -0.32);
  strut.rotation.x = 0.5;
  group.add(strut);

  return finishPiece(group, position, rotationY, 1.4, 1.9, 0.6);
}

/*
 * anchor a piece at its position and derive a world collision box.
 */
function finishPiece(group, position, rotationY, sizeX, sizeY, sizeZ) {
  group.position.copy(position);
  group.rotation.y = rotationY;
  group.updateMatrixWorld(true);
  const halfMax = Math.max(sizeX, sizeZ) / 2; // rotation-safe footprint
  const collisionBoxes = [new THREE.Box3(
    new THREE.Vector3(position.x - halfMax, 0, position.z - halfMax),
    new THREE.Vector3(position.x + halfMax, sizeY, position.z + halfMax),
  )];
  return { group, collisionBoxes };
}

/*
 * bold text strip texture.
 */
function textTexture(text, textColour, bgColour, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bgColour;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = textColour;
  ctx.lineWidth = 5;
  ctx.strokeRect(5, 5, w - 10, h - 10);
  ctx.fillStyle = textColour;
  ctx.font = `bold ${Math.floor(h * 0.5)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // shrink to fit long labels inside the border
  const maxW = w - 44;
  const measured = ctx.measureText(text).width;
  if (measured > maxW) {
    ctx.font = `bold ${Math.floor(h * 0.5 * maxW / measured)}px Arial, sans-serif`;
  }
  ctx.fillText(text, w / 2, h / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeLabelPlane(text, textColour, bgColour) {
  const texture = textTexture(text, textColour, bgColour, 512, 112);
  return new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({
      map: texture, emissive: '#ffffff', emissiveMap: texture,
      emissiveIntensity: 0.35, side: THREE.DoubleSide, roughness: 0.6,
    }),
  );
}

/*
 * red and white awning stripes for the popcorn cart and cups.
 */
function stripeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? HV_RED : HV_WHITE;
    ctx.fillRect(i * 32, 0, 32, 256);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/*
 * hand-drawn 90s advert: starburst, anaglyph glasses, shouty copy.
 */
function standeeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 680;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f4e434';
  ctx.fillRect(0, 0, 512, 680);

  // starburst
  ctx.fillStyle = HV_RED;
  ctx.save();
  ctx.translate(256, 180);
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const r = i % 2 === 0 ? 170 : 115;
    const a = (i / 24) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 66px Impact, Arial Black, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SEE IT IN', 256, 155);
  ctx.font = 'bold 96px Impact, Arial Black, sans-serif';
  ctx.fillText('3-D!', 256, 245);

  // anaglyph glasses: white card frame, red and cyan lenses
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(66, 380, 380, 108);
  ctx.fillStyle = '#0d0d12';
  ctx.fillRect(66, 380, 380, 16);
  ctx.fillStyle = '#e33124';
  ctx.fillRect(96, 408, 140, 66);
  ctx.fillStyle = '#20b8c9';
  ctx.fillRect(276, 408, 140, 66);
  // bridge and arms
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(236, 420, 40, 24);

  // shouty copy, shrunk to fit the card width
  const fitText = (text, y, colour, font, size) => {
    ctx.font = `bold ${size}px ${font}`;
    const measured = ctx.measureText(text).width;
    if (measured > 472) ctx.font = `bold ${Math.floor(size * 472 / measured)}px ${font}`;
    ctx.fillStyle = colour;
    ctx.fillText(text, 256, y);
  };
  fitText('THRILLS! CHILLS!', 560, '#0d0d12', 'Impact, Arial Black, sans-serif', 44);
  fitText('GLASSES FREE AT THE COUNTER', 620, HV_RED, 'Arial, sans-serif', 34);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
