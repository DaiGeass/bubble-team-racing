import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { vehicleLights } from "../modelDetail";
import type { VehicleMode } from "../data";
import type { KartVisualState } from "./Vehicle";

/** One small instanced draw per craft, no actual point lights or shadow passes. */
export default function VehicleDetails({ stateRef, narrow, decal }: { stateRef?: React.MutableRefObject<KartVisualState>; narrow: boolean; decal: string }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const panels = useRef<THREE.InstancedMesh>(null);
  const panelGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const panelMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: decal, metalness: 0.7, roughness: 0.22 }), [decal]);
  const lastMode = useRef<VehicleMode | null>(null);
  const phase = useRef(-1);
  const lastSteer = useRef(Infinity);
  const layouts = useMemo(() => Object.fromEntries((["land", "boat", "plane", "sub", "hover"] as const).map((mode) => [mode, vehicleLights(mode, narrow)])) as Record<VehicleMode, ReturnType<typeof vehicleLights>>, [narrow]);
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 8, 5), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  const scratch = useMemo(() => ({ dummy: new THREE.Object3D(), color: new THREE.Color() }), []);
  useEffect(() => { const instance = mesh.current; return () => { geometry.dispose(); material.dispose(); instance?.dispose(); }; }, [geometry, material]);
  useEffect(() => { lastMode.current = null; }, [layouts]);
  useEffect(() => { const instance = panels.current; return () => { panelGeometry.dispose(); instance?.dispose(); }; }, [panelGeometry]);
  useEffect(() => () => panelMaterial.dispose(), [panelMaterial]);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const mode = stateRef?.current.mode ?? "land";
    const list = layouts[mode];
    const tick = Math.floor(clock.elapsedTime * 4);
    const detail = panels.current;
    const steer = stateRef?.current.steer ?? 0;
    if (detail && (lastMode.current !== mode || mode === "plane" && Math.abs(steer - lastSteer.current) > 0.005)) {
      lastSteer.current = steer;
      for (let side = -1; side <= 1; side += 2) {
        const plane = mode === "plane";
        const sub = mode === "sub";
        const hover = mode === "hover";
        scratch.dummy.position.set(side * (narrow && mode === "land" ? 0.2 : plane ? 0.65 : 0.6), plane ? 0.72 : sub ? 0.52 : hover ? 0.20 : 0.38, plane || sub ? -0.45 : -0.1);
        scratch.dummy.scale.set(plane || sub ? 0.5 : 0.065, 0.045, plane || sub ? 0.32 : 1.55);
        scratch.dummy.rotation.set(plane ? (stateRef?.current.steer ?? 0) * side * 0.15 : 0, 0, 0);
        scratch.dummy.updateMatrix(); detail.setMatrixAt((side + 1) / 2, scratch.dummy.matrix);
      }
      scratch.dummy.rotation.set(0, 0, 0);
      detail.instanceMatrix.needsUpdate = true;
    }
    if (lastMode.current !== mode) {
      m.count = list.length;
      list.forEach((light, i) => {
        scratch.dummy.position.set(light.x, light.y, light.z);
        scratch.dummy.scale.set(light.sx, light.sy, light.sz);
        scratch.dummy.updateMatrix(); m.setMatrixAt(i, scratch.dummy.matrix);
      });
      m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
      lastMode.current = mode; phase.current = -1;
    }
    if (tick !== phase.current) {
      list.forEach((light, i) => m.setColorAt(i, scratch.color.set(light.color).multiplyScalar(light.pulse && tick % 4 !== 0 ? 0.4 : 1.7)));
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      phase.current = tick;
    }
  });
  return <group dispose={null}>
    <instancedMesh ref={mesh} args={[geometry, material, 4]} />
    <instancedMesh ref={panels} args={[panelGeometry, panelMaterial, 2]} frustumCulled={false} />
  </group>;
}
