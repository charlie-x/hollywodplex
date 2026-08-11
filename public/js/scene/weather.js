/*
 * weather.js — occasional night-time weather for the car park beyond
 * the storefront glass, on a slow timer. conditions vary. visible
 * only through the front windows, and best left undescribed.
 */

import * as THREE from 'three';
import { STOREFRONT_WIDTH } from './storefront.js';
import {
  softFogTexture, creatureTextures, splatTextures, crackTextures,
  gunkTrailTexture, makeTentacle,
} from './weather-art.js';

const FIRST_WAIT = 300;        // five minutes before the first event
const SIEGE_MIN = 60;          // how long the fog sits at full thickness
const SIEGE_MAX = 90;
const ROLL_IN = 15;
const ROLL_OUT = 20;
const MAX_CRACKS = 4;

export function createWeatherEvent(scene, dims, opts = {}) {
  const cx = dims.cx ?? 0;
  const wallZ = (dims.cz ?? 0) + dims.depth / 2;
  const cars = opts.cars || [];

  // ---- layered fog banks across the car park ----
  // far banks thicken first so the fog reads as rolling towards the
  // glass rather than fading in evenly
  const banks = [];
  const fogTexture = softFogTexture();
  for (const [dz, maxOpacity, delay] of [
    [14.6, 0.95, 0.0],
    [9.0, 0.8, 0.25],
    [5.0, 0.65, 0.5],
    [1.6, 0.5, 0.75],
  ]) {
    const bank = new THREE.Mesh(
      new THREE.PlaneGeometry(STOREFRONT_WIDTH + 22, 7),
      new THREE.MeshBasicMaterial({
        map: fogTexture, color: '#c4c6ca', transparent: true, opacity: 0,
        depthWrite: false,
      }),
    );
    bank.position.set(cx, 2.4, wallZ + dz);
    bank.rotation.y = Math.PI;
    bank.visible = false;
    scene.add(bank);
    banks.push({ mesh: bank, maxOpacity, delay });
  }

  // ---- the things in the fog: varied silhouettes drifting past ----
  const shapeTexs = creatureTextures();
  const shape = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 2.2),
    new THREE.MeshBasicMaterial({
      map: shapeTexs[0], color: '#14161c', transparent: true, opacity: 0,
      depthWrite: false,
    }),
  );
  shape.rotation.y = Math.PI;
  shape.visible = false;
  scene.add(shape);
  let pass = null; // one crossing: direction, depth, size, speed all vary

  function startPass() {
    pass = {
      t: 0,
      dur: 4.5 + Math.random() * 5,
      dir: Math.random() < 0.5 ? 1 : -1,
      z: 2.5 + Math.random() * 5.5,
      y: 1.2 + Math.random() * 1.5,
      scale: 0.7 + Math.random() * 1.1,
      flip: Math.random() < 0.5,
    };
    shape.material.map = shapeTexs[Math.floor(Math.random() * shapeTexs.length)];
    shape.material.needsUpdate = true;
    shape.visible = true;
  }

  function updatePass(dt) {
    pass.t += dt;
    const f = pass.t / pass.dur;
    const span = STOREFRONT_WIDTH + 8;
    shape.position.set(
      cx + pass.dir * (f - 0.5) * span,
      pass.y + 0.18 * Math.sin(pass.t * 1.7),
      wallZ + pass.z,
    );
    shape.scale.set(pass.scale * (pass.flip ? -1 : 1), pass.scale, 1);
    // deeper shapes read dimmer through more fog
    const peak = Math.max(0.2, 0.55 - (pass.z - 2.5) * 0.045);
    shape.material.opacity = peak * Math.sin(Math.min(1, f) * Math.PI);
    if (f >= 1) {
      pass = null;
      shape.visible = false;
    }
  }

  // ---- crack decals on the glass, each with the bug that made it ----
  const crackTexs = crackTextures();
  const splatTexs = splatTextures();
  const trailTex = gunkTrailTexture();
  const cracks = [];
  for (let i = 0; i < MAX_CRACKS; i++) {
    const crack = new THREE.Mesh(
      new THREE.PlaneGeometry(0.65, 0.65),
      new THREE.MeshBasicMaterial({
        map: crackTexs[0], transparent: true, opacity: 0,
        depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    crack.visible = false;
    scene.add(crack);
    const splat = new THREE.Mesh(
      new THREE.PlaneGeometry(0.45, 0.45),
      new THREE.MeshBasicMaterial({
        map: splatTexs[0], transparent: true, opacity: 0,
        depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    splat.visible = false;
    scene.add(splat);
    // the smear left behind as the bug loses its grip and slides
    const trail = new THREE.Mesh(
      new THREE.PlaneGeometry(0.28, 1),
      new THREE.MeshBasicMaterial({
        map: trailTex, transparent: true, opacity: 0,
        depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    trail.visible = false;
    scene.add(trail);
    cracks.push({
      mesh: crack, splat, trail, hasSplat: false, age: -1,
      size: 1, splatSize: 1, startY: 0, slideY: 0, slideSpeed: 0, slideDelay: 0,
    });
  }

  function thump() {
    const free = cracks.find(c => c.age < 0);
    if (!free) return;
    free.age = 0;
    free.size = 0.55 + Math.random() * 0.8; // some taps, some slams
    free.mesh.material.map = crackTexs[Math.floor(Math.random() * crackTexs.length)];
    free.mesh.material.needsUpdate = true;
    free.mesh.visible = true;
    const hx = cx + (Math.random() - 0.5) * (STOREFRONT_WIDTH - 1.6);
    const hy = 0.9 + Math.random() * 1.6;
    free.mesh.position.set(hx, hy, wallZ - 0.03);
    free.mesh.rotation.z = Math.random() * Math.PI * 2;
    // most impacts leave the bug that made them smeared on the glass,
    // and gravity gets them all eventually
    free.hasSplat = Math.random() < 0.75;
    if (free.hasSplat) {
      free.splatSize = 0.7 + Math.random() * 0.8;
      free.startY = hy + (Math.random() - 0.5) * 0.12;
      free.slideY = 0;
      free.slideSpeed = 0.035 + Math.random() * 0.05;
      free.slideDelay = 0.5 + Math.random() * 1.2;
      free.splat.material.map = splatTexs[Math.floor(Math.random() * splatTexs.length)];
      free.splat.material.needsUpdate = true;
      free.splat.visible = true;
      free.splat.position.set(
        hx + (Math.random() - 0.5) * 0.12,
        free.startY,
        wallZ - 0.025,
      );
      free.splat.rotation.z = Math.random() * Math.PI * 2;
    }
  }

  // ---- something in the fog takes a car ----
  const tentacle = makeTentacle();
  tentacle.mesh.visible = false;
  scene.add(tentacle.mesh);
  let grab = null;
  let grabPlanned = false;
  let grabAt = 0;
  let siegeT = 0;
  const root = new THREE.Vector3();
  const tip = new THREE.Vector3();
  const mid1 = new THREE.Vector3();
  const mid2 = new THREE.Vector3();

  function beginGrab() {
    const car = cars[Math.floor(Math.random() * cars.length)];
    grab = {
      car,
      home: car.position.clone(),
      rootX: car.position.x + (Math.random() < 0.5 ? -1 : 1) * (2.5 + Math.random() * 2),
      t: 0,
      phase: 'emerge',
      wobble: Math.random() * 10,
    };
    tentacle.mesh.visible = true;
  }

  function layTentacle(frac) {
    const g = grab;
    root.set(g.rootX, 5.4, wallZ + 12.5);
    // arcing overhead: high near the root, swooping down to the tip
    mid1.lerpVectors(root, tip, 0.35);
    mid1.y += 1.8 + 0.3 * Math.sin(g.t * 1.3);
    mid2.lerpVectors(root, tip, 0.72);
    mid2.y += 0.6;
    mid2.x += 0.4 * Math.sin(g.t * 1.8);
    tentacle.reshape(root, mid1, mid2, tip, frac, g.wobble + g.t * 3);
  }

  function updateGrab(dt) {
    const g = grab;
    g.t += dt;
    const car = g.car;
    const roofY = 1.1;

    if (g.phase === 'emerge') {
      // it comes out of the fog, reaching over the car
      const p = Math.min(1, g.t / 1.6);
      tip.set(g.home.x, 2.3, g.home.z + 0.4);
      layTentacle(1 - (1 - p) * (1 - p)); // ease out
      if (g.t >= 1.6) { g.phase = 'probe'; g.t = 0; }
    } else if (g.phase === 'probe') {
      // circling over the roof, feeling for a grip
      tip.set(
        g.home.x + 0.35 * Math.sin(g.t * 4),
        2.0 - g.t * 0.5,
        g.home.z + 0.35 * Math.cos(g.t * 4),
      );
      layTentacle(1);
      if (g.t >= 1.4) { g.phase = 'seize'; g.t = 0; }
    } else if (g.phase === 'seize') {
      // the snap down onto the roof; the car jolts on its springs
      const p = Math.min(1, g.t / 0.4);
      tip.set(g.home.x, 2.0 - (2.0 - roofY) * p * p, g.home.z);
      car.position.y = g.home.y + 0.05 * Math.sin(p * Math.PI);
      car.updateMatrix();
      layTentacle(1);
      if (g.t >= 0.4) { g.phase = 'drag'; g.t = 0; }
    } else if (g.phase === 'drag') {
      // hauled backwards into the fog, nose up, struggling on its
      // suspension, accelerating as the thing commits
      const q = Math.min(1, g.t / 4.5);
      const e = q * q;
      car.position.set(
        g.home.x + (g.rootX - g.home.x) * 0.5 * e,
        g.home.y + 0.12 * Math.sin(Math.min(1, q * 3) * Math.PI),
        g.home.z + e * 10.5,
      );
      car.rotation.x = 0.16 * Math.sin(Math.min(1, q * 2) * Math.PI / 2);
      car.rotation.z = 0.05 * Math.sin(g.t * 25) * (1 - q);
      car.updateMatrix();
      tip.set(car.position.x, roofY + 0.05, car.position.z);
      layTentacle(1);
      if (q >= 1) {
        g.phase = 'vanish';
        g.t = 0;
        car.visible = false;
      }
    } else if (g.phase === 'vanish') {
      // the tentacle whips back into the murk with its prize
      layTentacle(1 - g.t / 0.7);
      if (g.t >= 0.7) {
        g.phase = 'done';
        tentacle.mesh.visible = false;
      }
    }
  }

  function resetGrab() {
    if (!grab) return;
    grab.car.visible = true;
    grab.car.position.copy(grab.home);
    grab.car.rotation.set(0, 0, 0);
    grab.car.updateMatrix();
    tentacle.mesh.visible = false;
    grab = null;
  }

  // ---- event state machine ----
  let state = 'idle';
  let timer = FIRST_WAIT;
  let siegeLeft = 0;
  let thumpIn = 0;
  let fogLevel = 0;

  function startEvent() {
    state = 'rollIn';
    timer = ROLL_IN;
    siegeLeft = SIEGE_MIN + Math.random() * (SIEGE_MAX - SIEGE_MIN);
    thumpIn = 6 + Math.random() * 6;
    siegeT = 0;
    grabPlanned = cars.length > 0 && Math.random() < 0.7;
    grabAt = 8 + Math.random() * (siegeLeft - 20);
    for (const b of banks) b.mesh.visible = true;
  }

  function applyFog() {
    for (const b of banks) {
      const local = Math.max(0, Math.min(1, (fogLevel - b.delay) / (1 - b.delay)));
      b.mesh.material.opacity = b.maxOpacity * local;
    }
  }

  function update(dt) {
    // cracks pop in fast, then linger; the splat lands with them and
    // then slowly loses its grip, sliding down and smearing a trail
    for (const c of cracks) {
      if (c.age < 0) continue;
      c.age += dt;
      const pop = Math.min(1, c.age / 0.12);
      c.mesh.scale.setScalar(c.size * (0.3 + 0.7 * pop));
      c.mesh.material.opacity = 0.85 * pop * Math.min(1, fogLevel * 2);
      if (c.hasSplat) {
        c.splat.scale.setScalar(c.splatSize * (0.4 + 0.6 * pop));
        c.splat.material.opacity = 0.9 * pop * Math.min(1, fogLevel * 2);
        if (c.age > c.slideDelay) {
          const maxSlide = Math.max(0, c.startY - 0.35); // stops above the sill
          c.slideY = Math.min(maxSlide, c.slideY + c.slideSpeed * dt);
          c.splat.position.y = c.startY - c.slideY;
          c.splat.rotation.z += dt * 0.06; // lazily turning as it slips
          if (c.slideY > 0.04) {
            c.trail.visible = true;
            c.trail.position.set(c.splat.position.x, c.startY - c.slideY / 2, wallZ - 0.02);
            c.trail.scale.set(c.splatSize * 0.55, c.slideY + 0.08, 1);
            c.trail.material.opacity = 0.6 * Math.min(1, fogLevel * 2);
          }
        }
      }
    }

    if (grab && grab.phase !== 'done') updateGrab(dt);

    switch (state) {
      case 'idle':
        timer -= dt;
        if (timer <= 0) startEvent();
        break;

      case 'rollIn':
        timer -= dt;
        fogLevel = Math.min(1, 1 - timer / ROLL_IN);
        applyFog();
        if (timer <= 0) {
          fogLevel = 1;
          state = 'siege';
        }
        break;

      case 'siege':
        siegeLeft -= dt;
        siegeT += dt;
        thumpIn -= dt;
        if (thumpIn <= 0) {
          thump();
          thumpIn = 8 + Math.random() * 10;
        }
        if (grabPlanned && !grab && siegeT >= grabAt) beginGrab();
        if (!pass && Math.random() < dt * 0.08) startPass();
        if (pass) updatePass(dt);
        if (siegeLeft <= 0) {
          state = 'rollOut';
          timer = ROLL_OUT;
        }
        break;

      case 'rollOut':
        timer -= dt;
        fogLevel = Math.max(0, timer / ROLL_OUT);
        applyFog();
        if (pass) updatePass(dt);
        // the cracks mend as the weather lets go of the glass
        for (const c of cracks) {
          if (c.age >= 0) {
            c.mesh.material.opacity = Math.min(c.mesh.material.opacity, fogLevel);
            if (c.hasSplat) {
              c.splat.material.opacity = Math.min(c.splat.material.opacity, fogLevel);
              c.trail.material.opacity = Math.min(c.trail.material.opacity, fogLevel * 0.6);
            }
          }
        }
        if (timer <= 0) {
          fogLevel = 0;
          for (const b of banks) b.mesh.visible = false;
          for (const c of cracks) {
            c.age = -1;
            c.mesh.visible = false;
            c.splat.visible = false;
            c.trail.visible = false;
            c.hasSplat = false;
          }
          shape.visible = false;
          pass = null;
          resetGrab();
          state = 'idle';
          timer = 360 + Math.random() * 360; // it always comes back
        }
        break;
    }
  }

  // bring the next event forward — for those who cannot wait
  function trigger() {
    if (state === 'idle') timer = Math.min(timer, 0.5);
  }

  return { update, trigger };
}
