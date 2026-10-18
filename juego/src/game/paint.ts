import type { MeshPhysicalMaterialParameters } from "three";
import type { FinishId } from "../data";
/** One finish policy for declarative legacy meshes and shared craft palettes. */
export function paintOptions(color: string, finish: FinishId = "solid", metal = 0.55, rough = 0.14, flatShading = false): MeshPhysicalMaterialParameters {
  const [roughness, metalness] = finish === "gloss" ? [0.04,0.6] : finish === "matte" ? [0.92,0.05]
    : finish === "chrome" ? [0.03,1] : finish === "holo" ? [0.08,0.75] : finish === "glass" ? [0.02,0.1] : [rough,metal];
  const base = {color, roughness, metalness, flatShading};
  return finish === "holo" ? {...base, clearcoat:1, iridescence:1, iridescenceIOR:1.9, iridescenceThicknessRange:[140,780], sheen:1, sheenColor:"#ffffff"}
    : finish === "glass" ? {...base, clearcoat:1, clearcoatRoughness:0.02, transmission:0.72, thickness:0.9, ior:1.45, transparent:true, opacity:0.86} : base;
}
