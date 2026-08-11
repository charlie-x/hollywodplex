/*
 * three-helpers.js — disposal utilities for three.js objects.
 * proper disposal prevents gpu memory leaks.
 */

/*
 * recursively dispose of a three.js object and all its children.
 */
export function disposeObject(obj) {
  if (!obj) return;

  // dispose children first
  while (obj.children && obj.children.length > 0) {
    disposeObject(obj.children[0]);
    obj.remove(obj.children[0]);
  }

  // dispose geometry
  if (obj.geometry) {
    obj.geometry.dispose();
  }

  // dispose material(s)
  if (obj.material) {
    disposeMaterial(obj.material);
  }

  // dispose texture if directly attached
  if (obj.texture) {
    obj.texture.dispose();
  }
}

/*
 * dispose a material and all its textures.
 */
export function disposeMaterial(material) {
  if (Array.isArray(material)) {
    for (const mat of material) {
      disposeMaterial(mat);
    }
    return;
  }

  // dispose textures on the material
  const textureProps = [
    'map', 'lightMap', 'bumpMap', 'normalMap', 'specularMap',
    'envMap', 'alphaMap', 'aoMap', 'displacementMap',
    'emissiveMap', 'metalnessMap', 'roughnessMap',
  ];
  for (const prop of textureProps) {
    if (material[prop]) {
      material[prop].dispose();
    }
  }

  material.dispose();
}

/*
 * safely remove and dispose a mesh from its parent.
 */
export function removeAndDispose(mesh, parent) {
  if (!mesh) return;
  if (parent) {
    parent.remove(mesh);
  }
  disposeObject(mesh);
}
