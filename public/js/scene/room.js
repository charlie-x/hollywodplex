/*
 * room.js — hollywood video style store rooms.
 * builds a bright fluorescent-lit room at any position with optional
 * doorways cut into walls, and returns collision boxes for the walls.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

const ROOM_HEIGHT = 5;
const WALL_THICKNESS = 0.2;
const DOOR_HEIGHT = 3.2;

// hollywood video palette: white + red lettering, blue and red neon
// zigzag skyline, near-black fascia, gold stock banners
const HV_WHITE = '#ded9cd';
const HV_RED = '#d42027';
const HV_BLUE = '#1d3fbf';
const HV_BLACK = '#0d0d12';
const HV_NAVY = '#131c3a';
const HV_GOLD = '#f0c419';

/*
 * create a room. dims:
 *   width, depth        — room size
 *   cx, cz              — room centre in world space (default 0,0)
 *   marquee             — text for the back-wall marquee (null for none)
 *   doorways            — { back: [], front: [], left: [], right: [] },
 *                         each entry { offset, width } along the wall
 *   skipWalls           — wall names not to build (shared walls)
 *   mainLighting        — true adds the global light rig (one room only)
 */
export function createRoom(scene, dims = {}) {
  const width = dims.width ?? 44;
  const depth = dims.depth ?? 36;
  const cx = dims.cx ?? 0;
  const cz = dims.cz ?? 0;
  const doorways = dims.doorways ?? {};
  const skipWalls = new Set(dims.skipWalls ?? []);
  const dingy = dims.style === 'dingy';
  const group = new THREE.Group();
  const collisionBoxes = [];
  const ownedLights = []; // lights added straight to the scene, for dispose
  let bulbMesh = null;
  let update = null;

  // ---- floor: purple confetti carpet (bare dark floor when dingy) ----
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    dingy
      ? new THREE.MeshStandardMaterial({ color: '#171310', roughness: 0.85 })
      : new THREE.MeshStandardMaterial({ map: carpetTexture(), roughness: 0.8 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  floor.receiveShadow = true;
  group.add(floor);

  // ---- ceiling ----
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({
      color: dingy ? '#1a1512' : '#d6d2c8',
      roughness: 0.9,
    }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(cx, ROOM_HEIGHT, cz);
  group.add(ceiling);

  // fluorescent troffer grid — none in the dingy back room
  if (!dingy) {
    const trofferMat = new THREE.MeshStandardMaterial({
      color: '#f2efe6', emissive: '#fff2dd', emissiveIntensity: 0.85, roughness: 0.4,
    });
    const trofferGeos = [];
    for (let x = -width / 2 + 5; x <= width / 2 - 5; x += 6.5) {
      for (let z = -depth / 2 + 4; z <= depth / 2 - 4; z += 5.5) {
        const g = new THREE.BoxGeometry(2.4, 0.06, 1.1);
        g.translate(cx + x, ROOM_HEIGHT - 0.03, cz + z);
        trofferGeos.push(g);
      }
    }
    if (trofferGeos.length > 0) {
      const troffers = new THREE.Mesh(mergeGeometries(trofferGeos), trofferMat);
      group.add(troffers);
      for (const g of trofferGeos) g.dispose();
    }
  } else {
    // a single bare red bulb hanging from the ceiling
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 8),
      new THREE.MeshStandardMaterial({
        color: '#ff4444', emissive: '#ff2222', emissiveIntensity: 2.5,
      }),
    );
    bulb.position.set(cx, ROOM_HEIGHT - 0.5, cz);
    group.add(bulb);
    bulbMesh = bulb;
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.5),
      new THREE.MeshStandardMaterial({ color: '#111111' }),
    );
    cord.position.set(cx, ROOM_HEIGHT - 0.25, cz);
    group.add(cord);
  }

  // ---- walls with doorway openings ----
  // bright white store walls; grimy brown in the dingy back room
  const wallMat = new THREE.MeshStandardMaterial({
    color: dingy ? '#2a201a' : HV_WHITE,
    roughness: dingy ? 0.95 : 0.85,
  });
  const bandMat = new THREE.MeshStandardMaterial({
    color: HV_RED, emissive: HV_RED, emissiveIntensity: 0.6, roughness: 0.4,
  });
  const bandMatBlue = new THREE.MeshStandardMaterial({
    color: HV_BLUE, emissive: HV_BLUE, emissiveIntensity: 0.6, roughness: 0.4,
  });

  // each wall runs along an axis; doorway offsets measured from wall centre
  const wallSpecs = [
    { name: 'back', axis: 'x', length: width, fixed: cz - depth / 2, centre: cx },
    { name: 'front', axis: 'x', length: width, fixed: cz + depth / 2, centre: cx },
    { name: 'left', axis: 'z', length: depth, fixed: cx - width / 2, centre: cz },
    { name: 'right', axis: 'z', length: depth, fixed: cx + width / 2, centre: cz },
  ];

  for (const spec of wallSpecs) {
    if (skipWalls.has(spec.name)) continue;
    const doors = doorways[spec.name] ?? [];
    // no neon accent strips in the dingy back room
    buildWall(group, collisionBoxes, spec, doors, wallMat,
      dingy ? null : bandMat, dingy ? null : bandMatBlue);
  }

  // ---- marquee sign on the back wall ----
  if (dims.marquee !== null) {
    const sign = createMarqueeSign(dims.marquee ?? 'hollywoodplex');
    sign.position.set(cx, ROOM_HEIGHT - 0.85, cz - depth / 2 + WALL_THICKNESS / 2 + 0.05);
    group.add(sign);
  }

  // ---- lighting ----
  if (dims.mainLighting !== false) {
    createMainLighting(scene, cx, cz, width, depth, ownedLights);
  } else if (dingy) {
    // the back room: one dim red bulb with physical falloff, nothing else
    const red = new THREE.PointLight('#ff3322', 14, 0, 2);
    red.position.set(cx, ROOM_HEIGHT - 0.55, cz);
    scene.add(red);
    ownedLights.push(red);

    // the bulb never sits quite steady: a slow breathe with a mains
    // buzz on top, and the occasional sputter towards going out
    let t = Math.random() * 10;
    let sputter = 0;
    update = (dt) => {
      t += dt;
      let level = 0.86 + 0.1 * Math.sin(t * 1.7) + 0.04 * Math.sin(t * 13.3);
      if (sputter > 0) {
        sputter -= dt;
        level *= 0.45 + 0.3 * Math.abs(Math.sin(t * 60));
      } else if (Math.random() < dt * 0.35) {
        sputter = 0.08 + Math.random() * 0.25;
      }
      red.intensity = 14 * level;
      if (bulbMesh) bulbMesh.material.emissiveIntensity = 2.5 * level;
    };
  } else {
    // secondary rooms: overhead area lights matching the troffer grid
    RectAreaLightUniformsLib.init();
    for (const [ox, oz] of [[-width / 5, 0], [width / 5, 0]]) {
      const area = new THREE.RectAreaLight('#ffe8cc', 2, width / 2.4, depth / 2.4);
      area.position.set(cx + ox, ROOM_HEIGHT - 0.1, cz + oz);
      area.lookAt(cx + ox, 0, cz + oz);
      scene.add(area);
      ownedLights.push(area);
    }
  }

  scene.add(group);

  return {
    group,
    dimensions: { width, depth, height: ROOM_HEIGHT, cx, cz },
    collisionBoxes,
    update,
    dispose() {
      // the room's lights live on the scene, not in the group — they
      // must go too or a disposed room keeps lighting the world
      for (const light of ownedLights) scene.remove(light);
      scene.remove(group);
    },
  };
}

