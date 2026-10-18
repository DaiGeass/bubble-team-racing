/** Emit at a fixed rate, rather than once per display frame. */
export class EmissionBudget {
  private carry = 0;
  constructor(private readonly perSecond = 180) {}
  reset() { this.carry = 0; }
  take(delta: number, visible: boolean) {
    if (!visible || !Number.isFinite(delta) || delta <= 0) {
      this.reset();
      return 0;
    }
    this.carry += Math.min(delta, 0.1) * this.perSecond;
    const count = Math.floor(this.carry + 1e-9);
    this.carry = Math.max(0, this.carry - count);
    return count;
  }
}
