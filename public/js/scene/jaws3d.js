/*
 * jaws3d.js — the jaws 3-d lobby display: a poster the shark has
 * burst straight through, head and jaws lunging out over the walkway.
 * the shark is built from primitives and animated: it surges forward,
 * snaps its jaw, and rolls slightly, like the old theatre displays.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/*
 * create the display. returns { group, collisionBoxes, update }.
 */
export function createJaws3D(position, rotationY) {
  const group = new THREE.Group();

  // backboard poster with the torn hole painted around the breach
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 2.3),
    new THREE.MeshStandardMaterial({ map: posterTexture(), roughness: 0.7 }),
  );
  board.position.y = 1.25;
  group.add(board);

  // plain cardboard backing so the display is solid from behind
  // instead of an invisible plane with a floating shark
  const backing = new THREE.Mesh(
    board.geometry,
    new THREE.MeshStandardMaterial({ color: '#2a241c', roughness: 0.9 }),
  );
  backing.position.set(0, 1.25, -0.012);
  backing.rotation.y = Math.PI;
  group.add(backing);

  // board legs so it stands like lobby furniture
  const legMat = new THREE.MeshStandardMaterial({ color: '#16181f', roughness: 0.8 });
  for (const x of [-0.8, 0.8]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.5), legMat);
    leg.position.set(x, 0.07, 0);
    group.add(leg);
  }

  // the shark, bursting through just above centre
  const { shark, jaw } = makeShark();
  shark.position.set(0, 1.35, 0.3);
  group.add(shark);

  group.position.copy(position);
  group.rotation.y = rotationY;
  group.updateMatrixWorld(true);

  const collisionBoxes = [new THREE.Box3(
    new THREE.Vector3(position.x - 1.0, 0, position.z - 1.0),
    new THREE.Vector3(position.x + 1.0, 2.4, position.z + 1.0),
  )];

  // strike cycle: fast lunge out, two hard snaps at full reach with a
  // head shake, then a slow menacing slide back into the poster
  let t = Math.random() * 10;
  const update = (dt) => {
    t += dt;
    const cycle = (t * 0.55) % 1;
    // sharp attack, slow recovery
    const strike = cycle < 0.18
      ? Math.sin((cycle / 0.18) * Math.PI / 2)
      : Math.cos(((cycle - 0.18) / 0.82) * Math.PI / 2);
    shark.position.z = 0.18 + 0.34 * strike;

    // the snout rears up as it comes out of the hole
    shark.rotation.x = -0.24 * strike;

    // jaw: gapes wide through the lunge, then snap-snap at full reach
    let gape;
    if (cycle < 0.18) {
      gape = 0.15 + 0.65 * (cycle / 0.18);
    } else if (cycle < 0.42) {
      // |cos| runs 1 -> 0 -> 1 -> 0 -> 1: two full bites
      gape = 0.1 + 0.7 * Math.abs(Math.cos(((cycle - 0.18) / 0.24) * Math.PI * 2));
    } else {
      gape = 0.12;
    }
    jaw.rotation.x = gape;

    // violent little head shake while it bites, calm roll otherwise
    const biting = cycle >= 0.18 && cycle < 0.42;
    shark.rotation.y = biting ? 0.07 * Math.sin(t * 22) : 0;
    shark.rotation.z = 0.08 * Math.sin(t * 2.3);

    // the promo group freezes matrices; the moving parts push their own
    shark.updateMatrix();
    jaw.updateMatrix();
  };

  return { group, collisionBoxes, update };
}

/*
 * the bruce look: blunt lathed snout with mottled green-grey skin,
 * a huge dark maw ringed with pink gums and two rows of triangular
 * teeth, small black eyes set high and back, pale throat below.
 */
