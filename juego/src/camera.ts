import { Spring } from "./spring";
export const CAMERA_STYLES = ["follow", "immersive", "stable"] as const;
export type CameraStyle = typeof CAMERA_STYLES[number];
export const CAMERA_PROFILES = {
  follow: { distance: 1, height: 1, follow: 7, bank: 0, dynamicFov: 1, shake: 1 },
  immersive: { distance: 0.88, height: 0.86, follow: 8, bank: 0.025, dynamicFov: 0.8, shake: 0.65 },
  stable: { distance: 1.08, height: 1.08, follow: 9, bank: 0, dynamicFov: 0, shake: 0 },
} satisfies Record<CameraStyle, { distance: number; height: number; follow: number; bank: number; dynamicFov: number; shake: number }>;

/** Follows the shortest turn and cuts directly to a new spawn/portal location. */
export class CameraFollow {
  private ready = false;
  private x = 0;
  private y = 0;
  private z = 0;
  angle = 0;
  update(x: number, y: number, z: number, target: number, dt: number): boolean {
    const snap = !this.ready || Math.hypot(x - this.x, y - this.y, z - this.z) > 45;
    const turn = Math.atan2(Math.sin(target - this.angle), Math.cos(target - this.angle));
    this.angle = snap ? target : this.angle + turn * (1 - Math.exp(-10 * Math.max(0, dt)));
    this.ready = true;
    this.x = x; this.y = y; this.z = z;
    return snap;
  }
}

const clamp = (x: number, limit: number) => Math.max(-limit, Math.min(limit, x));

/** Preview the selected ribbon, only when driving forwards along it. */
export function curvePreview(path: { n: number; ds: number; closed: boolean; tx: Float32Array; tz: Float32Array }, idx: number, heading: number, speed: number): number {
  if (speed < 3 || !path.n) return 0;
  const i = Math.max(0, Math.min(path.n - 1, Math.round(idx)));
  const facing = Math.atan2(path.tx[i], path.tz[i]);
  if (Math.cos(heading - facing) < 0.65) return 0;
  const ahead = i + Math.round((14 + Math.min(speed, 50) * 0.45) / path.ds);
  const j = path.closed ? ahead % path.n : Math.min(path.n - 1, ahead);
  const turn = Math.atan2(path.tx[j], path.tz[j]) - facing;
  return clamp(Math.atan2(Math.sin(turn), Math.cos(turn)), 0.65);
}

/** Small, bounded camera reactions; no scene traversal or allocation per frame. */
export class CameraDynamics {
  readonly landing = new Spring();
  boost = 0;
  curve = 0;
  side = 0;
  acceleration = 0;
  clock = 0;
  private speed = 0;
  private airborne = false;
  private vy = 0;
  update(dt: number, speed: number, steer: number, curve: number, boost: boolean, airborne: boolean, vy: number, reset: boolean, idle: boolean) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const h = Math.min(dt, 0.1);
    if (reset) {
      this.boost = 0; this.curve = 0; this.side = 0; this.acceleration = 0;
      this.landing.reset(); this.speed = speed; this.airborne = airborne; this.vy = vy;
    }
    if (!idle) this.clock += h;
    const ease = (rate: number) => 1 - Math.exp(-rate * h);
    if (!idle && this.airborne && !airborne && this.vy < -3) this.landing.velocity -= Math.min(2.2, -this.vy * 0.075);
    this.landing.step(0, 11, h);
    this.boost += ((boost && !idle ? 1 : 0) - this.boost) * ease(boost ? 8 : 4);
    this.curve += ((idle || airborne ? 0 : curve) - this.curve) * ease(4);
    this.side += ((idle ? 0 : clamp(steer, 1) * Math.min(Math.abs(speed) / 30, 1)) - this.side) * ease(4.5);
    const acceleration = idle ? 0 : clamp((speed - this.speed) / h / 30, 1);
    this.acceleration += (acceleration - this.acceleration) * ease(4);
    this.speed = speed; this.airborne = airborne; this.vy = vy;
  }
}
