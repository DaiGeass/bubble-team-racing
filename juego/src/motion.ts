/** Exponential damping calibrated to the existing response at 60 Hz. */
export function frameBlend(at60: number, dt: number): number {
  return dt > 0 ? 1 - Math.pow(1 - at60, dt * 60) : 0;
}

/** Friction cannot turn a coasting vehicle into reverse. */
export function coast(speed: number, dt: number): number {
  return Math.sign(speed) * Math.max(0, Math.abs(speed) - 8 * Math.max(0, dt));
}

/** The offline starting lights advance only with unpaused simulation time. */
export class RaceCountdown {
  elapsed = 0;
  advance(dt: number, paused: boolean): number {
    if (!paused && Number.isFinite(dt)) this.elapsed += Math.max(0, Math.min(dt, 0.1));
    // Avoid a one-frame delay caused by accumulated fractional frame times.
    return this.elapsed + 1e-9 >= 3.9 ? -1 : Math.max(0, 3 - Math.floor(this.elapsed + 1e-9));
  }
  get started(): boolean { return this.elapsed + 1e-9 >= 3; }
}
