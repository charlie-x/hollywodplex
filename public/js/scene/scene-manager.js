/*
 * scene-manager.js — sets up and manages the three.js renderer, scene, and camera.
 * owns the animation loop and handles window resizing.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  FOV, NEAR_PLANE, FAR_PLANE, SPAWN_POSITION,
} from '../config.js';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;

    // renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.88;

    // scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1a1a3a');

    // image-based environment for speculars: gives standard materials
    // realistic sheen (waxed floor, case plastic) without true gi
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.15;
    pmrem.dispose();

    // camera
    this.camera = new THREE.PerspectiveCamera(
      FOV,
      window.innerWidth / window.innerHeight,
      NEAR_PLANE,
      FAR_PLANE,
    );
    this.camera.position.set(SPAWN_POSITION.x, SPAWN_POSITION.y, SPAWN_POSITION.z);
    this.camera.lookAt(0, SPAWN_POSITION.y, SPAWN_POSITION.z - 10);

    // animation state
    this.clock = new THREE.Clock();
    this.animationCallbacks = [];
    this._onResize = this.onResize.bind(this);
    window.addEventListener('resize', this._onResize);
  }

  /*
   * register a callback to be called each frame with deltaTime.
   */
  onAnimate(callback) {
    this.animationCallbacks.push(callback);
  }

  /*
   * start the animation loop.
   */
  start() {
    const loop = () => {
      requestAnimationFrame(loop);

      let dt = this.clock.getDelta();
      // clamp delta to avoid jumps when tab loses focus
      if (dt > 0.1) dt = 0.1;

      for (const cb of this.animationCallbacks) {
        cb(dt);
      }

      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.animationCallbacks.length = 0;
    this.renderer.dispose();
  }
}