function makeShark() {
  const shark = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ map: skinTexture(), roughness: 0.65 });
  const belly = new THREE.MeshStandardMaterial({ color: '#d8dcd6', roughness: 0.7 });
  const gum = new THREE.MeshStandardMaterial({ color: '#b25560', roughness: 0.8 });
  const maw = new THREE.MeshStandardMaterial({
    color: '#2e0709', roughness: 0.95, side: THREE.BackSide,
  });
  const toothMat = new THREE.MeshStandardMaterial({ color: '#f2efe4', roughness: 0.35 });

  // upper head: a lathed profile gives the blunt rounded snout the
  // animatronic had, nothing like a straight cone
  // gradual taper: reaching full radius too early reads as a blob,
  // not a snout
  const profile = [
    [0.02, 0], [0.07, 0.05], [0.12, 0.12], [0.17, 0.22],
    [0.22, 0.38], [0.26, 0.6], [0.29, 0.85], [0.30, 1.05],
  ].map(([r, d]) => new THREE.Vector2(r, d));
  // rotate -90 about x so the nose points +z with normals still
  // facing outward (a mirror scale here turns the head inside out)
  const headGeo = new THREE.LatheGeometry(profile, 18);
  headGeo.rotateX(-Math.PI / 2);
  headGeo.scale(1, 0.78, 1); // flatten a little
  headGeo.translate(0, 0.06, 0.72);
  const head = new THREE.Mesh(headGeo, skin);
  shark.add(head);

  // dark concave maw under the snout, seen from inside
  // a hemisphere bowl, open rim facing forward and apex buried in the
  // head, so from outside it is only ever a dark hollow behind the
  // teeth — a full sphere here pokes through the jaw as a brown blob
  const mawGeo = new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  mawGeo.rotateX(-Math.PI / 2); // dome apex points backward
  mawGeo.scale(1.1, 0.7, 1);
  const mawMesh = new THREE.Mesh(mawGeo, maw);
  mawMesh.position.set(0, -0.11, 0.32);
  shark.add(mawMesh);

  // upper gum: a horizontal horseshoe hugging the mouth roof, bulge
  // forward and open ends pointing back into the head
  const upperGum = new THREE.Mesh(
    new THREE.TorusGeometry(0.15, 0.022, 8, 14, Math.PI),
    gum,
  );
  upperGum.position.set(0, -0.1, 0.38);
  upperGum.rotation.x = Math.PI / 2 - 0.2;
  shark.add(upperGum);
  shark.add(toothArc(toothMat, -1, { y: -0.13, radius: 0.15, size: 0.08, zc: 0.38, count: 9 }));
  shark.add(toothArc(toothMat, -1, { y: -0.12, radius: 0.11, size: 0.055, zc: 0.36, count: 7 }));

  // lower jaw: broad pale scoop hinged at the back
  const jaw = new THREE.Group();
  const jawGeo = new THREE.ConeGeometry(0.2, 0.55, 12);
  jawGeo.rotateX(Math.PI / 2);
  jawGeo.scale(1.05, 0.35, 1);
  const jawScoop = new THREE.Mesh(jawGeo, belly);
  jawScoop.position.z = 0.28;
  jaw.add(jawScoop);
  const lowerGum = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.02, 8, 14, Math.PI),
    gum,
  );
  lowerGum.position.set(0, 0.05, 0.28);
  lowerGum.rotation.x = Math.PI / 2; // horseshoe lying in the jaw scoop
  jaw.add(lowerGum);
  jaw.add(toothArc(toothMat, 1, { y: 0.07, radius: 0.12, size: 0.07, zc: 0.28, count: 9 }));
  jaw.add(toothArc(toothMat, 1, { y: 0.06, radius: 0.09, size: 0.045, zc: 0.26, count: 7 }));
  jaw.position.set(0, -0.17, 0.08); // hinge sits under the head
  shark.add(jaw);

  // body stub behind the head fills the poster hole
  const bodyGeo = new THREE.CylinderGeometry(0.3, 0.33, 0.4, 14);
  bodyGeo.rotateX(Math.PI / 2);
  bodyGeo.scale(1, 0.78, 1);
  const bodyStub = new THREE.Mesh(bodyGeo, skin);
  bodyStub.position.set(0, 0.05, -0.3);
  shark.add(bodyStub);

  // pale throat below the body
  const throatGeo = new THREE.CylinderGeometry(0.26, 0.28, 0.42, 10);
  throatGeo.rotateX(Math.PI / 2);
  throatGeo.scale(1, 0.5, 1);
  const throat = new THREE.Mesh(throatGeo, belly);
  throat.position.set(0, -0.14, -0.28);
  shark.add(throat);

  // eyes: dead black, small, sitting flush on the head flanks
  // placed just proud of the head surface so they neither float nor sink
  const eyeGeo = new THREE.SphereGeometry(0.032, 8, 6);
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#050507', roughness: 0.2 });
  for (const x of [-0.18, 0.18]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(x, 0.14, 0.4);
    shark.add(eye);
  }

  // dorsal fin breaking through above the hole
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 6), skin);
  dorsal.geometry.scale(0.35, 1, 1);
  dorsal.position.set(0, 0.48, -0.2);
  dorsal.rotation.x = -0.35;
  shark.add(dorsal);

  // pectoral fins: tips point outward, slightly down, and swept back
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.5, 6), skin);
    fin.geometry.scale(0.28, 1, 1);
    fin.position.set(side * 0.34, -0.14, -0.1);
    fin.rotation.z = -side * 1.75; // lean the cone tip out past horizontal
    fin.rotation.y = side * 0.6;   // then yaw it backwards
    shark.add(fin);
  }

  return { shark, jaw };
}

