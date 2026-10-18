/** Exact critically damped spring: stable for short frames and frame stalls. */
export class Spring {
  value = 0;
  velocity = 0;
  reset(value = 0) { this.value = value; this.velocity = 0; }
  step(target: number, rate: number, dt: number): number {
    if (!(dt > 0) || !Number.isFinite(dt)) return this.value;
    const offset = this.value - target;
    const drive = this.velocity + rate * offset;
    const decay = Math.exp(-rate * dt);
    this.value = target + (offset + drive * dt) * decay;
    this.velocity = (this.velocity - rate * drive * dt) * decay;
    return this.value;
  }
}
