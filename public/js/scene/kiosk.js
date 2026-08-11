/*
 * kiosk.js — search terminal 3d model placed in a corner of the store.
 * a tall box with a tilted screen showing "SEARCH" with a pulsing cursor.
 */

import * as THREE from 'three';
import { emissiveStrip } from './materials.js';

export function createKiosk(position) {
  const group = new THREE.Group();

  // body — tall thin box
  const bodyGeo = new THREE.BoxGeometry(0.5, 1.5, 0.4);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: '#1a1a2e',
    roughness: 0.5,
    metalness: 0.3,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.set(0, 0.75, 0);
  body.castShadow = true;
  group.add(body);

  // screen — tilted plane on top
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 256;
  screenCanvas.height = 128;
  const ctx = screenCanvas.getContext('2d');
  const screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.minFilter = THREE.LinearFilter;
  screenTexture.magFilter = THREE.LinearFilter;

  const screenMat = new THREE.MeshStandardMaterial({
    map: screenTexture,
    emissive: '#00ff00',
    emissiveIntensity: 0.3,
    roughness: 0.8,
    metalness: 0.0,
  });

  const screenGeo = new THREE.PlaneGeometry(0.4, 0.2);
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, 1.55, 0.1);
  screen.rotation.x = -0.3;
  group.add(screen);

  // neon accent strip
  const stripGeo = new THREE.BoxGeometry(0.5, 0.02, 0.02);
  const stripMat = emissiveStrip('#00ff00', 0.8);
  const strip = new THREE.Mesh(stripGeo, stripMat);
  strip.position.set(0, 0.05, 0.2);
  group.add(strip);

  // glow light
  const glowLight = new THREE.PointLight('#00ff00', 1, 3);
  glowLight.position.set(0, 1.5, 0.3);
  group.add(glowLight);

  group.position.copy(position);
  group.userData = {
    isKiosk: true,
    screenCanvas,
    screenTexture,
    screenCtx: ctx,
    pulseTime: 0,
  };

  return {
    mesh: group,
    screenMesh: screen,

    /*
     * update the screen animation each frame.
     */
    update(dt) {
      group.userData.pulseTime += dt;
      const { screenCtx, screenCanvas, screenTexture, pulseTime } = group.userData;

      screenCtx.clearRect(0, 0, screenCanvas.width, screenCanvas.height);
      screenCtx.fillStyle = '#000800';
      screenCtx.fillRect(0, 0, screenCanvas.width, screenCanvas.height);

      screenCtx.fillStyle = '#00ff00';
      screenCtx.font = 'bold 28px "Courier New", monospace';
      screenCtx.textAlign = 'center';
      screenCtx.textBaseline = 'middle';
      screenCtx.fillText('SEARCH', screenCanvas.width / 2, screenCanvas.height / 2);

      // pulsing cursor
      const cursorAlpha = 0.3 + Math.sin(pulseTime * 3) * 0.7;
      screenCtx.fillStyle = `rgba(0, 255, 0, ${cursorAlpha})`;
      screenCtx.fillRect(screenCanvas.width / 2 + 65, screenCanvas.height / 2 - 14, 16, 28);

      screenTexture.needsUpdate = true;
    },

    setHighlighted(active) {
      glowLight.intensity = active ? 2.5 : 1;
      screenMat.emissiveIntensity = active ? 0.5 : 0.2;
    },

    getBoundingBox() {
      return new THREE.Box3().setFromObject(group);
    },

    dispose() {
      screenTexture.dispose();
      screenMat.dispose();
      bodyMat.dispose();
      stripMat.dispose();
    },
  };
}
