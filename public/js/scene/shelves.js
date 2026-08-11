/*
 * shelves.js — instanced shelf rendering and case management.
 * layout maths lives in shelf-layout.js; this module renders the
 * descriptors (instanced case bodies, merged furniture, signs) and
 * runs the poster texture streaming.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSign } from './signage.js';
import { shelfUnitMaterial } from './materials.js';
import { TEXTURE_LOAD_RANGE, TEXTURE_UNLOAD_RANGE } from '../config.js';
import {
  computeLayout, computeStoreDims,
  CASE_WIDTH, CASE_HEIGHT, CASE_DEPTH,
  UNIT_WIDTH, UNIT_DEPTH, WALL_UNIT_HEIGHT, GONDOLA_HEIGHT, GONDOLA_TILT,
} from './shelf-layout.js';

export { computeStoreDims, CASE_WIDTH, CASE_HEIGHT, CASE_DEPTH };

// case shell colours — mostly black with occasional white/red/gold
const SHELL_COLOURS = ['#15151d', '#15151d', '#15151d', '#15151d', '#e8e8e4', '#8a1522', '#b08a1a'];
function hashKey(key) {
  let hash = 0;
  const s = String(key);
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return hash;
}

const bodyGeo = new THREE.BoxGeometry(CASE_WIDTH, CASE_HEIGHT, CASE_DEPTH);
const posterGeo = new THREE.PlaneGeometry(0.31, 0.46);
const stickerGeo = new THREE.PlaneGeometry(0.13, 0.055);

function makeRentedTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 56;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f0c419';
  ctx.beginPath();
  ctx.roundRect(2, 2, 124, 52, 10);
  ctx.fill();
  ctx.strokeStyle = '#d42027';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(5, 5, 118, 46, 8);
  ctx.stroke();
  ctx.fillStyle = '#d42027';
  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('RENTED', 64, 29);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class Shelves {
  constructor(scene, imageLoader) {
    this.scene = scene;
    this.imageLoader = imageLoader;
    this.group = new THREE.Group();
    this.cases = [];
    this.collisionBoxes = [];
    this.genreSigns = [];
    this.furnitureMeshes = [];
    this.bodiesMesh = null;
    this.stickersMesh = null;
    this.loadedUrls = new Map();
    this.caseByKey = new Map();
    this.urlToKey = new Map();
    this.updateTimer = 0;
    scene.add(this.group);

    // chain evict handlers so multiple rooms share one image loader.
    // only cases holding this exact url (same size variant) unload
    const previousHandler = imageLoader.onEvict;
    imageLoader.onEvict = (url) => {
      if (previousHandler) previousHandler(url);
      const key = this.urlToKey.get(url);
      if (!key) return;
      for (const c of this.caseByKey.get(key) || []) {
        if (c.loaded && c.loadedUrl === url) this.#unloadPoster(c);
      }
    };
  }

  populate(items, dims = {}, extraFeatured = [], opts = {}) {
    this.clear();
    if (!items || items.length === 0) return;

    const layout = computeLayout(items, dims, extraFeatured, opts);
    this.collisionBoxes = layout.collisionBoxes;

    this.#buildFurniture(layout.wallUnits, layout.gondolaUnits);
    this.#buildSigns(layout.signs);
    this.#buildInstancedCases(layout.slots);
  }

  #buildInstancedCases(slots) {
    const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1 });
    this.bodiesMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, slots.length);

    const matrix = new THREE.Matrix4();
    const scale = new THREE.Vector3(1, 1, 1);
    const colour = new THREE.Color();
    const stickerLocal = new THREE.Matrix4()
      .makeRotationZ(-0.18)
      .setPosition(CASE_WIDTH / 2 - 0.085, CASE_HEIGHT / 2 - 0.055, CASE_DEPTH / 2 + 0.004);
    const stickerMatrices = [];

    slots.forEach((slot, i) => {
      matrix.compose(slot.position, slot.quat, scale);
      this.bodiesMesh.setMatrixAt(i, matrix);
      colour.set(SHELL_COLOURS[hashKey(slot.item.ratingKey) % SHELL_COLOURS.length]);
      this.bodiesMesh.setColorAt(i, colour);

      if (slot.item.viewCount > 0) {
        stickerMatrices.push(new THREE.Matrix4().multiplyMatrices(matrix, stickerLocal));
      }

      const record = {
        item: slot.item,
        position: slot.position,
        quat: slot.quat,
        rotationY: slot.rotationY,
        index: i,
        loaded: false,
        loading: false,
        loadingUrl: null,
        loadedUrl: null,
        loadedSize: 0,
        posterMesh: null,
        posterMat: null,
      };
      this.cases.push(record);

      if (slot.item.thumb) {
        this.loadedUrls.set(slot.item.ratingKey, slot.item.thumb);
        this.urlToKey.set(slot.item.thumb, slot.item.ratingKey);
      }
      const dupes = this.caseByKey.get(slot.item.ratingKey);
      if (dupes) dupes.push(record);
      else this.caseByKey.set(slot.item.ratingKey, [record]);
    });

    this.bodiesMesh.instanceMatrix.needsUpdate = true;
    if (this.bodiesMesh.instanceColor) this.bodiesMesh.instanceColor.needsUpdate = true;
    this.group.add(this.bodiesMesh);

    if (stickerMatrices.length > 0) {
      const stickerMat = new THREE.MeshBasicMaterial({ map: makeRentedTexture() });
      this.stickersMesh = new THREE.InstancedMesh(stickerGeo, stickerMat, stickerMatrices.length);
      stickerMatrices.forEach((m, i) => this.stickersMesh.setMatrixAt(i, m));
      this.stickersMesh.instanceMatrix.needsUpdate = true;
      this.group.add(this.stickersMesh);
    }
  }

  /*
   * merged furniture: tall wall bookcases, and gondolas with a plinth,
   * a spine, and sloped panels on both faces.
   */
  #buildFurniture(wallUnits, gondolaUnits) {
    const geos = [];
    const stripsByColour = new Map();

    for (const u of wallUnits) {
      const box = new THREE.BoxGeometry(UNIT_WIDTH, WALL_UNIT_HEIGHT, UNIT_DEPTH);
      box.rotateY(u.rotationY);
      box.translate(u.centre.x, WALL_UNIT_HEIGHT / 2, u.centre.z);
      geos.push(box);
      // accent strip along the wall unit top edge
      const strip = new THREE.BoxGeometry(UNIT_WIDTH, 0.05, UNIT_DEPTH + 0.04);
      strip.rotateY(u.rotationY);
      strip.translate(u.centre.x, WALL_UNIT_HEIGHT + 0.02, u.centre.z);
      (stripsByColour.get(u.accent) || stripsByColour.set(u.accent, []).get(u.accent)).push(strip);
    }

    const tilt = GONDOLA_TILT;
    for (const g of gondolaUnits) {
      // base plinth
      const plinth = new THREE.BoxGeometry(UNIT_WIDTH, 0.14, 1.0);
      plinth.translate(g.x, 0.07, g.z);
      geos.push(plinth);
      // central spine
      const spine = new THREE.BoxGeometry(UNIT_WIDTH, GONDOLA_HEIGHT, 0.18);
      spine.translate(g.x, GONDOLA_HEIGHT / 2, g.z);
      geos.push(spine);
      // sloped face panels — top leans in towards the spine so the
      // gondola is widest at the base, like a real store fixture
      for (const sign of [-1, 1]) {
        const panel = new THREE.BoxGeometry(UNIT_WIDTH, GONDOLA_HEIGHT / Math.cos(tilt), 0.04);
        panel.rotateX(-sign * tilt);
        panel.translate(g.x, GONDOLA_HEIGHT / 2, g.z + sign * 0.3);
        geos.push(panel);
      }
      // accent strip across the gondola top
      const strip = new THREE.BoxGeometry(UNIT_WIDTH, 0.04, 0.44);
      strip.translate(g.x, GONDOLA_HEIGHT + 0.02, g.z);
      (stripsByColour.get(g.accent) || stripsByColour.set(g.accent, []).get(g.accent)).push(strip);
    }

    if (geos.length > 0) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), shelfUnitMaterial());
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.furnitureMeshes.push(mesh);
      for (const g of geos) g.dispose();
    }

    for (const [accent, strips] of stripsByColour) {
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(accent),
        emissive: new THREE.Color(accent),
        emissiveIntensity: 0.55,
        roughness: 0.3,
      });
      const mesh = new THREE.Mesh(mergeGeometries(strips), mat);
      this.group.add(mesh);
      this.furnitureMeshes.push(mesh);
      for (const s of strips) s.dispose();
    }
  }

  #buildSigns(signDescs) {
    for (const d of signDescs) {
      const sign = createSign(d.text, d.position, d.accent, {
        hanging: false,
        topper: d.style === 'topper',
        rotationY: d.rotationY || 0,
      });
      this.group.add(sign);
      this.genreSigns.push(sign);
    }
  }

  /*
   * throttled texture streaming with distance lod: an active set capped
   * below the texture cache so covers never churn, and two resolution
   * tiers — lightweight covers at range, crisp ones up close, upgraded
   * as the player approaches. the server caches every size variant on
   * disk, so tier swaps are cheap after first sight.
   */
  updateVisible(playerPos, camera, dt = 0.016) {
    this.updateTimer += dt;
    if (this.updateTimer < 0.15) return;
    this.updateTimer = 0;

    const frustum = new THREE.Frustum();
    const proj = new THREE.Matrix4();
    proj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(proj);

    const MAX_ACTIVE = 160;
    const NEAR_DIST = 7;
    const NEAR_SIZE = 512;
    const FAR_SIZE = 160;

    const candidates = [];
    for (const c of this.cases) {
      const dist = playerPos.distanceTo(c.position);
      c._dist = dist;
      if (dist < TEXTURE_LOAD_RANGE && frustum.containsPoint(c.position)) {
        candidates.push({ c, priority: c.loaded ? dist - 1.5 : dist });
      }
    }

    candidates.sort((a, b) => a.priority - b.priority);
    const active = new Set();
    for (let i = 0; i < Math.min(candidates.length, MAX_ACTIVE); i++) {
      active.add(candidates[i].c);
    }

    for (const c of this.cases) {
      if (active.has(c)) {
        const desired = c._dist < NEAR_DIST ? NEAR_SIZE : FAR_SIZE;
        if (!c.loading && (!c.loaded || desired > c.loadedSize)) {
          // load, or upgrade a far texture as the player walks up;
          // never downgrade — walking away just unloads eventually
          this.#loadPoster(c, desired);
        }
      } else if (c.loading && c.loadingUrl) {
        // left the active set while still queued: cancel so requests
        // for where the player IS aren't stuck behind where they WERE
        this.imageLoader.cancel(c.loadingUrl);
      } else if (c.loaded && c._dist > TEXTURE_UNLOAD_RANGE) {
        const url = c.loadedUrl;
        this.#unloadPoster(c);
        if (url) {
          const dupes = this.caseByKey.get(c.item.ratingKey) || [];
          if (!dupes.some(o => o !== c && o.loadedUrl === url)) {
            this.imageLoader.disposeTexture(url);
          }
        }
      }
    }
  }

  #loadPoster(c, size) {
    const base = this.loadedUrls.get(c.item.ratingKey);
    if (!base) return;
    const url = `${base}&width=${size}`;
    this.urlToKey.set(url, c.item.ratingKey);
    c.loading = true;
    c.loadingUrl = url;
    this.imageLoader.loadTexture(url, c._dist ?? 0).then(texture => {
      c.loading = false;
      c.loadingUrl = null;
      if (!texture || !texture.isTexture) return; // cancelled or failed
      if (c.loaded && c.loadedSize >= size) return; // stale upgrade

      const oldUrl = c.loadedUrl;
      const oldMat = c.posterMat;

      c.posterMat = new THREE.MeshStandardMaterial({
        map: texture, roughness: 0.5, metalness: 0.0,
      });

      if (c.posterMesh) {
        // upgrade in place: swap the material on the existing mesh
        c.posterMesh.material = c.posterMat;
      } else {
        const mesh = new THREE.Mesh(posterGeo, c.posterMat);
        mesh.position.copy(c.position);
        mesh.quaternion.copy(c.quat);
        mesh.translateZ(CASE_DEPTH / 2 + 0.002);
        mesh.updateMatrix();
        mesh.matrixAutoUpdate = false;
        c.posterMesh = mesh;
        this.group.add(mesh);
      }

      c.loaded = true;
      c.loadedUrl = url;
      c.loadedSize = size;

      if (oldMat) oldMat.dispose();
      if (oldUrl && oldUrl !== url) {
        // release the lower tier if no other case still shows it
        const dupes = this.caseByKey.get(c.item.ratingKey) || [];
        if (!dupes.some(o => o !== c && o.loadedUrl === oldUrl)) {
          this.imageLoader.disposeTexture(oldUrl);
        }
      }
    }).catch(() => { c.loading = false; });
  }

  #unloadPoster(c) {
    if (!c.loaded) return;
    if (c.posterMesh) {
      this.group.remove(c.posterMesh);
      c.posterMesh = null;
    }
    if (c.posterMat) {
      c.posterMat.dispose();
      c.posterMat = null;
    }
    c.loaded = false;
    c.loadedUrl = null;
    c.loadedSize = 0;
  }

  getInstancedTarget() {
    return this.bodiesMesh ? { instanced: this.bodiesMesh, cases: this.cases } : null;
  }

  getCollisionBoxes() { return this.collisionBoxes; }

  clear() {
    for (const c of this.cases) this.#unloadPoster(c);
    this.cases.length = 0;
    this.loadedUrls.clear();
    this.caseByKey.clear();
    this.urlToKey.clear();
    this.collisionBoxes = [];

    if (this.bodiesMesh) {
      this.group.remove(this.bodiesMesh);
      this.bodiesMesh.dispose();
      this.bodiesMesh = null;
    }
    if (this.stickersMesh) {
      this.group.remove(this.stickersMesh);
      this.stickersMesh.dispose();
      this.stickersMesh = null;
    }
    for (const m of this.furnitureMeshes) {
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
      this.group.remove(m);
    }
    this.furnitureMeshes.length = 0;

    for (const s of this.genreSigns) this.group.remove(s);
    this.genreSigns.length = 0;
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
  }
}