/*
 * build one wall as solid segments with door gaps and lintels.
 * segments give both visuals and collision boxes.
 */
function buildWall(group, collisionBoxes, spec, doors, wallMat, bandMat, bandMatBlue) {
  // door spans along the wall, sorted, in wall-local coordinates
  const spans = doors
    .map(d => [d.offset - d.width / 2, d.offset + d.width / 2])
    .sort((a, b) => a[0] - b[0]);

  // full-height segments between doors, plus lintels above openings
  const segments = [];
  let cursor = -spec.length / 2;
  for (const [start, end] of spans) {
    if (start > cursor) segments.push([cursor, start]);
    segments.push({ lintel: [start, end] });
    cursor = end;
  }
  if (cursor < spec.length / 2) segments.push([cursor, spec.length / 2]);

  for (const seg of segments) {
    const isLintel = !Array.isArray(seg);
    const [s, e] = isLintel ? seg.lintel : seg;
    const len = e - s;
    if (len <= 0.01) continue;

    const segCentre = spec.centre + (s + e) / 2;
    const h = isLintel ? ROOM_HEIGHT - DOOR_HEIGHT : ROOM_HEIGHT;
    const y = isLintel ? DOOR_HEIGHT + h / 2 : ROOM_HEIGHT / 2;

    let geo, px, pz, sizeX, sizeZ;
    if (spec.axis === 'x') {
      geo = new THREE.BoxGeometry(len, h, WALL_THICKNESS);
      px = segCentre; pz = spec.fixed;
      sizeX = len; sizeZ = WALL_THICKNESS;
    } else {
      geo = new THREE.BoxGeometry(WALL_THICKNESS, h, len);
      px = spec.fixed; pz = segCentre;
      sizeX = WALL_THICKNESS; sizeZ = len;
    }

    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.position.set(px, y, pz);
    mesh.receiveShadow = true;
    group.add(mesh);

    // collision only for full-height segments — doorways stay walkable
    if (!isLintel) {
      collisionBoxes.push(new THREE.Box3(
        new THREE.Vector3(px - sizeX / 2, 0, pz - sizeZ / 2),
        new THREE.Vector3(px + sizeX / 2, ROOM_HEIGHT, pz + sizeZ / 2),
      ));

      // red + blue neon strips on full segments, echoing the storefront
      if (bandMat && bandMatBlue) {
        const stripGeo = spec.axis === 'x'
          ? new THREE.BoxGeometry(len, 0.12, WALL_THICKNESS + 0.02)
          : new THREE.BoxGeometry(WALL_THICKNESS + 0.02, 0.12, len);
        const redStrip = new THREE.Mesh(stripGeo, bandMat);
        redStrip.position.set(px, 3.75, pz);
        group.add(redStrip);
        const blueStrip = new THREE.Mesh(stripGeo, bandMatBlue);
        blueStrip.position.set(px, 3.5, pz);
        group.add(blueStrip);
      }
    }
  }
}

