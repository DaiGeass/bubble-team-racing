import * as THREE from "three";

export interface ParticleBurstRequest {
  position: THREE.Vector3 | [number, number, number];
  color: string;
  count: number;
  speed: number;
  spread: number;
  size: number;
  life: number;
  gravity?: number;
  upBias?: number;
  /** debris falls onto the road and bounces instead of dropping through it */
  ground?: boolean;
  /** 0 = boxy chassis chunk, 1 = fine spark */
  shape?: number;
}

const queue: ParticleBurstRequest[] = [];

export function emitParticles(req: ParticleBurstRequest) {
  queue.push(req);
}

/** Chassis panels torn off a kart: they fall, bounce twice and stay on the road. */
export function emitDebris(req: Omit<ParticleBurstRequest, "ground">) {
  queue.push({ ...req, ground: true, shape: 0, gravity: req.gravity ?? 22, upBias: req.upBias ?? 0.35 });
}

export function drainParticleQueue(): ParticleBurstRequest[] {
  if (queue.length === 0) return [];
  const copy = queue.splice(0, queue.length);
  return copy;
}

// Screen shake shared state
export const shakeState = { trauma: 0 };
let shakeScale: () => number = () => 1;
/** camera shake slider, 0 disables it entirely */
export function bindShakeScale(fn: () => number) {
  shakeScale = fn;
}

export function addShake(amount: number) {
  let k = 1;
  try {
    k = shakeScale();
  } catch {
    k = 1;
  }
  if (k <= 0) return;
  shakeState.trauma = Math.min(1, shakeState.trauma + amount * k);
}
