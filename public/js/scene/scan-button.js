/*
 * scan-button.js — the voight-rewind machine beside the recommended
 * rack: a taste empathy test for the be-kind-rewind era. a pedestal
 * with a pulsing red button sweeps a laser ring over the customer,
 * and fresh recommendations follow once the resident film buff has
 * chewed on the scan.
 */

import * as THREE from 'three';

const SCAN_DURATION = 2.8;

export function createTasteScanner(scene, position) {
  const group = new THREE.Group();

  // pedestal column with a steel top plate
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.2, 1.0, 12),
    new THREE.MeshStandardMaterial({ color: '#131c3a', roughness: 0.6 }),
  );
  column.position.y = 0.5;
  group.add(column);
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16),
    new THREE.MeshStandardMaterial({ color: '#8a8d94', roughness: 0.35, metalness: 0.8 }),
  );
  plate.position.y = 1.03;
  group.add(plate);

  // the big red button
  const buttonMat = new THREE.MeshStandardMaterial({
    color: '#d42027', emissive: '#ff2233', emissiveIntensity: 0.7, roughness: 0.35,
  });
  const button = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    buttonMat,
  );
  button.position.y = 1.055;
  group.add(button);

  // label wrapped on the column front
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.2),
    new THREE.MeshStandardMaterial({
      map: labelTexture(), emissive: '#ffffff', emissiveMap: labelTexture(),
      emissiveIntensity: 0.3, roughness: 0.6,
    }),
  );
  label.position.set(0, 0.72, 0.19);
  group.add(label);

  group.position.copy(position);
  scene.add(group);

  // ---- the electron beam: a green fan emitted from the button that
  // converges on a bright scan line sweeping the customer up and down,
  // like a supermarket scanner aimed at a person ----
  const beamMat = new THREE.MeshBasicMaterial({
    color: '#3dff6e', transparent: true, opacity: 0.2,
    depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const beamGeo = new THREE.BufferGeometry();
  beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.frustumCulled = false;
  beam.visible = false;
  scene.add(beam);

  const barMat = new THREE.MeshBasicMaterial({
    color: '#a8ffc4', transparent: true, opacity: 0.9,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.02, 0.02), barMat);
  bar.visible = false;
  scene.add(bar);

  const glow = new THREE.PointLight('#3dff6e', 0, 4, 2);
  scene.add(glow);

  let scanT = -1;
  let onDoneCb = null;
  let pulse = 0;
  let available = true;
  let follow = null; // live position reference — the beam tracks the viewer
  const target = new THREE.Vector3();
  const emitter = new THREE.Vector3();

  // while a test is running the button goes cold steel: no red, no
  // pulse — it only breathes red again when it can be pressed
  function setAvailable(v) {
    available = v;
    buttonMat.color.set(v ? '#d42027' : '#5a5f66');
    buttonMat.emissive.set(v ? '#ff2233' : '#8a929c');
  }

  function playScan(playerPos, onDone) {
    if (scanT >= 0) return;
    follow = playerPos;
    target.set(playerPos.x, 0, playerPos.z);
    scanT = 0;
    onDoneCb = onDone || null;
    beam.visible = true;
    bar.visible = true;
    glow.intensity = 5;
  }

  function update(dt) {
    pulse += dt;
    if (available) {
      // slow breathe: smoothstep the sine so the glow eases in and out
      // with a gentle dwell at both the bright and dim ends
      const breathe = 0.5 + 0.5 * Math.sin(pulse * 1.4);
      const eased = breathe * breathe * (3 - 2 * breathe);
      buttonMat.emissiveIntensity = 0.2 + 0.9 * eased;
    } else {
      buttonMat.emissiveIntensity = 0.18; // flat, waiting
    }

    if (scanT < 0) return;
    scanT += dt;
    const p = Math.min(1, scanT / SCAN_DURATION);
    // sweep up, then back down
    const sweep = p < 0.5 ? p * 2 : 2 - p * 2;
    const scanY = 0.12 + sweep * 1.72;

    // the beam follows the viewer if they shuffle mid-test
    if (follow) target.set(follow.x, 0, follow.z);

    // fan from the button tip to a 1m line across the customer
    emitter.set(group.position.x, 1.08, group.position.z);
    let dx = target.x - emitter.x;
    let dz = target.z - emitter.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    const px = -dz * 0.5; // half-width perpendicular
    const pz = dx * 0.5;

    const pos = beamGeo.attributes.position;
    pos.setXYZ(0, emitter.x, emitter.y, emitter.z);
    pos.setXYZ(1, target.x - px, scanY, target.z - pz);
    pos.setXYZ(2, target.x + px, scanY, target.z + pz);
    pos.needsUpdate = true;

    bar.position.set(target.x, scanY, target.z);
    bar.rotation.y = Math.atan2(-dx, -dz);
    glow.position.set(target.x, scanY, target.z);

    // electron beam shimmer
    beamMat.opacity = 0.14 + 0.1 * Math.abs(Math.sin(scanT * 45));
    barMat.opacity = 0.7 + 0.3 * Math.abs(Math.sin(scanT * 60));

    if (p >= 1) {
      scanT = -1;
      beam.visible = false;
      bar.visible = false;
      glow.intensity = 0;
      const cb = onDoneCb;
      onDoneCb = null;
      if (cb) cb();
    }
  }

  return { group, buttonMesh: group, playScan, update, setAvailable };
}

function labelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 150;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0d0d12';
  ctx.fillRect(0, 0, 256, 150);
  ctx.strokeStyle = '#ff2233';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 244, 138);
  ctx.fillStyle = '#f2f0ea';
  ctx.font = 'bold 34px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VOIGHT', 128, 52);
  ctx.fillText('REWIND', 128, 94);
  ctx.fillStyle = '#ff2233';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillText('taste empathy test', 128, 120);
  ctx.fillText('press to begin', 128, 140);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
