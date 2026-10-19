import type { VehicleMode } from "./data";

export type SkillKind = "drift" | "landing" | "near" | "pass" | "sling" | "route" | "maneuver";
export const CHAIN_WINDOW = 6;
/** Race time and furthest forward distance prevent farming in place or in reverse. */
export class SkillChain {
  count = 0;
  left = 0;
  kind: SkillKind | null = null;
  score = 0;
  private furthest = -Infinity;
  private lastAt = -Infinity;
  get multiplier() { return 1 + Math.min(4, Math.floor(this.count / 2)) * 0.25; }
  reset() { this.count = 0; this.left = 0; this.kind = null; }
  step(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.left = Math.max(0, this.left - dt);
    if (this.left < 1e-8) this.left = 0;
    if (this.left === 0) this.reset();
  }
  add(kind: SkillKind, distance: number, ms: number): number {
    if (!Number.isFinite(distance) || !Number.isFinite(ms) || distance < this.furthest + 12 || ms < this.lastAt + 450) return 0;
    this.furthest = distance; this.lastAt = ms;
    this.count = Math.min(8, this.count + 1); this.left = CHAIN_WINDOW; this.kind = kind;
    this.score += Math.round(60 * this.multiplier);
    return Math.min(0.04, 0.01 + this.count * 0.004);
  }
}

/** One clean pass per opponent and lap. Losing sight, contact or reversing disarms it. */
export class CleanPasses {
  private armed = new Set<string>();
  private rewarded = new Map<string, number>();
  private gaps = new Map<string, number>();
  resetArmed() { this.armed.clear(); this.gaps.clear(); }
  observe(id: string, lap: number, gap: number, close: boolean, clean: boolean): boolean {
    if (!clean || !close || !Number.isFinite(gap)) { this.armed.delete(id); this.gaps.delete(id); return false; }
    const previous = this.gaps.get(id); this.gaps.set(id, gap);
    if (previous !== undefined && Math.abs(gap - previous) > 12) { this.armed.delete(id); return false; }
    if (gap > 2 && gap < 25) this.armed.add(id);
    if (gap >= -2 || !this.armed.delete(id) || (this.rewarded.get(id) ?? -Infinity) >= lap) return false;
    this.rewarded.set(id, lap); return true;
  }
}

export interface DraftObservation { id: string; wake: boolean; exit: boolean }
/** A charged wake only releases on a lateral exit alongside the same real target. */
export class DraftCharge {
  charge = 0;
  target: string | null = null;
  reset() { this.charge = 0; this.target = null; }
  step(dt: number, observation: DraftObservation | null, eligible: boolean): boolean {
    if (!Number.isFinite(dt) || dt <= 0) return false;
    if (!eligible || !observation) { this.reset(); return false; }
    if (observation.id !== this.target) { this.charge = 0; this.target = observation.id; }
    if (observation.wake) this.charge = Math.min(1, this.charge + Math.min(dt, 0.1) / 1.3);
    else if (observation.exit && this.charge >= 0.95) { this.reset(); return true; }
    else this.charge = Math.max(0, this.charge - dt * 1.5);
    return false;
  }
}

export function isFinalLap(lap: number, laps: number, battle: boolean, finished: boolean): boolean {
  return !battle && !finished && laps > 1 && lap === laps;
}

export interface RaceSoundState { speed: number; mode: VehicleMode; final: boolean; combo: number; ms: number; boosting: boolean; surface?:import("./foley").SurfaceSound }
const ENGINE_HZ: Record<VehicleMode, number> = {land: 48, boat: 35, plane: 72, sub: 27, hover: 100};
export function raceSoundProfile(state: RaceSoundState) {
  const speed = Number.isFinite(state.speed) ? Math.max(0, Math.min(1, state.speed / 65)) : 0;
  const beat = (Number.isFinite(state.ms) ? Math.max(0, state.ms) : 0) * (state.final ? 136 : 112) / 60000;
  const step = Math.floor(beat * 2);
  return {
    engine: ENGINE_HZ[state.mode] * (1 + speed * 2.3 + (state.boosting ? 0.15 : 0)),
    wind: speed * speed * (state.mode === "sub" ? 0.025 : 0.065),
    engineGain: 0.016 + speed * 0.023,
    beat, step, bass: [55, 55, 65.41, 49][Math.floor(step / 8) % 4],
    leadGain: state.final ? 0.018 : state.combo >= 3 ? 0.01 : 0,
  };
}