/*
 * an arc of triangular teeth across a jaw. dir -1 points them down
 * (upper jaw), +1 points them up (lower jaw).
 */
function toothArc(material, dir, { y, radius, size, zc, count }) {
  const teeth = [];
  for (let i = 0; i < count; i++) {
    const a = (i / (count - 1) - 0.5) * Math.PI * 0.85;
    const g = new THREE.ConeGeometry(size * 0.38, size, 5);
    if (dir < 0) g.rotateX(Math.PI);
    // teeth splay slightly outwards around the arc
    g.rotateZ(-a * 0.4 * dir);
    // arranged on a circle about the arc centre, bulging forward
    g.translate(Math.sin(a) * radius, y, zc + Math.cos(a) * radius);
    teeth.push(g);
  }
  const mesh = new THREE.Mesh(mergeGeometries(teeth), material);
  for (const g of teeth) g.dispose();
  return mesh;
}

/*
 * mottled green-grey shark hide, like weathered animatronic latex.
 */
function skinTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const base = ctx.createLinearGradient(0, 0, 0, 256);
  base.addColorStop(0, '#71806f');
  base.addColorStop(1, '#5a685f');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);

  const tones = ['#4c5a50', '#66755f', '#83907e', '#55635a'];
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = tones[i % tones.length];
    ctx.globalAlpha = 0.12 + (i % 5) * 0.03;
    const x = (i * 37) % 256;
    const yy = (i * 91) % 256;
    const s = 4 + (i * 13) % 14;
    ctx.beginPath();
    ctx.ellipse(x, yy, s, s * 0.6, (i % 7) * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/*
 * the poster the shark came through: deep ocean, light rays, shouty
 * red title, and a torn hole with ragged edges where the head is.
 */
function posterTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');

  // ocean gradient
  const sea = ctx.createLinearGradient(0, 0, 0, 640);
  sea.addColorStop(0, '#0a2a4a');
  sea.addColorStop(0.6, '#06182e');
  sea.addColorStop(1, '#030b18');
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, 512, 640);

  // light rays from the surface
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#9fd4e8';
  for (const [x, w] of [[80, 60], [200, 40], [330, 70], [450, 45]]) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + w, 0);
    ctx.lineTo(x + w * 2.2, 640);
    ctx.lineTo(x + w * 1.2, 640);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // title and tagline
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e33124';
  ctx.font = 'bold 96px Impact, Arial Black, sans-serif';
  ctx.fillText('JAWS', 256, 100);
  ctx.font = 'bold 72px Impact, Arial Black, sans-serif';
  ctx.fillText('3-D', 256, 170);
  ctx.fillStyle = '#f2f0ea';
  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillText('THE THIRD DIMENSION IS TERROR', 256, 600);

  // torn hole where the shark breaks through: black with ragged
  // paper edges peeled outwards
  const holeX = 256, holeY = 360, holeR = 120;
  ctx.fillStyle = '#020204';
  ctx.beginPath();
  for (let i = 0; i <= 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const r = holeR * (0.8 + 0.25 * Math.abs(Math.sin(i * 2.7)));
    const px = holeX + Math.cos(a) * r;
    const py = holeY + Math.sin(a) * r * 0.9;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  // pale torn-edge flecks
  ctx.strokeStyle = '#cfc9ba';
  ctx.lineWidth = 5;
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
