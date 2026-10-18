import * as THREE from "three";
export interface Placement { m: THREE.Matrix4; colour: THREE.Color }

/** Same instances and shared resources, in small bounds that the renderer can cull. */
export function spatialInstances(geometry: THREE.BufferGeometry, material: THREE.Material, list: readonly Placement[], cellSize = 128): THREE.InstancedMesh[] {
  if (!(cellSize > 0) || !Number.isFinite(cellSize)) throw new Error("Invalid instance cell size");
  const cells = new Map<string, Placement[]>();
  for (const item of list) {
    const e = item.m.elements;
    const key = `${Math.floor(e[12] / cellSize)},${Math.floor(e[14] / cellSize)}`;
    let cell = cells.get(key);
    if (!cell) { cell = []; cells.set(key, cell); }
    cell.push(item);
  }
  return Array.from(cells.values(), (cell) => {
    const mesh = new THREE.InstancedMesh(geometry, material, cell.length);
    for (let i = 0; i < cell.length; i++) { mesh.setMatrixAt(i, cell[i].m); mesh.setColorAt(i, cell[i].colour); }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    return mesh;
  });
}
