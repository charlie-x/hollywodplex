/*
 * shelf-layout.js — pure layout maths for the store shelving.
 * computes slot, furniture, sign, and collision descriptors:
 * tall single-sided shelves around the walls (skipping doorways),
 * lower double-sided gondolas with sloped faces in the aisles,
 * and a featured gondola row by the entrance.
 */

import * as THREE from 'three';
import { colourForGenre } from './materials.js';

export const CASE_WIDTH = 0.35;
export const CASE_HEIGHT = 0.5;
export const CASE_DEPTH = 0.03;

export const UNIT_WIDTH = 3.0;
export const UNIT_DEPTH = 0.4;
const UNIT_GAP = 0.15;
const COLS = 7;
const CASE_GAP_X = 0.035;

// wall shelving: tall, single-sided, flat against the walls
export const WALL_UNIT_HEIGHT = 3.3;
const WALL_ROWS = 5;
const WALL_ROW_STEP = 0.56;
const WALL_TOP_Y = WALL_UNIT_HEIGHT - CASE_HEIGHT / 2 - 0.08;
const WALL_SLOTS = COLS * WALL_ROWS; // 35

// gondolas: two-thirds of wall height, sloped faces on both sides
export const GONDOLA_HEIGHT = 2.2;
const GONDOLA_ROWS = 4;
// the step must exceed the tilted case's vertical extent
// (0.5 * cos(tilt) ~= 0.495) or adjacent rows interpenetrate and
// z-fight; 0.505 gives ~1cm clearance and the top row's upper edge
// lands at 2.185, just inside the 2.2 unit height
const GONDOLA_ROW_STEP = 0.505;
const GONDOLA_BOTTOM_Y = 0.17;
// half-width of the sloped face at each row, top (r=0) to bottom
const gondolaHalfWidth = (r) => 0.2 + r * ((0.42 - 0.2) / (GONDOLA_ROWS - 1));
export const GONDOLA_TILT = Math.atan(
  (0.42 - 0.2) / ((GONDOLA_ROWS - 1) * GONDOLA_ROW_STEP),
);
export const SLOTS_PER_UNIT = COLS * GONDOLA_ROWS * 2; // 56
const AISLE_WIDTH = 2.8;

const HV_GOLD = '#f0c419';
const MIN_SECTION_SIZE = 24;
const MIN_THEMED_SIZE = 8;

// listed in match order (most specific claims first); `order` controls
// where the section lands in the store — higher lands nearer the
// entrance, and consecutive values sit in adjacent aisles
const hasGenre = (i, tag) => (i.genres || []).some(g => g.tag === tag);
const THEMED_SECTIONS = [
  {
    title: 'Hallmark',
    accent: '#e75480',
    order: 10,
    match: i => (i.studio || '').toLowerCase().includes('hallmark'),
  },
  {
    title: 'Rom-Coms',
    accent: '#ff8fb3',
    order: 11,
    match: i => hasGenre(i, 'Romance') && hasGenre(i, 'Comedy'),
  },
  {
    title: 'Classic Sci-Fi',
    accent: '#44ffcc',
    order: 1,
    match: i => i.year && i.year <= 1990 && hasGenre(i, 'Science Fiction'),
  },
  {
    title: 'Westerns',
    accent: '#cc8844',
    order: 2,
    match: i => hasGenre(i, 'Western'),
  },
  {
    title: 'Classics',
    accent: '#e8d5a0',
    order: 3,
    match: i => i.year && i.year <= 1975 && (i.rating ?? i.audienceRating ?? 0) >= 7,
  },
  {
    title: 'Romance',
    accent: '#ff6699',
    order: 12,
    match: i => hasGenre(i, 'Romance'),
  },
];

