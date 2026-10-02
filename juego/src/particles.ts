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
}

const queue: ParticleBurstRequest[] = [];

export function emitParticles(req: ParticleBurstRequest) {
  queue.push(req);
}

export function drainParticleQueue(): ParticleBurstRequest[] {
  if (queue.length === 0) return [];
  const copy = queue.splice(0, queue.length);
  return copy;
}

// Screen shake shared state
export const shakeState = { trauma: 0 };
export function addShake(amount: number) {
  shakeState.trauma = Math.min(1, shakeState.trauma + amount);
}
