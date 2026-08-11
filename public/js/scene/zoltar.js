/*
 * zoltar.js — the zoltar speaks fortune machine. a carnival cabinet
 * with the turbaned seer behind glass; press the button and the
 * crystal ball stirs, zoltar deliberates, and a movie fortune is
 * dispensed (the film's card opens as your fate).
 */

import * as THREE from 'three';

const WOOD = '#6e1420';
const GOLD = '#c9a227';

export function createZoltar(scene, position, rotationY = 0) {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.6 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: GOLD, roughness: 0.35, metalness: 0.7,
  });

  // ---- base cabinet ----
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.05, 0.7), woodMat);
  base.position.y = 0.525;
  base.castShadow = true;
  group.add(base);
  for (const y of [0.08, 1.02]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.99, 0.05, 0.74), goldMat);
    trim.position.y = y;
    group.add(trim);
  }

  // card slot with its plate
  const slotPlate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.02), goldMat);
  slotPlate.position.set(0, 0.72, 0.36);
  group.add(slotPlate);
  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.02, 0.03),
    new THREE.MeshStandardMaterial({ color: '#0a0a0c', roughness: 0.9 }),
  );
  slot.position.set(0, 0.72, 0.37);
  group.add(slot);

  // the button: gold ring, red dome
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 14), goldMat);
  ring.position.set(0.28, 0.98, 0.32);
  group.add(ring);
  const buttonMat = new THREE.MeshStandardMaterial({
    color: '#d42027', emissive: '#ff2233', emissiveIntensity: 0.6, roughness: 0.35,
  });
  const button = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    buttonMat,
  );
  button.position.set(0.28, 0.995, 0.32);
  group.add(button);

  // ---- glass case ----
  const caseH = 0.95;
  const caseY = 1.05 + caseH / 2;
  for (const [px, pz] of [[-0.45, -0.32], [0.45, -0.32], [-0.45, 0.32], [0.45, 0.32]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, caseH, 0.06), goldMat);
    post.position.set(px, caseY, pz);
    group.add(post);
  }
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, caseH, 0.64),
    new THREE.MeshPhysicalMaterial({
      color: '#cfe0dd', transparent: true, opacity: 0.12, roughness: 0.06,
      side: THREE.DoubleSide,
    }),
  );
  glass.position.y = caseY;
  group.add(glass);
  // dark backdrop with painted stars
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(0.88, caseH),
    new THREE.MeshStandardMaterial({ map: starsTexture(), roughness: 0.9 }),
  );
  back.position.set(0, caseY, -0.3);
  group.add(back);

  // ---- zoltar himself ----
  const skin = new THREE.MeshStandardMaterial({ color: '#c9935a', roughness: 0.7 });
  const robe = new THREE.MeshStandardMaterial({ color: '#8f1218', roughness: 0.6 });
  const hair = new THREE.MeshStandardMaterial({ color: '#16161a', roughness: 0.9 });
  const turbanMat = new THREE.MeshStandardMaterial({ color: '#d8b545', roughness: 0.5 });
  const zoltar = new THREE.Group();

  // torso in the red robe with a gold vest front and shoulders
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.5, 12), robe);
  torso.position.y = 0.25;
  zoltar.add(torso);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 0.04), goldMat);
  vest.position.set(0, 0.26, 0.24);
  zoltar.add(vest);
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), robe);
    shoulder.position.set(side * 0.24, 0.44, 0);
    zoltar.add(shoulder);
  }

  // arms: the right hand raised hovering over the crystal ball, the
  // left resting by the ledge — the iconic pose
  const armGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.34, 8);
  const rightArm = new THREE.Mesh(armGeo, robe);
  rightArm.position.set(0.17, 0.38, 0.12);
  rightArm.rotation.set(0.9, 0, -0.5);
  zoltar.add(rightArm);
  const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skin);
  rightHand.scale.set(1, 0.6, 1.2);
  rightHand.position.set(0.06, 0.48, 0.22);
  zoltar.add(rightHand);
  const leftArm = new THREE.Mesh(armGeo, robe);
  leftArm.position.set(-0.2, 0.32, 0.08);
  leftArm.rotation.set(0.5, 0, 0.5);
  zoltar.add(leftArm);
  const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skin);
  leftHand.position.set(-0.13, 0.26, 0.17);
  zoltar.add(leftHand);

  const head = new THREE.Group();
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), skin);
  head.add(face);
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), hair);
  beard.scale.set(1, 0.9, 0.8);
  beard.position.set(0, -0.09, 0.04);
  head.add(beard);
  // moustache draped over the beard line
  for (const side of [-1, 1]) {
    const tache = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), hair);
    tache.scale.set(1.3, 0.45, 0.7);
    tache.position.set(side * 0.035, -0.035, 0.115);
    tache.rotation.z = -side * 0.35;
    head.add(tache);
  }
  // brows over the hollow eyes
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#0a0a0c', roughness: 0.4 });
  for (const x of [-0.05, 0.05]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), eyeMat);
    eye.position.set(x, 0.02, 0.115);
    head.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.012, 0.015), hair);
    brow.position.set(x, 0.055, 0.12);
    brow.rotation.z = x < 0 ? -0.25 : 0.25; // stern
    head.add(brow);
  }
  // gold hoop earrings
  for (const side of [-1, 1]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 6, 12), goldMat);
    hoop.position.set(side * 0.125, -0.03, 0.02);
    head.add(hoop);
  }

  // gold wrapped turban with a band and the red jewel
  const turban = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    turbanMat,
  );
  turban.scale.set(1, 1.25, 1);
  turban.position.y = 0.04;
  head.add(turban);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 8, 16), robe);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.06;
  head.add(band);
  const jewel = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 8, 6),
    new THREE.MeshStandardMaterial({
      color: '#d42027', emissive: '#ff4455', emissiveIntensity: 0.5, roughness: 0.3,
    }),
  );
  jewel.position.set(0, 0.09, 0.145);
  head.add(jewel);

  head.position.y = 0.6;
  zoltar.add(head);

  // crystal ball on a ledge before him
  const ballMat = new THREE.MeshPhysicalMaterial({
    color: '#b0d8ff', transparent: true, opacity: 0.55, roughness: 0.05,
    emissive: '#7fb8ff', emissiveIntensity: 0.15,
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), ballMat);
  ball.position.set(0, 0.32, 0.2);
  zoltar.add(ball);
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.2), woodMat);
  ledge.position.set(0, 0.25, 0.2);
  zoltar.add(ledge);

  zoltar.position.y = 1.1;
  group.add(zoltar);

  // ball glow light, dark until a fortune is asked
  const ballLight = new THREE.PointLight('#7fb8ff', 0, 2.5, 2);
  ballLight.position.set(0, 1.42, 0.2);
  group.add(ballLight);

  // warm case lighting so zoltar reads behind the tinted glass
  const caseLight = new THREE.PointLight('#ffd9a0', 1.4, 1.6, 2);
  caseLight.position.set(0, 1.8, 0.15);
  group.add(caseLight);

  // coin plate under the button
  const coinPlate = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.02), goldMat);
  coinPlate.position.set(0.28, 0.86, 0.36);
  group.add(coinPlate);
  const coinSlot = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, 0.06, 0.03),
    new THREE.MeshStandardMaterial({ color: '#0a0a0c', roughness: 0.9 }),
  );
  coinSlot.position.set(0.28, 0.86, 0.365);
  group.add(coinSlot);

  // ---- header sign ----
  const signTex = signTexture();
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.3),
    new THREE.MeshStandardMaterial({
      map: signTex, emissive: '#ffffff', emissiveMap: signTex,
      emissiveIntensity: 0.45, roughness: 0.6,
    }),
  );
  sign.position.set(0, 2.2, 0.36);
  group.add(sign);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.1, 0.78), goldMat);
  roof.position.y = 2.05;
  group.add(roof);

  group.position.copy(position);
  group.rotation.y = rotationY;
  group.updateMatrixWorld(true);
  scene.add(group);

  // ---- the fortune performance ----
  let speakT = -1;
  let onDoneCb = null;
  let idleT = Math.random() * 10;

  function speak(onDone) {
    if (speakT >= 0) return false;
    speakT = 0;
    onDoneCb = onDone || null;
    return true;
  }

  function update(dt) {
    idleT += dt;
    // faint idle shimmer in the ball
    if (speakT < 0) {
      ballMat.emissiveIntensity = 0.12 + 0.06 * Math.sin(idleT * 1.1);
      return;
    }

    speakT += dt;
    const p = Math.min(1, speakT / 2.4);
    // the ball wakes, zoltar sways and considers, the jewel flares
    ballMat.emissiveIntensity = 0.2 + 1.6 * Math.sin(p * Math.PI) * (0.7 + 0.3 * Math.sin(speakT * 17));
    ballLight.intensity = 5 * Math.sin(p * Math.PI);
    head.rotation.y = 0.35 * Math.sin(speakT * 3.1);
    head.rotation.x = 0.1 * Math.sin(speakT * 2.2);

    if (p >= 1) {
      speakT = -1;
      head.rotation.set(0, 0, 0);
      ballLight.intensity = 0;
      const cb = onDoneCb;
      onDoneCb = null;
      if (cb) cb();
    }
  }

  return { group, buttonMesh: group, speak, update };
}

function signTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1a0e2e';
  ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 144);
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 78px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('ZOLTAR', 256, 84);
  ctx.fillStyle = '#e8d8a8';
  ctx.font = 'italic 30px Georgia, serif';
  ctx.fillText('speaks in movies', 256, 130);
  // marquee bulbs around the border
  for (let x = 24; x < 512; x += 44) {
    for (const y of [20, 140]) {
      ctx.fillStyle = '#fff2c9';
      ctx.shadowColor = '#ffd25a';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.shadowBlur = 0;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function starsTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#170b28';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#e8d8a8';
  for (let i = 0; i < 40; i++) {
    const x = (i * 61) % 256;
    const y = (i * 97) % 256;
    const r = 1 + (i % 3);
    ctx.globalAlpha = 0.4 + (i % 5) * 0.12;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // a crescent moon
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(200, 52, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#170b28';
  ctx.beginPath();
  ctx.arc(208, 46, 18, 0, Math.PI * 2);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