export function computeStoreDims(itemCount, width = 44) {
  const unitsPerRow = Math.floor((width - 4) / (UNIT_WIDTH + UNIT_GAP + 0.25));
  const units = Math.ceil(itemCount / SLOTS_PER_UNIT);
  const rows = Math.ceil(units / unitsPerRow);
  const depth = Math.max(24, rows * (UNIT_DEPTH + AISLE_WIDTH) + 12);
  return { width, depth };
}

/*
 * build wall runs for a room: segments along the inner wall faces,
 * skipping doorway spans and corners. each run: { origin, dir, normal,
 * length } in world space.
 */
function buildWallRuns(dims, doorways = {}) {
  const { width, depth } = dims;
  const cx = dims.cx ?? 0;
  const cz = dims.cz ?? 0;
  const inset = 0.1 + UNIT_DEPTH / 2;
  const margin = 1.2;
  const runs = [];

  // split a 1d span [a, b] around door spans, returning kept intervals
  const splitSpan = (a, b, doors) => {
    let spans = [[a, b]];
    for (const d of doors) {
      const dMin = d.offset - d.width / 2 - 0.6;
      const dMax = d.offset + d.width / 2 + 0.6;
      const next = [];
      for (const [s, e] of spans) {
        if (dMax <= s || dMin >= e) { next.push([s, e]); continue; }
        if (dMin > s) next.push([s, dMin]);
        if (dMax < e) next.push([dMax, e]);
      }
      spans = next;
    }
    return spans.filter(([s, e]) => e - s >= UNIT_WIDTH);
  };

  // back wall: two segments leaving the centre clear for the marquee
  for (const [s, e] of splitSpan(-width / 2 + margin, width / 2 - margin,
    [{ offset: 0, width: 10 }, ...(doorways.back || [])])) {
    runs.push({
      origin: new THREE.Vector3(cx + s, 0, cz - depth / 2 + inset),
      dir: new THREE.Vector3(1, 0, 0),
      normal: new THREE.Vector3(0, 0, 1),
      length: e - s,
    });
  }

  // left wall (faces +x into the room)
  for (const [s, e] of splitSpan(-depth / 2 + margin, depth / 2 - margin, doorways.left || [])) {
    runs.push({
      origin: new THREE.Vector3(cx - width / 2 + inset, 0, cz + s),
      dir: new THREE.Vector3(0, 0, 1),
      normal: new THREE.Vector3(1, 0, 0),
      length: e - s,
    });
  }

  // right wall (faces -x into the room)
  for (const [s, e] of splitSpan(-depth / 2 + margin, depth / 2 - margin, doorways.right || [])) {
    runs.push({
      origin: new THREE.Vector3(cx + width / 2 - inset, 0, cz + s),
      dir: new THREE.Vector3(0, 0, 1),
      normal: new THREE.Vector3(-1, 0, 0),
      length: e - s,
    });
  }

  return runs;
}

/*
 * expand wall runs into wall unit descriptors, in run order.
 */
function wallUnitsFromRuns(runs) {
  const units = [];
  for (const run of runs) {
    const count = Math.floor((run.length + UNIT_GAP) / (UNIT_WIDTH + UNIT_GAP));
    for (let i = 0; i < count; i++) {
      const along = i * (UNIT_WIDTH + UNIT_GAP) + UNIT_WIDTH / 2;
      const centre = run.origin.clone().addScaledVector(run.dir, along);
      units.push({
        kind: 'wall',
        centre,
        dir: run.dir.clone(),
        normal: run.normal.clone(),
        rotationY: Math.atan2(run.normal.x, run.normal.z),
      });
    }
  }
  return units;
}

/*
 * fill one wall unit with items; returns slot descriptors.
 */
