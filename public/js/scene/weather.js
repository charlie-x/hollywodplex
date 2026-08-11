/*
 * weather.js — occasional night-time weather for the car park beyond
 * the storefront glass, on a slow timer. conditions vary. visible
 * only through the front windows, and best left undescribed.
 */

import * as THREE from 'three';
import store from '../store.js';
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
const MAX_CRACKS = 14;

export function createWeatherEvent(scene, dims, opts = {}) {
  const cx = dims.cx ?? 0;
  const wallZ = (dims.cz ?? 0) + dims.depth / 2;
  const cars = opts.cars || [];
  const eye = opts.eye || null; // live camera position for billboarding
  const lamp = opts.lamp || null;
  const lampBase = lamp
    ? { pool: lamp.pool.intensity, head: lamp.headMat.emissiveIntensity }
    : null;
  let lampLevel = 1;
  let lampTarget = 1;

  // ---- layered fog banks across the car park ----
  // far banks thicken first so the fog reads as rolling towards the
  // glass rather than fading in evenly
  const banks = [];
  const baseFog = softFogTexture();
  let airT = 0; // shared clock for drift and breathing
  // the far bank stays a metre clear of the strip mall face, or the
  // two coplanar surfaces shimmer against each other
  for (const [dz, maxOpacity, delay, drift] of [
    [14.2, 1.0, 0.0, 0.1],
    [11.0, 0.95, 0.2, -0.16],
    [7.6, 0.9, 0.4, 0.24],
    [4.6, 0.85, 0.55, -0.32],
    [2.4, 0.75, 0.7, 0.42],
    [0.9, 0.6, 0.82, 0.55], // right up against the pavement
  ]) {
    const tex = baseFog.clone();
    tex.needsUpdate = true;
    // wider with depth, so sightlines through the glass never find
    // an edge no matter the viewing angle
    const bank = new THREE.Mesh(
      new THREE.PlaneGeometry(STOREFRONT_WIDTH + 20 + dz * 1.6, 7),
      new THREE.MeshBasicMaterial({
        map: tex, color: '#c4c6ca', transparent: true, opacity: 0,
        depthWrite: false,
      }),
    );
    bank.position.set(cx, 2.4, wallZ + dz);
    bank.rotation.y = Math.PI;
    bank.visible = false;
    scene.add(bank);
    banks.push({ mesh: bank, maxOpacity, delay, drift, phase: dz });
  }

  // low rolling mist lying over the tarmac itself
  const groundTex = baseFog.clone();
  groundTex.needsUpdate = true;
  const groundMist = new THREE.Mesh(
    new THREE.PlaneGeometry(STOREFRONT_WIDTH + 22, 16),
    new THREE.MeshBasicMaterial({
      map: groundTex, color: '#c4c6ca', transparent: true, opacity: 0,
      depthWrite: false,
    }),
  );
  groundMist.rotation.x = -Math.PI / 2;
  groundMist.position.set(cx, 0.4, wallZ + 8.5);
  groundMist.visible = false;
  scene.add(groundMist);

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
  let pass = null;

  // a shape resolves out of the dense fog, looms towards the glass,
  // and withdraws — depth does the work, not a left-right track
  function startPass(overrides = {}) {
    pass = {
      t: 0,
      dur: 9 + Math.random() * 7,
      x0: (Math.random() - 0.5) * (STOREFRONT_WIDTH - 2),
      xDrift: (Math.random() - 0.5) * 3,
      zFar: 10.5 + Math.random() * 2.5,
      zNear: 2.2 + Math.random() * 1.6,
      y: 1.2 + Math.random() * 1.4,
      scale: 0.9 + Math.random() * 1.1,
      flip: Math.random() < 0.5,
      charge: false,
      hitX: null,
      thumped: false,
      ...overrides,
    };
    // charges are made by the tentacle. the tall one is rare, slow,
    // distant and faint — the less it shows, the bigger it feels
    const texIdx = pass.charge ? 0 : (Math.random() < 0.15 ? 1 : 0);
    shape.material.map = shapeTexs[texIdx];
    shape.material.needsUpdate = true;
    pass.dim = 1;
    pass.stretchY = 1;
    if (texIdx === 1) {
      // stretched skyward so only legs cross the view, kept well out
      // in the murk, taking its time
      pass.stretchY = 1.9;
      pass.y = 2.2 + Math.random() * 0.5;
      pass.zNear = Math.max(pass.zNear, 5.5 + Math.random() * 2);
      pass.dur = 14 + Math.random() * 6;
      pass.dim = 0.6;
    }
    shape.visible = true;
  }

  function updatePass(dt) {
    pass.t += dt;
    const f = Math.min(1, pass.t / pass.dur);
    // slow out of the murk, a dwell at the closest point, then back
    const approach = Math.pow(Math.sin(f * Math.PI), 1.4);
    const z = pass.zFar - (pass.zFar - pass.zNear) * approach;
    shape.position.set(
      cx + pass.x0 + pass.xDrift * f,
      pass.y + 0.15 * Math.sin(pass.t * 1.1),
      wallZ + z,
    );
    // always face the viewer so it never reads as a flat cutout
    // seen edge-on, and breathe slightly like something alive
    if (eye) shape.lookAt(eye.x, shape.position.y, eye.z);
    shape.rotation.z = 0.06 * Math.sin(pass.t * 0.9);
    const s = pass.scale * (1 + 0.05 * Math.sin(pass.t * 2.1));
    shape.scale.set(s * (pass.flip ? -1 : 1), s * (pass.stretchY || 1), 1);
    // solidity comes entirely from how close it dares to come
    shape.material.opacity = Math.max(0, 0.62 - (z - 2.0) * 0.055) * (pass.dim || 1);

    // a charge slams the glass at the moment of closest approach
    if (pass.charge && !pass.thumped && f >= 0.5) {
      pass.thumped = true;
      thumpImpact(pass.hitX);
    }
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

  // a strike prefers to show its cause: if nothing is out there, a
  // charging shape comes first and the impact lands at its closest
  // approach. if something is already prowling, the hit just happens
  function scheduleStrike() {
    if (!pass) {
      const hitX = cx + (Math.random() - 0.5) * (STOREFRONT_WIDTH - 1.6);
      startPass({
        charge: true,
        hitX,
        x0: hitX - cx,
        xDrift: (Math.random() - 0.5) * 0.6,
        dur: 4.5 + Math.random() * 2,
        zNear: 1.5,
      });
    } else {
      thumpImpact(null);
    }
  }

  function thumpImpact(hitX) {
    store.emit('glass-thump');
    const free = cracks.find(c => c.age < 0);
    if (!free) return;
    free.age = 0;
    free.size = 0.55 + Math.random() * 0.8; // some taps, some slams
    free.mesh.material.map = crackTexs[Math.floor(Math.random() * crackTexs.length)];
    free.mesh.material.needsUpdate = true;
    free.mesh.visible = true;
    const hx = hitX ?? (cx + (Math.random() - 0.5) * (STOREFRONT_WIDTH - 1.6));
    const hy = 0.9 + Math.random() * 1.6;
    // impacts land on the outside face of the glass — that is where
    // the things are
    free.mesh.position.set(hx, hy, wallZ + 0.012);
    free.mesh.rotation.z = Math.random() * Math.PI * 2;
    // most impacts leave the bug that made them smeared on the glass,
    // and gravity gets them all eventually
    free.hasSplat = Math.random() < 0.9;
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
        wallZ + 0.02,
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
      // the tip wraps over the roof and down the far side for grip
      const wrap = Math.min(1, q * 4);
      tip.set(
        car.position.x,
        roofY + 0.05 - (roofY - 0.5) * wrap,
        car.position.z + 0.45 * wrap,
      );
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
    thumpIn = 2 + Math.random() * 3;
    siegeT = 0;
    // the car is always taken — it is the centrepiece of the visit
    grabPlanned = cars.length > 0;
    grabAt = 8 + Math.random() * (siegeLeft - 20);
    for (const b of banks) b.mesh.visible = true;
    groundMist.visible = true;
  }

  function applyFog() {
    for (const b of banks) {
      const local = Math.max(0, Math.min(1, (fogLevel - b.delay) / (1 - b.delay)));
      // gentle breathing so the wall of fog never sits perfectly still
      b.mesh.material.opacity = b.maxOpacity * local
        * (0.95 + 0.05 * Math.sin(airT * 0.35 + b.phase));
    }
    groundMist.material.opacity = 0.6 * fogLevel
      * (0.92 + 0.08 * Math.sin(airT * 0.28));
  }

  function update(dt) {
    airT += dt;
    // the banks drift sideways at different speeds for parallax
    if (state !== 'idle') {
      // banks wander bodily rather than scrolling their textures, so
      // the soft baked edges stay at the edges
      for (const b of banks) {
        b.mesh.position.x = cx + Math.sin(airT * Math.abs(b.drift) + b.phase)
          * 1.7 * Math.sign(b.drift);
      }
      groundMist.position.x = cx + Math.sin(airT * 0.21) * 1.2;
    }

    // the street lamp struggles while the weather is in
    if (lamp && lampBase) {
      if (state === 'siege' && Math.random() < dt * 3) {
        lampTarget = 0.15 + Math.random() * 0.85;
      } else if (state !== 'siege') {
        lampTarget = 1;
      }
      lampLevel += (lampTarget - lampLevel) * Math.min(1, dt * 12);
      lamp.pool.intensity = lampBase.pool * lampLevel;
      lamp.headMat.emissiveIntensity = lampBase.head * lampLevel;
    }

    // cracks pop in fast, then linger; the splat lands with them and
    // then slowly loses its grip, sliding down and smearing a trail
    for (const c of cracks) {
      if (c.age < 0) continue;
      c.age += dt;
      const pop = Math.min(1, c.age / 0.12);
      // overshoot and settle, so the hit lands with a snap
      let s = c.size * (0.3 + 0.7 * pop);
      if (c.age > 0.12) {
        s = c.size * (1 + 0.16 * Math.exp(-(c.age - 0.12) * 9) * Math.cos((c.age - 0.12) * 34));
      }
      c.mesh.scale.setScalar(s);
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
            c.trail.position.set(c.splat.position.x, c.startY - c.slideY / 2, wallZ + 0.028);
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
        applyFog(); // keeps the breathing going at full thickness
        if (thumpIn <= 0) {
          scheduleStrike();
          // they come thick and fast, often in flurries
          thumpIn = Math.random() < 0.5
            ? 0.4 + Math.random() * 0.9
            : 2.5 + Math.random() * 4;
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
          groundMist.visible = false;
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
