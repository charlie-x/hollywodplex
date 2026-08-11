/*
 * decor.js — store atmosphere: checkout counter, framed wall posters
 * from the library's own artwork, and gold stock banners.
 */

import * as THREE from 'three';

const HV_NAVY = '#131c3a';
const HV_RED = '#d42027';
const HV_GOLD = '#f0c419';
const HV_WHITE = '#f2f0ea';

/*
 * framed posters high on the walls using the library's own artwork.
 * items should have thumb urls; textures load once and stay resident.
 */
export function createWallPosters(scene, roomDims, items, count = 8, opts = {}) {
  const { width, depth, cx, cz } = roomDims;
  // clear half-width kept free in the middle of the entrance wall,
  // e.g. for the glass storefront
  const frontClear = opts.frontClear ?? 0;
  // keep-out zones along the entrance wall, e.g. behind zoltar
  const frontExclude = opts.frontExclude ?? [];
  const excluded = (x) => frontExclude.some(z => Math.abs(x - z.x) < z.halfWidth);
  const group = new THREE.Group();
  const loader = new THREE.TextureLoader();

  const picks = items.filter(i => i.thumb).slice(0, count);
  if (picks.length === 0) return group;

  // posters at eye level on the blank walls (the entrance wall and the
  // strip under the marquee have no shelving); the shelved side and
  // back walls take theirs just above the shelf line instead
  const spots = [];
  const EYE_Y = 1.9;
  const HIGH_Y = 3.95; // clears the 3.3m wall shelving, well off the ceiling

  // entrance wall: an eye-level row facing into the store, split
  // either side of the glass storefront when one is present
  const frontCount = Math.min(7, Math.ceil(count / 2));
  if (frontClear > 0) {
    const ranges = [
      [cx - width / 2 + 2, cx - frontClear],
      [cx + frontClear, cx + width / 2 - 2],
    ];
    const perSide = Math.ceil(frontCount / 2);
    for (let i = 0; i < frontCount; i++) {
      const [a, b] = ranges[i % 2];
      const x = a + (Math.floor(i / 2) + 0.5) * ((b - a) / perSide);
      if (excluded(x)) continue;
      spots.push({ x, y: EYE_Y, z: cz + depth / 2 - 0.18, ry: Math.PI });
    }
  } else {
    for (let i = 0; i < frontCount; i++) {
      const x = cx - width / 3 + (i + 0.5) * (width / 1.5 / frontCount);
      if (excluded(x)) continue;
      spots.push({ x, y: EYE_Y, z: cz + depth / 2 - 0.18, ry: Math.PI });
    }
  }

  // under the marquee: the back wall centre keeps clear of shelving
  for (const x of [-3.6, 0, 3.6]) {
    spots.push({ x: cx + x, y: EYE_Y, z: cz - depth / 2 + 0.18, ry: 0 });
  }

  // shelved walls: above the shelf line
  const sideCount = Math.max(2, Math.ceil((count - spots.length) / 2));
  for (let i = 0; i < sideCount; i++) {
    const z = cz - depth / 3 + (i + 0.5) * (depth / 1.5 / sideCount);
    spots.push({ x: cx - width / 2 + 0.18, y: HIGH_Y, z, ry: Math.PI / 2 });
    spots.push({ x: cx + width / 2 - 0.18, y: HIGH_Y, z, ry: -Math.PI / 2 });
  }

  const frameMat = new THREE.MeshStandardMaterial({ color: '#101014', roughness: 0.5 });
  const frameGeo = new THREE.BoxGeometry(1.16, 1.66, 0.05);
  const posterGeo = new THREE.PlaneGeometry(1.05, 1.55);

  picks.forEach((item, i) => {
    const spot = spots[i % spots.length];
    const holder = new THREE.Group();

    const frame = new THREE.Mesh(frameGeo, frameMat);
    holder.add(frame);

    const posterMat = new THREE.MeshStandardMaterial({ color: '#1a1a22', roughness: 0.6 });
    const poster = new THREE.Mesh(posterGeo, posterMat);
    poster.position.z = 0.03;
    holder.add(poster);

    // wall posters are few and permanent — load outside the lru cache
    loader.load(item.thumb, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      posterMat.map = texture;
      posterMat.color.set('#ffffff');
      posterMat.needsUpdate = true;
    });

    holder.position.set(spot.x, spot.y, spot.z);
    holder.rotation.y = spot.ry;
    holder.traverse(o => { o.updateMatrix(); o.matrixAutoUpdate = false; });
    holder.updateMatrix();
    holder.matrixAutoUpdate = false;
    group.add(holder);
  });

  scene.add(group);
  return group;
}

/*
 * long gold "guaranteed in stock" banner, hung over the entrance.
 * two single-sided faces back-to-back so the text reads correctly
 * from both directions instead of mirroring on the reverse.
 */
export function createStockBanner(position) {
  const group = new THREE.Group();

  const front = makeTextPlane('* GUARANTEED IN STOCK *', HV_RED, HV_GOLD, 1024, 96);
  front.material.side = THREE.FrontSide;
  front.scale.set(7, 0.55, 1);
  front.position.z = 0.01;
  group.add(front);

  const back = new THREE.Mesh(front.geometry, front.material);
  back.scale.set(7, 0.55, 1);
  back.position.z = -0.01;
  back.rotation.y = Math.PI;
  group.add(back);

  group.position.copy(position);
  group.traverse(o => { o.updateMatrix(); o.matrixAutoUpdate = false; });
  group.updateMatrix();
  group.matrixAutoUpdate = false;
  return group;
}

/*
 * bead curtain for the back room doorway: hanging strips from the
 * lintel, alternating dark reds, walk-through (no collision).
 */
export function createCurtain(position, doorWidth = 2, rotationY = 0) {
  const group = new THREE.Group();
  const colours = ['#5a1015', '#3a0a0e', '#6e1a20'];
  const stripCount = Math.floor(doorWidth / 0.09);
  const stripGeo = new THREE.BoxGeometry(0.07, 2.2, 0.015);

  for (let i = 0; i < stripCount; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: colours[i % colours.length],
      roughness: 0.9,
    });
    const strip = new THREE.Mesh(stripGeo, mat);
    // hang from the lintel with slight stagger so it reads as loose strips
    strip.position.set(
      -doorWidth / 2 + 0.06 + i * 0.09,
      3.2 - 1.1 - (i % 3) * 0.05,
      (i % 2) * 0.02,
    );
    strip.rotation.z = ((i % 5) - 2) * 0.015;
    group.add(strip);
  }

  group.position.copy(position);
  group.rotation.y = rotationY;
  group.traverse(o => { o.updateMatrix(); o.matrixAutoUpdate = false; });
  group.updateMatrix();
  group.matrixAutoUpdate = false;
  return group;
}

/*
 * simple double-sided text plane helper (also used by checkout.js).
 */
export function makeTextPlane(text, textColour, bgColour, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bgColour;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = textColour;
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, w - 8, h - 8);
  ctx.fillStyle = textColour;
  ctx.font = `bold ${Math.floor(h * 0.55)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({
      map: texture,
      emissive: '#ffffff',
      emissiveMap: texture,
      emissiveIntensity: 0.25,
      side: THREE.DoubleSide,
      roughness: 0.6,
    }),
  );
}