function fillWallUnit(unit, items) {
  const slots = [];
  const quat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(0, unit.rotationY, 0, 'YXZ'),
  );
  let idx = 0;
  for (let r = 0; r < WALL_ROWS && idx < items.length; r++) {
    const y = WALL_TOP_Y - r * WALL_ROW_STEP;
    for (let c = 0; c < COLS && idx < items.length; c++) {
      const along = -UNIT_WIDTH / 2 + (COLS - 1 - c) * (CASE_WIDTH + CASE_GAP_X)
        + CASE_WIDTH / 2 + CASE_GAP_X / 2;
      const pos = unit.centre.clone()
        .addScaledVector(unit.dir, along)
        .addScaledVector(unit.normal, UNIT_DEPTH / 2 + 0.02);
      pos.y = y;
      slots.push({ item: items[idx], position: pos, quat: quat.clone(), rotationY: unit.rotationY });
      idx++;
    }
  }
  return slots;
}

/*
 * fill one gondola unit (double-sided, sloped faces) with items.
 */
function fillGondolaUnit(x, z, items) {
  const slots = [];
  let idx = 0;
  for (let side = 0; side < 2 && idx < items.length; side++) {
    // side 0 faces -z, side 1 faces +z — always outward
    const sign = side === 0 ? -1 : 1;
    const rotationY = side === 0 ? Math.PI : 0;
    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-GONDOLA_TILT, rotationY, 0, 'YXZ'),
    );
    for (let r = 0; r < GONDOLA_ROWS && idx < items.length; r++) {
      const y = GONDOLA_BOTTOM_Y + (GONDOLA_ROWS - 1 - r) * GONDOLA_ROW_STEP + CASE_HEIGHT / 2;
      const half = gondolaHalfWidth(r);
      for (let c = 0; c < COLS && idx < items.length; c++) {
        const cx = x - UNIT_WIDTH / 2 + (COLS - 1 - c) * (CASE_WIDTH + CASE_GAP_X)
          + CASE_WIDTH / 2 + CASE_GAP_X / 2;
        slots.push({
          item: items[idx],
          position: new THREE.Vector3(cx, y, z + sign * half),
          quat: quat.clone(),
          rotationY,
        });
        idx++;
      }
    }
  }
  return slots;
}

/*
 * split items into curated + themed + genre sections, ordered so the
 * biggest genres and curated sections land nearest the entrance.
 */
function buildSections(items, extraAisle) {
  const claimed = new Set();
  const curated = [];

  for (const extra of (extraAisle || [])) {
    const sectionItems = (extra.items || []).filter(i => !claimed.has(i.ratingKey));
    if (sectionItems.length >= MIN_THEMED_SIZE) {
      sectionItems.forEach(i => claimed.add(i.ratingKey));
      curated.push({ title: extra.title, items: sectionItems, accent: extra.accent });
    }
  }

  for (const theme of THEMED_SECTIONS) {
    const sectionItems = items.filter(i => !claimed.has(i.ratingKey) && theme.match(i));
    if (sectionItems.length >= MIN_THEMED_SIZE) {
      sectionItems.forEach(i => claimed.add(i.ratingKey));
      curated.push({ title: theme.title, items: sectionItems, accent: theme.accent, order: theme.order ?? 0 });
    }
  }

  // display order: higher `order` lands later in the layout, i.e.
  // nearer the entrance; consecutive values sit in adjacent aisles
  curated.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const remaining = items.filter(i => !claimed.has(i.ratingKey));
  const groups = {};
  for (const item of remaining) {
    const genre = (item.genres && item.genres.length > 0) ? item.genres[0].tag : 'Hidden Gems';
    (groups[genre] ||= []).push(item);
  }
  const merged = [];
  for (const key of Object.keys(groups)) {
    if (key !== 'Hidden Gems' && groups[key].length < MIN_SECTION_SIZE) {
      merged.push(...groups[key]);
      delete groups[key];
    }
  }
  if (merged.length > 0) {
    (groups['Hidden Gems'] ||= []).push(...merged);
    groups['Hidden Gems'].sort((a, b) =>
      (a.titleSort || a.title).localeCompare(b.titleSort || b.title));
  }

  const genreSections = Object.keys(groups)
    .sort((a, b) => groups[a].length - groups[b].length)
    .map(genre => ({ title: genre, items: groups[genre], accent: colourForGenre(genre) }));

  return [...genreSections, ...curated];
}

