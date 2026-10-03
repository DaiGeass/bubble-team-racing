import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { drainParticleQueue } from "../particles";
import { groundAt, makeGround } from "../trackCurve";

const floorProbe = makeGround();

const POOL = 260;

interface PData {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
  active: boolean;
  /** settles on the road like a piece of chassis */
  ground: boolean;
  shape: number;
  settled: boolean;
}

export default function ParticleSystem() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo<PData[]>(
    () =>
      Array.from({ length: POOL }, () => ({
        pos: new THREE.Vector3(0, -1000, 0),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        size: 0.2,
        gravity: 9,
        active: false,
        ground: false,
        shape: 1,
        settled: false,
      })),
    []
  );
  const cursor = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const reqs = drainParticleQueue();
    for (const req of reqs) {
      const pos = Array.isArray(req.position) ? new THREE.Vector3(...req.position) : req.position.clone();
      const color = new THREE.Color(req.color);
      for (let i = 0; i < req.count; i++) {
        const idx = cursor.current;
        cursor.current = (cursor.current + 1) % POOL;
        const p = particles[idx];
        p.active = true;
        p.pos.copy(pos);
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * req.spread;
        p.vel.set(Math.cos(angle) * r, (req.upBias ?? 0.6) + Math.random() * req.speed * 0.6, Math.sin(angle) * r);
        p.vel.multiplyScalar(req.speed);
        p.life = req.life * (0.7 + Math.random() * 0.6);
        p.maxLife = p.life;
        p.size = req.size * (0.6 + Math.random() * 0.8);
        p.gravity = req.gravity ?? 9;
        p.ground = !!req.ground;
        p.shape = req.shape ?? 1;
        p.settled = false;
        if (meshRef.current) meshRef.current.setColorAt(idx, color);
      }
    }
    if (meshRef.current && meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;

    for (let i = 0; i < POOL; i++) {
      const p = particles[i];
      if (!p.active) {
        dummy.position.set(0, -1000, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        meshRef.current?.setMatrixAt(i, dummy.matrix);
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        dummy.position.set(0, -1000, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        meshRef.current?.setMatrixAt(i, dummy.matrix);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      if (p.ground && !p.settled) {
        // chassis debris lands on the road and skids to a stop
        const gy = groundAt(p.pos.x, p.pos.z, p.pos.y + 1, floorProbe, 0) ? floorProbe.y + p.size * 0.45 : -Infinity;
        if (p.pos.y <= gy) {
          p.pos.y = gy;
          if (Math.abs(p.vel.y) < 1.2) {
            p.settled = true;
            p.vel.set(0, 0, 0);
          } else {
            p.vel.y = -p.vel.y * 0.32;
            p.vel.x *= 0.66;
            p.vel.z *= 0.66;
          }
        }
      }
      const t = p.life / p.maxLife;
      dummy.position.copy(p.pos);
      if (p.settled) {
        // flat panel lying on the tarmac
        dummy.scale.set(p.size * 1.5, p.size * 0.28, p.size * 1.1);
        dummy.rotation.set(0, p.pos.x * 0.7 + p.pos.z * 0.3, 0);
      } else {
        dummy.scale.setScalar(p.size * t);
        dummy.rotation.set(p.pos.y * 2.3, p.pos.x * 1.7, p.pos.z * 1.1);
      }
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(i, dummy.matrix);
    }
    if (meshRef.current) meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, POOL]} frustumCulled={false}>
      <icosahedronGeometry args={[0.18, 0]} />
      <meshStandardMaterial vertexColors toneMapped={false} emissive="#ffffff" emissiveIntensity={0.15} />
    </instancedMesh>
  );
}
