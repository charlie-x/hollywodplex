/*
 * effects.js — ambient dust motes as a single THREE.Points draw call.
 */

import * as THREE from 'three';

export function createDustParticles(scene, roomDimensions) {
  const count = 200;
  const { width, depth, height, cx = 0, cz = 0 } = roomDimensions;

  // soft circular sprite
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.15)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  const texture = new THREE.CanvasTexture(canvas);

  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = cx + (Math.random() - 0.5) * width * 0.9;
    positions[i * 3 + 1] = Math.random() * height;
    positions[i * 3 + 2] = cz + (Math.random() - 0.5) * depth * 0.9;
    velocities[i * 3] = (Math.random() - 0.5) * 0.1;
    velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.05;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    map: texture,
    size: 0.05,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  return {
    update(dt) {
      const pos = geometry.attributes.position.array;
      for (let i = 0; i < count; i++) {
        pos[i * 3] += velocities[i * 3] * dt;
        pos[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        pos[i * 3 + 2] += velocities[i * 3 + 2] * dt;

        // wrap within the room volume
        if (Math.abs(pos[i * 3] - cx) > width / 2) pos[i * 3] = cx - (pos[i * 3] - cx);
        if (pos[i * 3 + 1] > height) pos[i * 3 + 1] = 0;
        if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] = height;
        if (Math.abs(pos[i * 3 + 2] - cz) > depth / 2) pos[i * 3 + 2] = cz - (pos[i * 3 + 2] - cz);
      }
      geometry.attributes.position.needsUpdate = true;
    },

    dispose() {
      scene.remove(points);
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