function buildFeaturedSections(items) {
  const rating = (i) => i.rating ?? i.audienceRating ?? 0;
  const releaseDate = (i) => i.originallyAvailableAt
    ? Date.parse(i.originallyAvailableAt) || 0
    : (i.year ? Date.UTC(i.year, 0, 1) : 0);
  const hashKey = (key) => {
    let h = 0;
    const s = String(key);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  };

  return [
    {
      title: 'Continue Watching',
      items: [...items].filter(i => i.viewOffset > 0)
        .sort((a, b) => (b.lastViewedAt || 0) - (a.lastViewedAt || 0)).slice(0, SLOTS_PER_UNIT),
    },
    {
      title: 'New Releases',
      items: [...items].filter(i => releaseDate(i) > 0)
        .sort((a, b) => releaseDate(b) - releaseDate(a)).slice(0, SLOTS_PER_UNIT),
    },
    {
      title: 'Just In',
      items: [...items].filter(i => i.addedAt)
        .sort((a, b) => b.addedAt - a.addedAt).slice(0, SLOTS_PER_UNIT),
    },
    {
      title: 'Top Rated',
      items: [...items].filter(i => rating(i) > 0)
        .sort((a, b) => rating(b) - rating(a)).slice(0, SLOTS_PER_UNIT),
    },
    {
      title: 'Staff Picks',
      items: [...items].filter(i => rating(i) >= 7)
        .sort((a, b) => hashKey(a.ratingKey) - hashKey(b.ratingKey)).slice(0, SLOTS_PER_UNIT),
    },
    {
      title: 'So Bad Its Good',
      items: [...items].filter(i => i.rating != null && i.audienceRating != null
        && i.rating <= 5.0 && i.audienceRating >= 6.5)
        .sort((a, b) => (b.audienceRating - b.rating) - (a.audienceRating - a.rating))
        .slice(0, SLOTS_PER_UNIT),
    },
  ].filter(s => s.items.length > 0);
}

/*
 * main entry: compute the full layout for a room.
 * returns { slots, wallUnits, gondolaUnits, signs, collisionBoxes }.
 */
