/** Reward a real, clean jump once; bumps, crashes and respawns cannot charge it. */
export class LandingBonus {
  private airtime = 0;
  reset() { this.airtime = 0; }
  step(dt: number, airborne: boolean, impact: number, speed: number, clean: boolean): number {
    if (!clean || !Number.isFinite(dt) || dt <= 0) { this.reset(); return 0; }
    if (airborne) { this.airtime += Math.min(dt, 0.1); return 0; }
    const time = this.airtime;
    this.reset();
    if (time + 1e-9 < 0.45 || impact < 4 || speed < 8) return 0;
    return 0.08 + Math.min(0.04, Math.max(0, time - 0.45) * 0.04);
  }
}
