import TrackActors from "./TrackActors";
import { getActiveTrack } from "../trackCurve";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { lifeSpots } from "../trackLife";
import type { ThemeDef } from "../data";

/** Local scenery cells animate at 30 Hz; distant cells keep their cached matrices. */
export function TrackLife({ themes }: { themes: ThemeDef[] }) {
  const assets = useMemo(() => ({ base: new THREE.ConeGeometry(0.24, 1.4, 8), head: new THREE.SphereGeometry(1, 10, 6), blade: new THREE.BoxGeometry(1, 1, 1),
    body: new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3 }), light: new THREE.MeshBasicMaterial({ toneMapped: false }) }), []);
  const spots = useMemo(() => lifeSpots(themes), [themes]);
  const cells = useMemo(() => {
    const grouped = new Map<string, ReturnType<typeof lifeSpots>>();
    for (const spot of spots) {
      const key = `${Math.floor(spot.x / 128)},${Math.floor(spot.z / 128)}`;
      const list = grouped.get(key) ?? []; list.push(spot); grouped.set(key, list);
    }
    const dummy = new THREE.Object3D(); const color = new THREE.Color();
    return Array.from(grouped.values(), (spots) => {
      const base = new THREE.InstancedMesh(assets.base, assets.body, spots.length);
      const head = new THREE.InstancedMesh(assets.head, assets.light, spots.length);
      const blade = new THREE.InstancedMesh(assets.blade, assets.body, spots.length * 2);
      const box = new THREE.Box3();
      spots.forEach((s, i) => {
        const vent = s.kind === "vent";
        dummy.position.set(s.x, s.y + (vent ? 0 : 0.65 * s.scale), s.z); dummy.rotation.set(0, s.angle, vent ? Math.PI : 0);
        dummy.scale.set(s.scale, vent ? 0.15 : s.scale, s.scale); dummy.updateMatrix(); base.setMatrixAt(i, dummy.matrix); base.setColorAt(i, color.set(s.color));
        head.setColorAt(i, color.set(s.glow).multiplyScalar(1.25));
        for (let k = 0; k < 2; k++) blade.setColorAt(i * 2 + k, color.set(k ? s.glow : s.color));
        box.expandByPoint(dummy.position); box.expandByPoint(new THREE.Vector3(s.x, s.y + 2, s.z));
      });
      base.instanceMatrix.needsUpdate = true; base.computeBoundingSphere();
      head.instanceMatrix.setUsage(THREE.DynamicDrawUsage); blade.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const bounds = box.getBoundingSphere(new THREE.Sphere()); bounds.radius += 4;
      head.boundingSphere = bounds.clone(); blade.boundingSphere = bounds.clone();
      // The global animation clock supplies the pose when a cell enters the view.
      head.count = 0; blade.count = 0;
      return { spots, base, head, blade, bounds };
    });
  }, [assets, spots]);
  const scratch = useMemo(() => ({ d: new THREE.Object3D(), frustum: new THREE.Frustum(), matrix: new THREE.Matrix4() }), []);
  const elapsed = useRef(1);
  useEffect(() => () => cells.forEach((c) => { c.base.dispose(); c.head.dispose(); c.blade.dispose(); }), [cells]);
  useEffect(() => () => Object.values(assets).forEach((asset) => asset.dispose()), [assets]);
  useFrame(({ camera, clock }, dt) => {
    elapsed.current += dt;
    if (elapsed.current < 1 / 30) return;
    elapsed.current %= 1 / 30;
    scratch.frustum.setFromProjectionMatrix(scratch.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const time = clock.elapsedTime; const d = scratch.d;
    for (const cell of cells) {
      if (!scratch.frustum.intersectsSphere(cell.bounds)) continue;
      cell.head.count = cell.spots.length; cell.blade.count = cell.spots.length * 2;
      cell.spots.forEach((s, i) => {
        const vent = s.kind === "vent"; const drone = s.kind === "drone"; const flower = s.kind === "flower";
        const sway = Math.sin(time * (drone ? 1.1 : 1.7) + s.phase);
        const y = s.y + (vent ? -0.22 : 1.35 * s.scale) + (vent ? 0 : sway * (drone ? 0.35 : 0.10));
        const x = s.x + (flower ? sway * 0.16 : 0);
        d.position.set(x, y, s.z); d.rotation.set(0, time * 0.5 + s.phase, 0);
        d.scale.set(flower ? 0.32 : 0.18, flower ? 0.13 : 0.18, flower ? 0.32 : 0.18); d.updateMatrix(); cell.head.setMatrixAt(i, d.matrix);
        for (let k = 0; k < 2; k++) {
          d.position.set(x, y - (flower ? 0.12 : 0), s.z);
          d.rotation.set(0, (vent ? time * 7 : drone ? time * 4 : s.angle + sway * 0.2) + k * Math.PI / 2, 0);
          d.scale.set(vent ? 1 : drone ? 0.85 : flower ? 0.55 : 0.35, 0.065, flower ? 0.26 : 0.16);
          d.updateMatrix(); cell.blade.setMatrixAt(i * 2 + k, d.matrix);
        }
      });
      cell.head.instanceMatrix.needsUpdate = true; cell.blade.instanceMatrix.needsUpdate = true;
    }
  });
  return <group dispose={null}><TrackActors spots={spots} indoor={!!getActiveTrack().indoor} />{cells.map((cell) => <group key={cell.base.uuid}><primitive object={cell.base} /><primitive object={cell.head} /><primitive object={cell.blade} /></group>)}</group>;
}
