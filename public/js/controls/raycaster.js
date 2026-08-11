/*
 * raycaster.js — crosshair ray casting against the instanced case
 * meshes and plain interactables (kiosk). one shared highlight box
 * moves to whichever case is hovered.
 */

import * as THREE from 'three';
import store from '../store.js';
import { CASE_WIDTH, CASE_HEIGHT, CASE_DEPTH } from '../scene/shelves.js';

const MAX_INTERACT_DISTANCE = 8;
const UPDATE_INTERVAL = 0.08;

export class CaseRaycaster {
  constructor(camera, domElement, scene) {
    this.camera = camera;
    this.domElement = domElement;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = MAX_INTERACT_DISTANCE;
    this.plainTargets = [];      // { mesh, item }
    this.instancedTargets = [];  // { instanced, cases }
    this.hovered = null;         // { item, position?, rotationY? }
    this.timer = 0;

    // one shared highlight, moved to the hovered case: a solid glowing
    // gold frame AROUND the case (not over the art, which varies too
    // much for a wash to read), pulsing gently while aimed at
    this.highlight = new THREE.Group();
    this.pulseTime = 0;

    this.frameMat = new THREE.MeshBasicMaterial({
      color: '#ffd23f', transparent: true, opacity: 0.5, depthWrite: false,
    });
    const bar = 0.028;              // frame bar thickness
    const w = CASE_WIDTH + 0.07;    // inner opening slightly larger than the case
    const h = CASE_HEIGHT + 0.07;
    const d = 0.05;
    const frameGeos = [];
    // top and bottom bars span the full outer width
    for (const y of [h / 2 + bar / 2, -h / 2 - bar / 2]) {
      const g = new THREE.BoxGeometry(w + bar * 2, bar, d);
      g.translate(0, y, 0);
      frameGeos.push(g);
    }
    // left and right bars
    for (const x of [-w / 2 - bar / 2, w / 2 + bar / 2]) {
      const g = new THREE.BoxGeometry(bar, h, d);
      g.translate(x, 0, 0);
      frameGeos.push(g);
    }
    // merge manually into one mesh per bar (four small draws, one material)
    for (const g of frameGeos) {
      const mesh = new THREE.Mesh(g, this.frameMat);
      mesh.position.z = CASE_DEPTH / 2 + 0.015;
      this.highlight.add(mesh);
    }

    this.highlight.visible = false;
    if (scene) scene.add(this.highlight);

    this._onClick = this.#onClick.bind(this);
    domElement.addEventListener('click', this._onClick);
  }

  setTargets(plainTargets, instancedTargets) {
    this.plainTargets = plainTargets || [];
    this.instancedTargets = (instancedTargets || []).filter(Boolean);
  }

  update(dt = 0.016) {
    // gamepad mode drives the crosshair without pointer lock
    if (!store.isPointerLocked && !store.gamepadActive) {
      this.#clearHover();
      return;
    }

    // slow, gentle pulse on the frame — runs every frame, unlike the
    // raycast itself, so the breathing stays smooth. opacity and a
    // slight scale swell together read as a glow regardless of artwork
    if (this.highlight.visible) {
      this.pulseTime += dt;
      const wave = (Math.sin(this.pulseTime * Math.PI) + 1) / 2; // ~2s cycle
      this.frameMat.opacity = 0.32 + wave * 0.28;
      const s = 1 + wave * 0.02;
      this.highlight.scale.set(s, s, 1);
    }

    this.timer += dt;
    if (this.timer < UPDATE_INTERVAL) return;
    this.timer = 0;

    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    const meshes = [
      ...this.plainTargets.map(t => t.mesh),
      ...this.instancedTargets.map(t => t.instanced),
    ];
    if (meshes.length === 0) {
      this.#clearHover();
      return;
    }

    const hits = this.raycaster.intersectObjects(meshes, true);
    if (hits.length === 0) {
      this.#clearHover();
      return;
    }

    const hit = hits[0];

    // instanced hit: resolve the case record from the instance id
    for (const t of this.instancedTargets) {
      if (hit.object === t.instanced && hit.instanceId != null) {
        const c = t.cases[hit.instanceId];
        if (c) this.#hoverCase(c);
        return;
      }
    }

    // plain target hit (kiosk): walk up parents to the registered mesh
    let obj = hit.object;
    while (obj) {
      for (const t of this.plainTargets) {
        if (t.mesh === obj) {
          this.#hoverPlain(t);
          return;
        }
      }
      obj = obj.parent;
    }

    this.#clearHover();
  }

  #hoverCase(c) {
    if (this.hovered === c) return;
    this.hovered = c;
    this.highlight.position.copy(c.position);
    // match the case's full orientation, including the gondola tilt
    if (c.quat) this.highlight.quaternion.copy(c.quat);
    else this.highlight.rotation.set(0, c.rotationY, 0);
    // start the pulse bright so the frame registers immediately
    this.pulseTime = 0.5;
    this.highlight.visible = true;
    store.emit('case-hover', c.item);
  }

  #hoverPlain(t) {
    if (this.hovered === t) return;
    this.hovered = t;
    this.highlight.visible = false;
    store.emit('case-hover', t.item);
  }

  #clearHover() {
    if (this.hovered) {
      this.hovered = null;
      this.highlight.visible = false;
      store.emit('case-hover', null);
    }
  }

  #onClick() {
    // gamepad mode has no pointer lock but still clicks via the a button
    if (!store.isPointerLocked && !store.gamepadActive) return;
    if (!this.hovered) return;
    if (store.selectedItem) return;

    const item = this.hovered.item;
    if (item?.isKiosk) {
      store.emit('search-toggle');
      return;
    }
    if (item?.isScanButton) {
      store.emit('taste-scan');
      return;
    }
    if (item?.isZoltar) {
      store.emit('zoltar-speak');
      return;
    }
    if (item && item.ratingKey) {
      store.selectItem(item.ratingKey);
    }
  }

  dispose() {
    this.domElement.removeEventListener('click', this._onClick);
    this.#clearHover();
    if (this.highlight.parent) this.highlight.parent.remove(this.highlight);
    this.plainTargets.length = 0;
    this.instancedTargets.length = 0;
  }
}
