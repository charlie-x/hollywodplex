/*
 * signage.js — hollywood video style category signs.
 * deep purple boards with bold white text and a gold border,
 * hung from the ceiling above each genre aisle.
 */

import * as THREE from 'three';

const HV_NAVY = '#131c3a';
const HV_RED = '#d42027';

/*
 * create a category sign. the accent colour tints a thin strip along
 * the bottom so each genre keeps its shelf colour cue.
 * opts.hanging (default true) adds ceiling rods and a hang offset;
 * pass false for wall-mounted signs (e.g. above doorways).
 * opts.rotationY rotates the whole sign (wall-mounted signs need to
 * face along the wall's normal).
 */
export function createSign(text, position, accentColour = HV_RED, opts = {}) {
  const { hanging = true, rotationY = 0, topper = false } = opts;
  const group = new THREE.Group();

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');

  // navy board with rounded corners
  ctx.fillStyle = HV_NAVY;
  roundRect(ctx, 4, 4, canvas.width - 8, canvas.height - 8, 18);
  ctx.fill();

  // red border inset — hollywood video lettering red
  ctx.strokeStyle = HV_RED;
  ctx.lineWidth = 6;
  roundRect(ctx, 12, 12, canvas.width - 24, canvas.height - 24, 12);
  ctx.stroke();

  // category text in bold white, auto-sized to fit inside the border
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = text.toUpperCase();
  const maxWidth = canvas.width - 72; // clear of the border inset
  let fontSize = 64;
  do {
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    if (ctx.measureText(label).width <= maxWidth) break;
    fontSize -= 4;
  } while (fontSize > 24);
  ctx.fillText(label, canvas.width / 2, canvas.height / 2 - 10);

  // genre accent strip along the bottom
  ctx.fillStyle = accentColour;
  ctx.fillRect(24, canvas.height - 36, canvas.width - 48, 12);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    emissive: '#ffffff',
    emissiveMap: texture,
    emissiveIntensity: 0.3,
    roughness: 0.6,
  });

  // two single-sided boards back-to-back so text reads correctly
  // from both directions (a doublesided plane mirrors the reverse).
  // toppers sit on the rack, so they use a smaller board.
  const boardGeo = topper
    ? new THREE.PlaneGeometry(1.8, 0.55)
    : new THREE.PlaneGeometry(2.4, 0.75);
  const boardY = topper ? 0.3 : 0;
  const front = new THREE.Mesh(boardGeo, material);
  front.position.set(0, boardY, 0.005);
  group.add(front);

  const back = new THREE.Mesh(boardGeo, material);
  back.position.set(0, boardY, -0.005);
  back.rotation.y = Math.PI;
  group.add(back);

  if (topper) {
    // two stubby feet standing the board on the rack top
    const footMat = new THREE.MeshStandardMaterial({ color: '#999999', roughness: 0.4, metalness: 0.6 });
    const footGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.14);
    for (const fx of [-0.6, 0.6]) {
      const foot = new THREE.Mesh(footGeo, footMat);
      foot.position.set(fx, 0.07, 0);
      group.add(foot);
    }
  } else if (hanging) {
    // two thin hanging rods up to the ceiling
    const rodMat = new THREE.MeshStandardMaterial({ color: '#999999', roughness: 0.4, metalness: 0.6 });
    const rodGeo = new THREE.CylinderGeometry(0.012, 0.012, 1.4);
    for (const rx of [-0.9, 0.9]) {
      const rod = new THREE.Mesh(rodGeo, rodMat);
      rod.position.set(rx, 1.05, 0);
      group.add(rod);
    }
  }

  group.position.set(position.x, position.y + (hanging && !topper ? 1.0 : 0), position.z);
  group.rotation.y = rotationY;

  // static — freeze matrices
  group.traverse(o => { o.updateMatrix(); o.matrixAutoUpdate = false; });
  group.updateMatrix();
  group.matrixAutoUpdate = false;

  return group;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
