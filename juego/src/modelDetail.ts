import type { VehicleMode } from "./data";
export interface DetailLight { x: number; y: number; z: number; sx: number; sy: number; sz: number; color: string; pulse: boolean }
/** Lighting and small machined details fit the common mounting points of every craft. */
export function vehicleLights(mode: VehicleMode, narrow = false): DetailLight[] {
  const list: DetailLight[] = [];
  const light = (x: number, y: number, z: number, color: string, pulse = false, sx = 0.09, sy = 0.06, sz = 0.06) => list.push({ x, y, z, color, pulse, sx, sy, sz });
  const w = narrow ? 0.22 : 0.48;
  if (mode === "land") {
    for (const side of [-1, 1]) { light(side * w, 0.47, 1.25, "#fff7ce", false, 0.14, 0.055); light(side * w, 0.47, -1.12, "#ff405c", false, 0.12, 0.045); }
  } else if (mode === "plane") {
    light(-0.68, 0.69, -0.2, "#ff405c"); light(0.68, 0.69, -0.2, "#55ffc7");
    light(0, 0.98, -0.65, "#ffffff", true); light(0, 0.44, 1.2, "#fff7ce", false, 0.13);
  } else if (mode === "boat") {
    light(-0.7, 0.55, 0.25, "#ff405c"); light(0.7, 0.55, 0.25, "#55ffc7"); light(0, 1.0, -0.65, "#ffffff", true);
  } else if (mode === "sub") {
    for (const side of [-1, 1]) light(side * 0.34, 0.61, 1.15, "#a8f2ff", false, 0.16, 0.11, 0.09);
    light(0, 1.08, -0.35, "#7cffb7", true);
  } else {
    for (const side of [-1, 1]) for (const z of [-0.8, 0.8]) light(side * 0.65, 0.25, z, "#b18cff", true, 0.14, 0.035, 0.2);
  }
  return list;
}

export function characterPhase(id: string): number {
  let seed = 2166136261;
  for (let i = 0; i < id.length; i++) seed = Math.imul(seed ^ id.charCodeAt(i), 16777619);
  return (seed >>> 0) / 4294967296;
}
/** Short staggered blinks; a stunned pilot squints instead of strobing. */
export function eyeOpen(time: number, personality: number, stunned: boolean): number {
  if (stunned) return 0.4;
  const period = 3.2 + personality * 2.4;
  const phase = ((time + personality * period) % period + period) % period;
  return phase < 0.15 ? Math.max(0.08, Math.abs(phase / 0.075 - 1)) : 1;
}

/** Conservative fit for the rotating model, including tall and wide craft. */
export function previewDistance(radius: number, fovDegrees: number, aspect: number): number {
  const vertical = fovDegrees * Math.PI / 360;
  const horizontal = Math.atan(Math.tan(vertical) * Math.max(0.1, aspect));
  return Math.max(5, Math.max(0.1, radius) * 1.12 / Math.sin(Math.min(vertical, horizontal)));
}
