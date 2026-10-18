import * as THREE from "three";
/** Bounds of the selected, visible model only; hidden transforms do not zoom it out. */
export function visibleModelBounds(root: THREE.Object3D, out = new THREE.Box3()): THREE.Box3 {
  out.makeEmpty(); root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  root.traverseVisible((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.previewIgnore || !mesh.geometry) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (materials.every((material) => !material.visible || material.opacity <= 0)) return;
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
      const instanced = mesh as THREE.InstancedMesh;
      if (!instanced.count) return;
      instanced.computeBoundingBox(); if (instanced.boundingBox) out.union(box.copy(instanced.boundingBox).applyMatrix4(mesh.matrixWorld));
    } else {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      if (mesh.geometry.boundingBox) out.union(box.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld));
    }
  });
  return out;
}