/*
 * procedural confetti carpet texture in hollywood video purple.
 */
function carpetTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = HV_NAVY;
  ctx.fillRect(0, 0, 512, 512);

  const speckles = [HV_RED, HV_BLUE, HV_GOLD, '#42c9a0', '#e8e8e4'];
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = speckles[Math.floor(Math.random() * speckles.length)];
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const s = 1.5 + Math.random() * 3;
    ctx.globalAlpha = 0.35 + Math.random() * 0.3;
    ctx.beginPath();
    ctx.ellipse(x, y, s, s * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/*
 * hollywood video style marquee: white channel letters with the last
 * word in red, under a blue and red neon zigzag skyline, on black.
 */
function createMarqueeSign(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');

  // near-black fascia
  ctx.fillStyle = HV_BLACK;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // neon zigzag skyline — blue line with a red echo above the lettering
  const zig = (offsetY, colour) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = 6;
    ctx.shadowColor = colour;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    let up = true;
    for (let x = 20; x <= canvas.width - 20; x += 82) {
      const y = offsetY + (up ? 0 : 34);
      if (x === 20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      up = !up;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  };
  zig(28, HV_RED);
  zig(46, HV_BLUE);

  // split the name: leading part in white, final four letters in red
  // (mirrors the hollywood VIDEO treatment)
  const label = text.toUpperCase();
  const splitAt = Math.max(1, label.length - 4);
  const head = label.slice(0, splitAt);
  const tail = label.slice(splitAt);

  ctx.font = 'bold 118px Impact, Arial Black, sans-serif';
  ctx.textBaseline = 'middle';
  const headW = ctx.measureText(head).width;
  const tailW = ctx.measureText(tail).width;
  const startX = (canvas.width - headW - tailW - 12) / 2;
  const textY = 195;

  ctx.shadowColor = 'rgba(255,255,255,0.7)';
  ctx.shadowBlur = 16;
  ctx.fillStyle = HV_WHITE;
  ctx.fillText(head, startX, textY);

  ctx.shadowColor = HV_RED;
  ctx.shadowBlur = 16;
  ctx.fillStyle = HV_RED;
  ctx.fillText(tail, startX + headW + 12, textY);
  ctx.shadowBlur = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return new THREE.Mesh(
    new THREE.PlaneGeometry(10, 2.9),
    new THREE.MeshStandardMaterial({
      map: texture,
      emissive: '#ffffff',
      emissiveMap: texture,
      emissiveIntensity: 0.7,
      roughness: 0.6,
    }),
  );
}

/*
 * mall video store lighting: a grid of overhead area lights standing in
 * for the fluorescent troffers (soft, downward, physical falloff), a low
 * ambient floor so shadowed areas stay readable, and one shadow-casting
 * key light for directional depth. speculars come from the environment
 * map set up in scene-manager.
 */
function createMainLighting(scene, cx, cz, width, depth, ownedLights = []) {
  // low ambient — just enough that nothing crushes to black
  const ambient = new THREE.AmbientLight('#e8e8ff', 0.14);
  scene.add(ambient);
  ownedLights.push(ambient);

  // faint sky/ground bounce: white ceiling above, carpet tone below
  const hemi = new THREE.HemisphereLight('#f4f2ec', '#242c52', 0.15);
  scene.add(hemi);
  ownedLights.push(hemi);

  // overhead fluorescent banks as area lights, 3 x 2 grid.
  // rect area lights have true physical falloff and soft pooling,
  // which is what gives the aisles depth instead of uniform flatness.
  // intensities are modest — these panels are huge, so a little goes
  // a long way before everything blows out to white
  RectAreaLightUniformsLib.init();
  const cols = 3;
  const rows = 2;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = cx + (i - (cols - 1) / 2) * (width / cols);
      const z = cz + (j - (rows - 1) / 2) * (depth / rows);
      const area = new THREE.RectAreaLight('#ffe8cc', 2.1, width / cols - 2, depth / rows - 2);
      area.position.set(x, ROOM_HEIGHT - 0.1, z);
      area.lookAt(x, 0, z);
      scene.add(area);
      ownedLights.push(area);
    }
  }

  // one shadow-casting key light angled like the strongest bank,
  // for the directional shadows area lights cannot produce
  const keyLight = new THREE.DirectionalLight('#fff6e0', 0.35);
  keyLight.position.set(cx + 6, ROOM_HEIGHT + 4, cz + depth / 4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 80;
  keyLight.shadow.camera.left = -width;
  keyLight.shadow.camera.right = width;
  keyLight.shadow.camera.top = depth;
  keyLight.shadow.camera.bottom = -depth;
  keyLight.shadow.bias = -0.0001;
  scene.add(keyLight);
  ownedLights.push(keyLight);
}
