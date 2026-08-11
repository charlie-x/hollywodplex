/*
 * first-person.js — wasd movement + pointer lock mouse look + collision detection.
 * handles first-person navigation through the 3d store.
 */

import * as THREE from 'three';
import store from '../store.js';
import {
  PLAYER_RADIUS, PLAYER_HEIGHT, WALK_SPEED, RUN_SPEED,
  MOUSE_SENSITIVITY, MAX_PITCH, SPAWN_POSITION,
} from '../config.js';
import { clamp } from '../utils/math.js';

export class FirstPersonControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.collisionBoxes = [];

    // input state
    this.keys = { w: false, a: false, s: false, d: false, space: false, shift: false };
    // analogue input fed by the gamepad module each frame
    this.pad = { forward: 0, right: 0, lookX: 0, lookY: 0, run: false };
    this.velocity = new THREE.Vector3();
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');

    // initial look direction (facing into the store, -z)
    this.euler.setFromQuaternion(camera.quaternion);

    this._onKeyDown = this.#onKeyDown.bind(this);
    this._onKeyUp = this.#onKeyUp.bind(this);
    this._onMouseMove = this.#onMouseMove.bind(this);

    // keyboard events go to document — the canvas is not focusable
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
  }

  enable() {
    document.addEventListener('mousemove', this._onMouseMove);
  }

  disable() {
    document.removeEventListener('mousemove', this._onMouseMove);
    // reset inputs so player stops moving
    this.keys = { w: false, a: false, s: false, d: false, space: false, shift: false };
    this.pad = { forward: 0, right: 0, lookX: 0, lookY: 0, run: false };
    this.velocity.set(0, 0, 0);
  }

  setCollisionBoxes(boxes) {
    this.collisionBoxes = boxes || [];
  }

  getPosition() {
    return this.camera.position;
  }

  /*
   * called each frame. applies input to camera position with collision resolution.
   */
  update(dt) {
    if (!store.isPointerLocked && !store.gamepadActive) return;

    // ---- look: mouse via _onMouseMove, stick via accumulated deltas ----
    if (this.pad.lookX !== 0 || this.pad.lookY !== 0) {
      this.euler.setFromQuaternion(this.camera.quaternion);
      this.euler.y -= this.pad.lookX;
      this.euler.x -= this.pad.lookY;
      this.euler.x = clamp(this.euler.x, -MAX_PITCH, MAX_PITCH);
      this.camera.quaternion.setFromEuler(this.euler);
      this.pad.lookX = 0;
      this.pad.lookY = 0;
    }

    // ---- movement ----
    const speed = (this.keys.space || this.pad.run)
      ? RUN_SPEED
      : (this.keys.shift ? WALK_SPEED * 0.5 : WALK_SPEED);

    // compute movement direction from camera
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    right.y = 0;
    right.normalize();

    // accumulate desired velocity
    const moveDir = new THREE.Vector3();
    if (this.keys.w) moveDir.add(forward);
    if (this.keys.s) moveDir.sub(forward);
    if (this.keys.d) moveDir.add(right);
    if (this.keys.a) moveDir.sub(right);

    // analogue stick input, preserving sub-full deflection for slow walks
    moveDir.addScaledVector(forward, this.pad.forward);
    moveDir.addScaledVector(right, this.pad.right);

    if (moveDir.lengthSq() > 1) {
      moveDir.normalize();
    }

    // smooth acceleration
    const accel = speed * 8;
    const friction = speed * 6;

    const targetVel = moveDir.multiplyScalar(speed);
    this.velocity.x += (targetVel.x - this.velocity.x) * Math.min(accel * dt, 1);
    this.velocity.z += (targetVel.z - this.velocity.z) * Math.min(accel * dt, 1);

    // apply friction when no input
    if (moveDir.lengthSq() === 0) {
      this.velocity.x *= Math.max(0, 1 - friction * dt);
      this.velocity.z *= Math.max(0, 1 - friction * dt);
    }

    const displacement = this.velocity.clone().multiplyScalar(dt);

    // ---- collision resolution, sub-stepped ----
    // walls are only 0.2m thick: a single large step could pass straight
    // through, so split the move into steps no longer than 0.12m
    const stepLength = 0.12;
    const totalLength = displacement.length();
    const steps = Math.max(1, Math.ceil(totalLength / stepLength));
    const stepVec = displacement.divideScalar(steps);

    for (let i = 0; i < steps; i++) {
      const desired = this.camera.position.clone().add(stepVec);
      const resolved = this.#resolveCollisions(desired);
      this.camera.position.copy(resolved);
    }

    // keep player at fixed height
    this.camera.position.y = PLAYER_HEIGHT;

    // update shared state
    store.playerPosition.x = this.camera.position.x;
    store.playerPosition.y = this.camera.position.y;
    store.playerPosition.z = this.camera.position.z;
  }

  #resolveCollisions(desiredPos) {
    if (this.collisionBoxes.length === 0) return desiredPos;

    const currentPos = this.camera.position.clone();

    // try full displacement
    let resolved = desiredPos.clone();

    // player capsule: a vertical line with a radius
    const playerMin = new THREE.Vector3().copy(resolved);
    playerMin.x -= PLAYER_RADIUS;
    playerMin.z -= PLAYER_RADIUS;
    playerMin.y = 0.1;

    const playerMax = new THREE.Vector3().copy(resolved);
    playerMax.x += PLAYER_RADIUS;
    playerMax.z += PLAYER_RADIUS;
    playerMax.y = PLAYER_HEIGHT;

    const playerBox = new THREE.Box3(playerMin, playerMax);

    for (const shelfBox of this.collisionBoxes) {
      if (!playerBox.intersectsBox(shelfBox)) continue;

      // compute penetration on each axis
      const overlapX = Math.min(playerMax.x - shelfBox.min.x, shelfBox.max.x - playerMin.x);
      const overlapZ = Math.min(playerMax.z - shelfBox.min.z, shelfBox.max.z - playerMin.z);

      // resolve along the axis with smallest penetration, pushing back
      // towards the side the player CAME from — deciding by movement
      // direction ejects you out the far side of thin walls
      if (overlapX < overlapZ) {
        const boxCentreX = (shelfBox.min.x + shelfBox.max.x) / 2;
        if (currentPos.x < boxCentreX) {
          resolved.x = shelfBox.min.x - PLAYER_RADIUS;
        } else {
          resolved.x = shelfBox.max.x + PLAYER_RADIUS;
        }
      } else {
        const boxCentreZ = (shelfBox.min.z + shelfBox.max.z) / 2;
        if (currentPos.z < boxCentreZ) {
          resolved.z = shelfBox.min.z - PLAYER_RADIUS;
        } else {
          resolved.z = shelfBox.max.z + PLAYER_RADIUS;
        }
      }

      // update player box for next shelf check
      playerBox.min.x = resolved.x - PLAYER_RADIUS;
      playerBox.max.x = resolved.x + PLAYER_RADIUS;
      playerBox.min.z = resolved.z - PLAYER_RADIUS;
      playerBox.max.z = resolved.z + PLAYER_RADIUS;
    }

    return resolved;
  }

  #onKeyDown(e) {
    // ignore keys while typing in inputs (search overlay, 2d browse filters)
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    this.keys.w = true; break;
      case 'KeyA': case 'ArrowLeft':  this.keys.a = true; break;
      case 'KeyS': case 'ArrowDown':  this.keys.s = true; break;
      case 'KeyD': case 'ArrowRight': this.keys.d = true; break;
      case 'Space':                   this.keys.space = true; e.preventDefault(); break;
      case 'ShiftLeft': case 'ShiftRight': this.keys.shift = true; break;
      case 'KeyE':
        // stop the keystroke reaching the search input it just focused
        e.preventDefault();
        store.emit('search-toggle');
        break;
      case 'Tab':
        e.preventDefault();
        if (store.mode === '3d') {
          store.setMode('2d');
        } else {
          store.setMode('3d');
        }
        break;
      case 'Escape':
        // pointer lock api handles escape
        break;
    }
  }

  #onKeyUp(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    this.keys.w = false; break;
      case 'KeyA': case 'ArrowLeft':  this.keys.a = false; break;
      case 'KeyS': case 'ArrowDown':  this.keys.s = false; break;
      case 'KeyD': case 'ArrowRight': this.keys.d = false; break;
      case 'Space':                   this.keys.space = false; break;
      case 'ShiftLeft': case 'ShiftRight': this.keys.shift = false; break;
    }
  }

  #onMouseMove(e) {
    if (!store.isPointerLocked) return;

    this.euler.setFromQuaternion(this.camera.quaternion);

    this.euler.y -= e.movementX * MOUSE_SENSITIVITY;
    this.euler.x -= e.movementY * MOUSE_SENSITIVITY;
    this.euler.x = clamp(this.euler.x, -MAX_PITCH, MAX_PITCH);

    this.camera.quaternion.setFromEuler(this.euler);
  }

  dispose() {
    this.disable();
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
  }
}
