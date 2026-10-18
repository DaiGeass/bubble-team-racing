import { zoneAt, type VehicleMode, type Zone } from "./data";
import { getPaths } from "./trackCurve";

/** A solid alternate road keeps road rules even alongside a channel or flight line. */
export function zoneOnPath(pathId: number, progress: number): Zone | null {
  const path = getPaths()[pathId];
  if (!path || (!path.main && !path.def?.afloat)) return null;
  return zoneAt(progress);
}
export function modeFromZone(zone: Zone | null): VehicleMode {
  return !zone ? "land" : zone.type === "water" ? "boat" : zone.type === "sky" ? "plane" : zone.type === "sub" ? "sub" : "hover";
}
export function modeOnPath(pathId: number, progress: number): VehicleMode {
  return modeFromZone(zoneOnPath(pathId, progress));
}

/** Transforms do not carry a charged drift or a plane's climb offset into another mode. */
export function resetModeState(state: { mode: VehicleMode; flyOff: number; isDrifting: boolean; driftCharge: number; driftLevel: number; driftDir: number; driftAge: number; yaw: number; hop: number }, mode: VehicleMode): boolean {
  if (state.mode === mode) return false;
  state.mode = mode; state.flyOff = 0; state.isDrifting = false;
  state.driftCharge = 0; state.driftLevel = 0; state.driftDir = 0; state.driftAge = 0; state.yaw = 0; state.hop = 0;
  return true;
}
