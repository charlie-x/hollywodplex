/*
 * config.js — runtime configuration constants.
 * populated from the /api/config response at startup.
 */

let _config = {
  sections: [],
  maxTextureDimension: 512,
  concurrentLoads: 4,
  shelfColumns: 6,
};

export function setConfig(cfg) {
  _config = { ..._config, ...cfg };
}

export function getConfig() {
  return _config;
}

// frequently accessed constants — spawn by the entrance facing the
// featured racks (new releases / top rated / staff picks)
export const SPAWN_POSITION = { x: 0, y: 1.7, z: 13.5 };
export const PLAYER_HEIGHT = 1.7;
export const PLAYER_RADIUS = 0.3;
export const WALK_SPEED = 5;
export const RUN_SPEED = 8;
export const MOUSE_SENSITIVITY = 0.002;
export const MAX_PITCH = Math.PI / 2 - 0.01;
export const VIEW_DISTANCE = 16;
export const TEXTURE_LOAD_RANGE = 12;
export const TEXTURE_UNLOAD_RANGE = 18;
export const NEAR_PLANE = 0.1;
export const FAR_PLANE = 200;
export const FOV = 75;