export function computeLayout(items, dims = {}, extraFeatured = [], opts = {}) {
  const width = dims.width ?? 44;
  const depth = dims.depth ?? 36;
  const cx = dims.cx ?? 0;
  const cz = dims.cz ?? 0;

  const slots = [];
  const wallUnits = [];
  const gondolaUnits = [];
  const signs = [];
  const collisionBoxes = [];

  const addWallUnit = (unit) => {
    wallUnits.push(unit);
    const half = new THREE.Vector3()
      .addScaledVector(unit.dir, UNIT_WIDTH / 2)
      .addScaledVector(unit.normal, UNIT_DEPTH / 2 + 0.15);
    const min = new THREE.Vector3(
      Math.min(unit.centre.x - Math.abs(half.x), unit.centre.x - 0.1),
      0,
      Math.min(unit.centre.z - Math.abs(half.z), unit.centre.z - 0.1),
    );
    const max = new THREE.Vector3(
      Math.max(unit.centre.x + Math.abs(half.x), unit.centre.x + 0.1),
      WALL_UNIT_HEIGHT,
      Math.max(unit.centre.z + Math.abs(half.z), unit.centre.z + 0.1),
    );
    collisionBoxes.push(new THREE.Box3(min, max));
  };

  const addGondolaUnit = (x, z, accent) => {
    gondolaUnits.push({ x, z, accent });
    collisionBoxes.push(new THREE.Box3(
      new THREE.Vector3(x - UNIT_WIDTH / 2, 0, z - 0.55),
      new THREE.Vector3(x + UNIT_WIDTH / 2, GONDOLA_HEIGHT, z + 0.55),
    ));
  };

  // ---- featured gondola row by the entrance (skipped in plain mode) ----
  const featuredZ = cz + depth / 2 - 4.5;
  const featured = opts.plainTitle ? [] : [
    ...extraFeatured.filter(s => s.items && s.items.length > 0),
    ...buildFeaturedSections(items),
  ];
  const featuredSpacing = UNIT_WIDTH + 1.2;
  const featuredStartX = cx - ((featured.length - 1) * featuredSpacing) / 2;
  featured.forEach((section, i) => {
    const x = featuredStartX + i * featuredSpacing;
    const accent = section.accent || HV_GOLD;
    addGondolaUnit(x, featuredZ, accent);
    slots.push(...fillGondolaUnit(x, featuredZ, section.items.slice(0, SLOTS_PER_UNIT))
      .map(s => ({ ...s })));
    signs.push({ text: section.title, style: 'topper', accent, position: new THREE.Vector3(x, GONDOLA_HEIGHT, featuredZ) });
  });

  // ---- section list for walls + gondola aisles ----
  const sections = opts.plainTitle
    ? [{ title: opts.plainTitle, items, accent: opts.plainAccent || '#d42027' }]
    : buildSections(items, opts.extraAisle);

  // wall units first, in perimeter order; then gondola grid
  const availableWallUnits = opts.plainTitle
    ? []
    : wallUnitsFromRuns(buildWallRuns(dims, opts.wallDoorways));
  let wallIdx = 0;

  const unitsPerRow = Math.floor((width - 4) / (UNIT_WIDTH + UNIT_GAP + 0.25));
  const rowStartX = cx - (unitsPerRow * (UNIT_WIDTH + UNIT_GAP + 0.25)) / 2 + UNIT_WIDTH / 2;
  const backStartZ = cz - depth / 2 + 2.6;
  const maxZ = featuredZ - AISLE_WIDTH - 1;
  let rowZ = backStartZ;
  let unitCol = 0;

  for (const section of sections) {
    let placed = 0;
    let signPlaced = false;
    const sItems = section.items;
    const accent = section.accent || HV_GOLD;

    while (placed < sItems.length) {
      if (wallIdx < availableWallUnits.length) {
        // next wall unit
        const unit = availableWallUnits[wallIdx++];
        unit.accent = accent;
        addWallUnit(unit);
        const unitSlots = fillWallUnit(unit, sItems.slice(placed, placed + WALL_SLOTS));
        slots.push(...unitSlots);
        placed += unitSlots.length;
        if (!signPlaced) {
          signs.push({
            text: section.title,
            style: 'wallmount',
            accent,
            rotationY: unit.rotationY,
            position: unit.centre.clone()
              .addScaledVector(unit.normal, UNIT_DEPTH / 2 + 0.05)
              .setY(WALL_UNIT_HEIGHT + 0.45),
          });
          signPlaced = true;
        }
      } else {
        // gondola grid
        if (unitCol >= unitsPerRow) {
          unitCol = 0;
          rowZ += UNIT_DEPTH + AISLE_WIDTH;
        }
        if (rowZ > maxZ && !opts.plainTitle) {
          console.warn(`[shelf-layout] out of room space at "${section.title}"`);
          return { slots, wallUnits, gondolaUnits, signs, collisionBoxes };
        }
        const x = rowStartX + unitCol * (UNIT_WIDTH + UNIT_GAP + 0.25);
        addGondolaUnit(x, rowZ, accent);
        const unitSlots = fillGondolaUnit(x, rowZ, sItems.slice(placed, placed + SLOTS_PER_UNIT));
        slots.push(...unitSlots);
        placed += unitSlots.length;
        // every gondola carries its section's topper, like a real store
        signs.push({
          text: section.title,
          style: 'topper',
          accent,
          position: new THREE.Vector3(x, GONDOLA_HEIGHT, rowZ),
        });
        signPlaced = true;
        unitCol++;
      }
    }
  }

  return { slots, wallUnits, gondolaUnits, signs, collisionBoxes };
}
