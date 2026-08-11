/*
 * checkout.js — the front counter: branded fascia, crt till with a
 * glowing rental screen, scanner, cash drawer, returned tape stack,
 * candy rack for impulse buys, and the returns bin with a slot lid.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeTextPlane } from './decor.js';

const HV_NAVY = '#131c3a';
const HV_RED = '#d42027';
const HV_BLUE = '#1d3fbf';
const HV_WHITE = '#f2f0ea';

/*
 * checkout counter. returns { group, collisionBoxes }.
 */
export function createCheckoutCounter(position, rotationY = 0) {
  const group = new THREE.Group();

  // ---- counter body: navy with a branded fascia and white top ----
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 1.05, 0.75),
    new THREE.MeshStandardMaterial({ color: HV_NAVY, roughness: 0.7 }),
  );
  body.position.y = 0.525;
  body.castShadow = true;
  group.add(body);

  const fascia = new THREE.Mesh(
    new THREE.PlaneGeometry(3.5, 0.85),
    new THREE.MeshStandardMaterial({
      map: fasciaTexture(), emissive: '#ffffff',
      emissiveMap: fasciaTexture(), emissiveIntensity: 0.15, roughness: 0.6,
    }),
  );
  fascia.position.set(0, 0.58, 0.38);
  group.add(fascia);

  const kick = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.12, 0.06),
    new THREE.MeshStandardMaterial({ color: '#0a0d18', roughness: 0.8 }),
  );
  kick.position.set(0, 0.06, 0.36);
  group.add(kick);

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.06, 0.9),
    new THREE.MeshStandardMaterial({ color: HV_WHITE, roughness: 0.3 }),
  );
  top.position.y = 1.08;
  group.add(top);

  // ---- till: crt monitor, keyboard, cash drawer, receipt printer ----
  const crtMat = new THREE.MeshStandardMaterial({ color: '#c9c4b4', roughness: 0.6 });
  const crt = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.36, 0.38), crtMat);
  crt.position.set(-1.1, 1.4, -0.08);
  crt.rotation.y = 0.35; // angled towards the clerk's spot
  group.add(crt);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.24),
    new THREE.MeshStandardMaterial({
      map: crtScreenTexture(), emissive: '#ffffff',
      emissiveMap: crtScreenTexture(), emissiveIntensity: 0.9, roughness: 0.4,
    }),
  );
  screen.position.set(-1.03, 1.41, 0.115);
  screen.rotation.y = 0.35;
  group.add(screen);

  const keyboard = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.03, 0.16),
    new THREE.MeshStandardMaterial({ color: '#8f8b7e', roughness: 0.7 }),
  );
  keyboard.position.set(-1.05, 1.13, 0.22);
  keyboard.rotation.y = 0.3;
  group.add(keyboard);

  const drawer = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.14, 0.45),
    new THREE.MeshStandardMaterial({ color: '#2a2a30', roughness: 0.5, metalness: 0.3 }),
  );
  drawer.position.set(-1.1, 1.18, -0.12);
  group.add(drawer);

  const printer = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.1, 0.2),
    new THREE.MeshStandardMaterial({ color: '#3a3a40', roughness: 0.6 }),
  );
  printer.position.set(-0.62, 1.16, -0.15);
  group.add(printer);
  const receipt = new THREE.Mesh(
    new THREE.PlaneGeometry(0.08, 0.14),
    new THREE.MeshStandardMaterial({ color: '#f6f4ea', roughness: 0.9, side: THREE.DoubleSide }),
  );
  receipt.position.set(-0.62, 1.28, -0.13);
  receipt.rotation.x = -0.4; // curling out of the printer
  group.add(receipt);

  // ---- barcode scanner on a stand, red light strip ----
  const scanBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.07, 0.16, 10),
    new THREE.MeshStandardMaterial({ color: '#26262c', roughness: 0.6 }),
  );
  scanBase.position.set(-0.3, 1.19, 0.1);
  group.add(scanBase);
  const scanHead = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.1, 0.12),
    new THREE.MeshStandardMaterial({ color: '#1a1a20', roughness: 0.5 }),
  );
  scanHead.position.set(-0.3, 1.32, 0.1);
  scanHead.rotation.x = 0.5;
  group.add(scanHead);
  const scanLight = new THREE.Mesh(
    new THREE.PlaneGeometry(0.06, 0.012),
    new THREE.MeshStandardMaterial({
      color: '#ff2222', emissive: '#ff2222', emissiveIntensity: 1.6,
    }),
  );
  scanLight.position.set(-0.3, 1.34, 0.168);
  scanLight.rotation.x = 0.5;
  group.add(scanLight);

  // ---- stack of returned tapes waiting to be shelved ----
  const spineColours = [HV_RED, HV_BLUE, '#42c9a0', '#f0c419', '#8a5aa8'];
  for (let i = 0; i < 5; i++) {
    const tape = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.032, 0.3),
      new THREE.MeshStandardMaterial({ color: '#15151d', roughness: 0.6 }),
    );
    tape.add(shell);
    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.012, 0.03),
      new THREE.MeshStandardMaterial({ color: spineColours[i], roughness: 0.6 }),
    );
    spine.position.set(0, 0, 0.155);
    tape.add(spine);
    tape.position.set(0.55, 1.13 + i * 0.034, 0.05);
    tape.rotation.y = ((i * 13) % 5 - 2) * 0.09; // untidy pile
    group.add(tape);
  }

  // ---- desk clutter: pen cup and a membership tent card ----
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.035, 0.1, 10),
    new THREE.MeshStandardMaterial({ color: HV_RED, roughness: 0.7 }),
  );
  cup.position.set(0.05, 1.16, -0.22);
  group.add(cup);
  const penGeos = [];
  for (const [dx, tilt] of [[-0.012, 0.12], [0.014, -0.18]]) {
    const g = new THREE.CylinderGeometry(0.004, 0.004, 0.14, 6);
    g.rotateZ(tilt);
    g.translate(0.05 + dx, 1.24, -0.22);
    penGeos.push(g);
  }
  group.add(new THREE.Mesh(
    mergeGeometries(penGeos),
    new THREE.MeshStandardMaterial({ color: '#22262e', roughness: 0.5 }),
  ));
  for (const g of penGeos) g.dispose();

  const tent = makeTextPlane('FREE MEMBERSHIP', HV_WHITE, HV_RED, 512, 96);
  tent.scale.set(0.42, 0.1, 1);
  tent.position.set(1.15, 1.17, 0.18);
  tent.rotation.x = -0.25;
  group.add(tent);

  // ---- candy rack on the queue side ----
  const rack = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.5, 0.16),
    new THREE.MeshStandardMaterial({ color: '#1a2038', roughness: 0.7 }),
  );
  rack.position.set(1.45, 0.62, 0.44);
  group.add(rack);
  const sweetColours = ['#e0342c', '#f2a614', '#3ba448', '#2a6fd4', '#c2452e', '#e8d84a'];
  const sweetGeos = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const g = new THREE.BoxGeometry(0.13, 0.1, 0.03);
      g.translate(1.13 + col * 0.16, 0.46 + row * 0.15, 0.53);
      sweetGeos.push(g);
    }
  }
  // one merged mesh, coloured per box via vertex groups is overkill —
  // alternate materials across three meshes instead
  for (let m = 0; m < 3; m++) {
    const subset = sweetGeos.filter((_, i) => i % 3 === m);
    group.add(new THREE.Mesh(
      mergeGeometries(subset),
      new THREE.MeshStandardMaterial({ color: sweetColours[m * 2], roughness: 0.6 }),
    ));
  }
  for (const g of sweetGeos) g.dispose();

  // ---- returns bin with a slot lid ----
  const bin = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.8, 0.7),
    new THREE.MeshStandardMaterial({ color: HV_RED, roughness: 0.6 }),
  );
  bin.position.set(2.45, 0.4, 0);
  group.add(bin);
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(0.74, 0.05, 0.74),
    new THREE.MeshStandardMaterial({ color: '#8f1218', roughness: 0.6 }),
  );
  lid.position.set(2.45, 0.83, 0);
  lid.rotation.z = -0.12;
  group.add(lid);
  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.025, 0.1),
    new THREE.MeshStandardMaterial({ color: '#0a0a0c', roughness: 0.9 }),
  );
  slot.position.set(2.45, 0.86, 0);
  slot.rotation.z = -0.12;
  group.add(slot);
  const binLabel = makeTextPlane('RETURNS', HV_WHITE, HV_RED, 256, 64);
  binLabel.scale.set(0.6, 0.15, 1);
  binLabel.position.set(2.45, 0.55, 0.36);
  group.add(binLabel);

  group.position.copy(position);
  group.rotation.y = rotationY;
  group.updateMatrixWorld(true);

  // collision boxes in world space
  const collisionBoxes = [
    new THREE.Box3().setFromObject(body),
    new THREE.Box3().setFromObject(bin),
    new THREE.Box3().setFromObject(rack),
  ];

  group.traverse(o => { o.updateMatrix(); o.matrixAutoUpdate = false; });

  return { group, collisionBoxes };
}

