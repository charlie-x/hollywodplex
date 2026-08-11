/*
 * materials.js — shared material factories for the 3d scene.
 */

import * as THREE from 'three';

// genre colour palette for shelves and neon signs
export const GENRE_COLOURS = {
  'Action': '#ff4444',
  'Adventure': '#ff8844',
  'Animation': '#ffcc44',
  'Comedy': '#44ff44',
  'Crime': '#444444',
  'Documentary': '#888844',
  'Drama': '#4488ff',
  'Family': '#ff88cc',
  'Fantasy': '#cc44ff',
  'History': '#886644',
  'Horror': '#ff2266',
  'Music': '#44ccff',
  'Mystery': '#8844ff',
  'Romance': '#ff6699',
  'Science Fiction': '#44ffcc',
  'Sport': '#88cc44',
  'Thriller': '#ff6644',
  'War': '#888844',
  'Western': '#cc8844',
};

export function colourForGenre(genre) {
  return GENRE_COLOURS[genre] || '#888888';
}

export function wallMaterial(colour = '#181830') {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(colour),
    roughness: 0.8,
    metalness: 0.05,
  });
}

export function floorMaterial() {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#141428'),
    roughness: 0.9,
    metalness: 0.02,
  });
}

export function ceilingMaterial() {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#0d0d1a'),
    roughness: 0.9,
    metalness: 0.0,
  });
}

export function emissiveStrip(colour, intensity = 2.0) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(colour),
    emissive: new THREE.Color(colour),
    emissiveIntensity: intensity,
    roughness: 0.2,
    metalness: 0.1,
  });
}

export function caseBodyMaterial(colour = '#2a2a40') {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(colour),
    roughness: 0.6,
    metalness: 0.1,
  });
}

export function posterPlaceholder() {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2a2a3e'),
    roughness: 0.7,
    metalness: 0.05,
  });
}

// hollywood video fixtures were light putty-grey, not blockbuster navy
export function shelfUnitMaterial(colour = '#a09c92') {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(colour),
    roughness: 0.65,
    metalness: 0.15,
  });
}
