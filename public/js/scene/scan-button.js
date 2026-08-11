/*
 * scan-button.js — the taste scanner beside the recommended rack: a
 * pedestal with a pulsing red button. pressing it sweeps a sci-fi
 * laser ring over the customer, and fresh recommendations follow once
 * the resident film buff has chewed on the scan.
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

  // ---- the laser sweep, spawned over the customer ----
  const ringMat = new THREE.MeshBasicMaterial({
    color: '#ff2233', transparent: true, opacity: 0.9, depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.015, 8, 36), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  const shellMat = new THREE.MeshBasicMaterial({
    color: '#ff3344', transparent: true, opacity: 0.06,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.56, 0.56, 1.95, 24, 1, true),
    shellMat,
  );
  shell.visible = false;
  scene.add(shell);

  const glow = new THREE.PointLight('#ff2233', 0, 4, 2);
  scene.add(glow);

  let scanT = -1;
  let onDoneCb = null;
  let pulse = 0;
  const target = new THREE.Vector3();

  function playScan(playerPos, onDone) {
    if (scanT >= 0) return;
    target.set(playerPos.x, 0, playerPos.z);
    scanT = 0;
    onDoneCb = onDone || null;
    ring.visible = true;
    shell.visible = true;
    shell.position.set(target.x, 0.975, target.z);
    glow.intensity = 6;
  }

  function update(dt) {
    pulse += dt;
    buttonMat.emissiveIntensity = 0.6 + 0.35 * (0.5 + 0.5 * Math.sin(pulse * 2.4));

    if (scanT < 0) return;
    scanT += dt;
    const p = Math.min(1, scanT / SCAN_DURATION);
    // sweep up, then back down
    const sweep = p < 0.5 ? p * 2 : 2 - p * 2;
    ring.position.set(target.x, 0.08 + sweep * 1.78, target.z);
    glow.position.copy(ring.position);
    ringMat.opacity = 0.55 + 0.35 * Math.abs(Math.sin(scanT * 40)); // laser buzz
    shellMat.opacity = 0.05 + 0.03 * Math.sin(scanT * 25);

    if (p >= 1) {
      scanT = -1;
      ring.visible = false;
      shell.visible = false;
      glow.intensity = 0;
      const cb = onDoneCb;
      onDoneCb = null;
      if (cb) cb();
    }
  }

  return { group, buttonMesh: group, playScan, update };
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
  ctx.font = 'bold 40px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TASTE', 128, 58);
  ctx.fillText('SCANNER', 128, 104);
  ctx.fillStyle = '#ff2233';
  ctx.font = 'bold 17px Arial, sans-serif';
  ctx.fillText('press for new picks', 128, 134);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