/*
 * navy fascia with the red and blue neon zigzag and checkout lettering.
 */
function fasciaTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = HV_NAVY;
  ctx.fillRect(0, 0, 1024, 256);

  const zig = (offsetY, colour) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = 5;
    ctx.shadowColor = colour;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    let up = true;
    for (let x = 16; x <= 1008; x += 64) {
      const y = offsetY + (up ? 0 : 22);
      if (x === 16) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      up = !up;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  };
  zig(36, HV_RED);
  zig(52, HV_BLUE);

  ctx.fillStyle = HV_WHITE;
  ctx.font = 'bold 96px Impact, Arial Black, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CHECKOUT', 512, 190);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/*
 * green phosphor rental terminal screen.
 */
function crtScreenTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 200;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#03140a';
  ctx.fillRect(0, 0, 256, 200);
  ctx.fillStyle = '#37e07a';
  ctx.font = 'bold 17px monospace';
  const lines = [
    'HOLLYWOODPLEX POS v2.4',
    '----------------------',
    'MEMBER: 40027 GOOD',
    '1x NEW RELEASE  $2.99',
    '1x CATALOGUE    $0.99',
    'DUE BACK: THURSDAY',
    '',
    'TOTAL:          $3.98',
  ];
  lines.forEach((l, i) => ctx.fillText(l, 10, 24 + i * 21));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
