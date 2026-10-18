import * as THREE from "three";
import type { ShapeId, WheelStyle } from "../data";

const FLOATING = new Set<ShapeId>(["hover", "ufo", "tank", "orbit", "phantom", "board", "pod"]);
export const hasRoadWheels = (shape: ShapeId) => !FLOATING.has(shape);

/** Four wheels share two geometries/materials, private to this vehicle's effects. */
export function createWheelResources(style: WheelStyle) {
  const rim = style === "sporty" ? "#ff3b6b" : style === "glow" ? "#7dffea" : style === "chrome" ? "#e8f1ff" : style === "spike" ? "#ffb347" : "#3a3f55";
  const tireGeometry = new THREE.CylinderGeometry(0.48, 0.48, style === "spike" ? 0.44 : 0.36, 14);
  const rimGeometry = style === "spike" ? new THREE.IcosahedronGeometry(0.3, 0) : new THREE.CylinderGeometry(0.26, 0.26, 0.38, style === "chrome" ? 16 : 10);
  const tireMaterial = new THREE.MeshStandardMaterial({ color: style === "spike" ? "#242018" : "#15161d", roughness: style === "spike" ? 0.95 : 0.7 });
  const rimMaterial = new THREE.MeshStandardMaterial({ color: rim, emissive: rim,
    emissiveIntensity: style === "spike" ? 0.4 : style === "glow" ? 2.4 : style === "sporty" ? 0.6 : style === "chrome" ? 0.15 : 0.1,
    roughness: style === "spike" ? 0.4 : style === "chrome" ? 0.05 : 0.25,
    metalness: style === "spike" ? 0.5 : style === "chrome" ? 1 : 0.7, toneMapped: style !== "chrome" });
  return { tireGeometry, rimGeometry, tireMaterial, rimMaterial,
    dispose() { tireGeometry.dispose(); rimGeometry.dispose(); tireMaterial.dispose(); rimMaterial.dispose(); } };
}
