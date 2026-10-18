import { getActiveTrack, getPaths, groundAt, makeGround, terrainY, sectorIndexAt, F_SOLID } from "./trackCurve";
import type { ThemeDef } from "./data";
import { characterPhase } from "./modelDetail";
export type LifeKind = "flower" | "beacon" | "buoy" | "drone" | "vent";
export interface LifeSpot { x: number; y: number; z: number; angle: number; scale: number; phase: number; kind: LifeKind; color: string; glow: string }

/** Deterministic scenery outside every drivable ribbon, or safely at the ceiling. */
export function lifeSpots(themes: readonly ThemeDef[]): LifeSpot[] {
  const track = getActiveTrack(); const spots: LifeSpot[] = []; const ground = makeGround();
  const seed = characterPhase(track.id); const limit = track.indoor ? 32 : 64;
  const paths = getPaths();
  const spacing = Math.max(track.indoor ? 100 : 85, paths.reduce((sum, path) => sum + path.length, 0) / Math.max(8, limit - paths.length));
  for (const path of paths) {
    const step = Math.max(1, Math.round(spacing / path.ds));
    for (let i = Math.max(1, Math.round(35 / path.ds)); i < path.n - 1 && spots.length < limit; i += step) {
      if (!(path.flags[i] & F_SOLID)) continue;
      const phase = (seed * 6.28 + i * 1.719 + path.id) % 6.28;
      const side = (i + path.id) % 2 ? 1 : -1;
      const lat = side * (path.half[i] + (track.indoor ? -0.8 : 8 + (phase % 5)));
      const x = path.px[i] - path.tz[i] * lat; const z = path.pz[i] + path.tx[i] * lat;
      let y = path.py[i]; let kind: LifeKind = "beacon";
      if (track.indoor) { kind = "vent"; y += 6.4; }
      else {
        let blocked = false;
        for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]]) if (groundAt(x + dx, z + dz, 1e6, ground, 0)) { blocked = true; break; }
        if (blocked) continue;
        if (track.noGround && track.floor === undefined) { kind = "drone"; y += 2; }
        else if (track.floor !== undefined) y = terrainY(x, z);
        else y -= 2;
        if (track.sea !== undefined && y < track.sea + 0.4) { y = track.sea + 0.2; kind = "buoy"; }
      }
      const theme = themes[sectorIndexAt(path.prog[i])] ?? themes[0];
      if (!theme) continue;
      if (kind === "beacon" && ["tree", "pine", "palm", "tuft"].includes(theme.prop)) kind = "flower";
      spots.push({ x, y, z, angle: Math.atan2(path.tx[i], path.tz[i]), scale: track.indoor ? 0.8 : 0.8 + seed * 0.4, phase, kind, color: theme.barrierA, glow: theme.glow });
    }
  }
  return spots;
}
