import { Spring } from "../spring";

/** Suspension and driver follow-through; weight changes the pose, not the physics. */
export class VehicleMotion {
  readonly suspension = new Spring();
  pitch = 0;
  lean = 0;
  private speed = 0;
  private ready = false;
  private airborne = false;
  private vy = 0;
  update(dt: number, speed: number, steer: number, airborne: boolean, vy: number, weight: number) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    const h = Math.min(dt, 0.1);
    if (!this.ready) { this.speed = speed; this.ready = true; }
    const heft = Math.max(1, Math.min(5, weight));
    const acceleration = Math.max(-1, Math.min(1, (speed - this.speed) / h / 25));
    if (this.airborne && !airborne && this.vy < -3) this.suspension.velocity -= Math.min(3, -this.vy * 0.12);
    const ease = 1 - Math.exp(-7 * h);
    this.pitch += ((-acceleration * 0.10 / Math.sqrt(heft)) - this.pitch) * ease;
    this.lean += ((-steer * Math.min(Math.abs(speed) / 22, 1) * (0.15 - heft * 0.012)) - this.lean) * ease;
    this.suspension.step(0, 11 + heft, h);
    this.speed = speed; this.airborne = airborne; this.vy = vy;
  }
}
