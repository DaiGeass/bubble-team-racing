import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { drainParticleQueue } from "../particles";

const POOL = 260;

interface PData {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
  active: boolean;
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
      const t = p.life / p.maxLife;
      dummy.position.copy(p.pos);
      dummy.scale.setScalar(p.size * t);
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
