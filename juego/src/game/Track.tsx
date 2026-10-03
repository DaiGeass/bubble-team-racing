import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { trackCurve, halfWidthAt, getActiveTrack, getShortcuts, nearestT, trackPointAt, trackTangentAt, surfaceYAt, trapTransform, portalTransform, gapOffsetAt } from "../trackCurve";
import { TRACK_WIDTH, ZONES, SKY_ALTITUDE, hazardState, zoneAt, zoneOfKind, type ThemeDef, type Zone, type ZoneKind } from "../data";

const SEGMENTS = 760;

function makeRoadTexture(theme: ThemeDef) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = theme.road;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  for (let i = 0; i < 220; i++) ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  ctx.fillStyle = theme.roadEdge;
  ctx.fillRect(8, 0, 12, size);
  ctx.fillRect(size - 20, 0, 12, size);
  ctx.fillStyle = theme.roadLine;
  for (let y = 0; y < size; y += 34) ctx.fillRect(size / 2 - 5, y, 10, 18);
  if (theme.id === "techno") {
    ctx.strokeStyle = "rgba(0,255,198,0.5)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (i * size) / 6);
      ctx.lineTo(size, (i * size) / 6);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function buildRoadGeometry() {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const repeatY = trackCurve.getLength() / TRACK_WIDTH;

  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    const center = trackCurve.getPointAt(t);
    const tangent = trackCurve.getTangentAt(t);
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const half = halfWidthAt(t);
    // gaps move the tarmac itself, so the ribbon has to move with them
    let y = center.y + 0.02 + gapOffsetAt(t);
    // dip the road under water inside lake (shallow) and submarine (deep) zones
    for (const z of ZONES) {
      if (z.type === "sky") continue;
      if (t >= z.t0 - 0.015 && t <= z.t1 + 0.015) {
        const u = (t - z.t0) / (z.t1 - z.t0);
        const depth = z.type === "sub" ? 0 : 0.55;
        y -= depth * Math.sin(Math.min(1, Math.max(0, u)) * Math.PI);
      }
    }
    const left = center.clone().addScaledVector(normal, half);
    const right = center.clone().addScaledVector(normal, -half);
    positions.push(left.x, y, left.z, right.x, y, right.z);
    const v = t * repeatY;
    uvs.push(0, v, 1, v);
  }
  for (let i = 0; i < SEGMENTS; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildBarriers() {
  const count = 300;
  const mats: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const t = i / count;
    // open shores: no walls in lake / submarine sections
    if (ZONES.some((z) => z.type !== "sky" && t >= z.t0 - 0.01 && t <= z.t1 + 0.01)) continue;
    const center = trackCurve.getPointAt(t);
    const tangent = trackCurve.getTangentAt(t);
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const angle = Math.atan2(tangent.x, tangent.z);
    const half = halfWidthAt(t) + 0.7;
    for (const side of [1, -1]) {
      const p = center.clone().addScaledVector(normal, half * side);
      dummy.position.set(p.x, 0.55, p.z);
      dummy.rotation.set(0, angle, 0);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());
    }
  }
  return mats;
}

/** Split-lane islands: the road forks into two drivable paths around a strip. */
function ForkIslands({ theme }: { theme: ThemeDef }) {
  const forks = getActiveTrack().forks;
  return (
    <group>
      {forks.map(([f0, f1], fi) => {
        const N = 26;
        const pos: number[] = [];
        const idx: number[] = [];
        for (let i = 0; i <= N; i++) {
          const t = f0 + ((f1 - f0) * i) / N;
          const c = trackCurve.getPointAt(t);
          const tan = trackCurve.getTangentAt(t);
          const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
          const l = c.clone().addScaledVector(n, 1.9);
          const r = c.clone().addScaledVector(n, -1.9);
          pos.push(l.x, 0.14, l.z, r.x, 0.14, r.z);
        }
        for (let i = 0; i < N; i++) {
          const a = i * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        return (
          <group key={`fk${fi}`}>
            <mesh geometry={g} receiveShadow>
              <meshStandardMaterial color={theme.isle} roughness={0.9} side={THREE.DoubleSide} />
            </mesh>
            {/* glowing arrows signalling the split */}
            {[0.28, 0.72].map((k, ai) => {
              const t = f0 + (f1 - f0) * k;
              const c = trackCurve.getPointAt(t);
              const tan = trackCurve.getTangentAt(t);
              return (
                <mesh key={ai} position={[c.x, c.y + 0.3, c.z]} rotation={[0, Math.atan2(tan.x, tan.z), 0]}>
                  <torusGeometry args={[1.4, 0.16, 8, 22]} />
                  <meshBasicMaterial color={theme.glow} transparent opacity={0.75} toneMapped={false} />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

/** Mutating hazards: glowing pillars sliding across the road, pattern changes each lap. */
function MovingHazards({ theme }: { theme: ThemeDef }) {
  const count = Math.max(2, getActiveTrack().hazards);
  const refs = useRef<(THREE.Group | null)[]>([]);
  const bases = useMemo(() => {
    const out: { t: number; phase: number; dir: number }[] = [];
    for (let i = 0; i < count; i++) {
      let ht = (i + 0.75) / (count + 1);
      for (let guard = 0; guard < 12 && zoneAt(ht); guard++) ht = (ht + 0.035) % 1; // keep hazards on dry road
      out.push({ t: ht, phase: Math.random() * Math.PI * 2, dir: i % 2 === 0 ? 1 : -1 });
    }
    return out;
  }, [count]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const lapPhase = hazardState.lap * 1.7; // the map mutates every lap
    refs.current.forEach((g, i) => {
      if (!g) return;
      const b = bases[i];
      const t = b.t;
      const c = trackCurve.getPointAt(t);
      const tan = trackCurve.getTangentAt(t);
      const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      const spread = halfWidthAt(t) - 2.4;
      const speed = 0.7 + (hazardState.lap % 3) * 0.22;
      const off = Math.sin(time * speed + b.phase + lapPhase) * spread * b.dir;
      g.position.copy(c).addScaledVector(n, off);
      g.position.y = 1.15 + Math.sin(time * 2 + b.phase) * 0.15;
      g.rotation.y = time * 1.4 + b.phase;
      if (i === 0) hazardState.positions = [];
      hazardState.positions[i] = { x: g.position.x, z: g.position.z, t };
    });
  });

  return (
    <group>
      {bases.map((_b, i) => (
        <group key={`hz${i}`} ref={(el) => (refs.current[i] = el)}>
          <mesh castShadow>
            <octahedronGeometry args={[1.15, 0]} />
            <meshStandardMaterial
              color={theme.barrierA}
              emissive={i % 2 ? theme.barrierB : theme.barrierA}
              emissiveIntensity={2.2}
              roughness={0.15}
              metalness={0.4}
              toneMapped={false}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.75, 0.12, 8, 22]} />
            <meshBasicMaterial color={theme.glow} transparent opacity={0.55} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function BarrierRing({ matrices, theme }: { matrices: THREE.Matrix4[]; theme: ThemeDef }) {
  return (
    <instancedMesh
      args={[undefined, undefined, matrices.length]}
      ref={(m) => {
        if (!m) return;
        const c1 = new THREE.Color(theme.barrierA);
        const c2 = new THREE.Color(theme.barrierB);
        matrices.forEach((mat, i) => {
          m.setMatrixAt(i, mat);
          m.setColorAt(i, i % 2 === 0 ? c1 : c2);
        });
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }}
    >
      <capsuleGeometry args={[0.24, 0.7, 4, 8]} />
      <meshStandardMaterial
        vertexColors
        roughness={0.25}
        metalness={0.2}
        emissive={theme.glow}
        emissiveIntensity={theme.id === "techno" ? 0.9 : 0.25}
      />
    </instancedMesh>
  );
}

function Props({ theme }: { theme: ThemeDef }) {
  const items = useMemo(() => {
    const arr: { pos: THREE.Vector3; rot: number; s: number; kind: number }[] = [];
    for (let i = 0; i < 86; i++) {
      const t = i / 86;
      const center = trackCurve.getPointAt(t);
      const tangent = trackCurve.getTangentAt(t);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const z = ZONES.find((zz) => t >= zz.t0 - 0.02 && t <= zz.t1 + 0.02);
      const side = (i % 2 === 0 ? 1 : -1) * (z ? 2.4 : 1);
      const dist = TRACK_WIDTH / 2 + 4 + Math.random() * 12;
      const p = center.clone().addScaledVector(normal, side * dist);
      const g = groundReach(t);
      p.y = Math.min(groundYAt(t, dist - g.edge), surfaceYAt(nearestT(p, t))) - 0.25;
      arr.push({ pos: p, rot: Math.random() * Math.PI, s: 0.8 + Math.random() * 0.9, kind: i % 3 });
    }
    return arr;
  }, []);

  return (
    <group>
      {items.map((it, i) => (
        <group key={i} position={[it.pos.x, it.pos.y, it.pos.z]} rotation={[0, it.rot, 0]} scale={it.s}>
          {theme.prop === "palm" && (
            <>
              <mesh position={[0, 1.6, 0]} castShadow>
                <cylinderGeometry args={[0.16, 0.26, 3.2, 7]} />
                <meshStandardMaterial color="#c98b52" roughness={0.9} />
              </mesh>
              {[0, 1, 2, 3, 4].map((k) => (
                <mesh key={k} position={[0, 3.2, 0]} rotation={[0.5, (k / 5) * Math.PI * 2, 0.3]} castShadow>
                  <coneGeometry args={[0.35, 2.1, 5]} />
                  <meshStandardMaterial color={theme.isle} roughness={0.7} />
                </mesh>
              ))}
            </>
          )}
          {theme.prop === "crystal" && (
            <mesh position={[0, 1.4, 0]} castShadow>
              <octahedronGeometry args={[1.3, 0]} />
              <meshStandardMaterial color={theme.glow} emissive={theme.glow} emissiveIntensity={1.1} roughness={0.1} metalness={0.4} toneMapped={false} />
            </mesh>
          )}
          {theme.prop === "circuit" && (
            <>
              <mesh position={[0, 2.2, 0]} castShadow>
                <boxGeometry args={[0.5, 4.4, 0.5]} />
                <meshStandardMaterial color="#1a1f4a" emissive={it.kind === 0 ? theme.barrierA : theme.barrierB} emissiveIntensity={1.5} toneMapped={false} />
              </mesh>
              <mesh position={[0, 4.6, 0]}>
                <sphereGeometry args={[0.42, 10, 10]} />
                <meshStandardMaterial color={theme.glow} emissive={theme.glow} emissiveIntensity={2.4} toneMapped={false} />
              </mesh>
            </>
          )}
          {theme.prop === "tree" && (
            <>
              <mesh position={[0, 1, 0]} castShadow>
                <cylinderGeometry args={[0.22, 0.3, 2, 7]} />
                <meshStandardMaterial color="#8b5a2b" roughness={0.95} />
              </mesh>
              <mesh position={[0, 2.7, 0]} castShadow>
                <icosahedronGeometry args={[1.5, 0]} />
                <meshStandardMaterial color={theme.isle} roughness={0.85} flatShading />
              </mesh>
            </>
          )}
          {theme.prop === "coral" && (
            <>
              <mesh position={[0, 1.1, 0]} castShadow>
                <coneGeometry args={[0.7, 2.4, 6]} />
                <meshStandardMaterial color={theme.barrierA} roughness={0.5} emissive={theme.barrierA} emissiveIntensity={0.3} />
              </mesh>
              <mesh position={[0.5, 0.7, 0.2]} castShadow>
                <sphereGeometry args={[0.55, 8, 8]} />
                <meshStandardMaterial color={theme.barrierB} roughness={0.5} />
              </mesh>
            </>
          )}
          {theme.prop === "y2k" && (
            <>
              <mesh position={[0, 1.4, 0]}>
                <cylinderGeometry args={[0.1, 0.1, 2.8, 6]} />
                <meshStandardMaterial color="#e8e8ff" metalness={1} roughness={0.1} />
              </mesh>
              <mesh position={[0, 3.3, 0]} castShadow>
                <sphereGeometry args={[1.15, 20, 16]} />
                <meshStandardMaterial color={it.kind === 0 ? theme.barrierA : theme.barrierB} metalness={1} roughness={0.06} emissive={theme.glow} emissiveIntensity={0.3} />
              </mesh>
              <mesh position={[0, 3.3, 0]} rotation={[Math.PI / 2.3, 0.4, 0]}>
                <torusGeometry args={[1.7, 0.07, 8, 28]} />
                <meshBasicMaterial color="#ffffff" toneMapped={false} />
              </mesh>
            </>
          )}
          {theme.prop === "win98" && (
            <group position={[0, 2.4, 0]} rotation={[0, 0, 0.05]}>
              <mesh castShadow>
                <boxGeometry args={[3.4, 2.4, 0.2]} />
                <meshStandardMaterial color="#c0c0c0" roughness={0.8} />
              </mesh>
              <mesh position={[0, 1.0, 0.12]}>
                <boxGeometry args={[3.2, 0.32, 0.06]} />
                <meshStandardMaterial color="#000080" emissive="#000080" emissiveIntensity={0.7} />
              </mesh>
              <mesh position={[0, -0.2, 0.12]}>
                <boxGeometry args={[3.0, 1.6, 0.05]} />
                <meshStandardMaterial color={it.kind === 0 ? "#ffffff" : "#00a0a0"} roughness={0.9} />
              </mesh>
              <mesh position={[1.3, 1.0, 0.17]}>
                <boxGeometry args={[0.24, 0.2, 0.04]} />
                <meshStandardMaterial color="#c0c0c0" />
              </mesh>
            </group>
          )}
          {theme.prop === "liquid" && (
            <>
              <mesh position={[0, 1.8, 0]} scale={[1, 1.5, 1]} castShadow>
                <sphereGeometry args={[1.3, 24, 18]} />
                <meshPhysicalMaterial color={it.kind === 0 ? theme.barrierA : theme.barrierB} transparent opacity={0.5} roughness={0.02} clearcoat={1} iridescence={1} iridescenceIOR={1.6} depthWrite={false} />
              </mesh>
              <mesh position={[0.3, 2.2, 0.5]} scale={0.35}>
                <sphereGeometry args={[0.8, 10, 10]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.8} toneMapped={false} />
              </mesh>
            </>
          )}
          {theme.prop === "vapor" && (
            <>
              <mesh position={[0, 2.4, 0]} castShadow>
                <cylinderGeometry args={[0.55, 0.65, 4.8, 12]} />
                <meshStandardMaterial color="#f4d6ff" roughness={0.3} emissive={theme.barrierA} emissiveIntensity={0.25} />
              </mesh>
              <mesh position={[0, 4.95, 0]}>
                <boxGeometry args={[1.7, 0.3, 1.7]} />
                <meshStandardMaterial color="#f4d6ff" roughness={0.3} />
              </mesh>
              <mesh position={[0, 6.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[1.0, 0.09, 8, 28]} />
                <meshBasicMaterial color={it.kind === 0 ? theme.barrierA : theme.barrierB} toneMapped={false} />
              </mesh>
            </>
          )}
          {theme.prop === "cactus" && (
            <>
              <mesh position={[0, 1.4, 0]} castShadow>
                <capsuleGeometry args={[0.42, 2, 5, 10]} />
                <meshStandardMaterial color="#5fa463" roughness={0.8} />
              </mesh>
              <mesh position={[0.6, 1.5, 0]} rotation={[0, 0, -0.7]} castShadow>
                <capsuleGeometry args={[0.22, 0.9, 4, 8]} />
                <meshStandardMaterial color="#5fa463" roughness={0.8} />
              </mesh>
            </>
          )}
        </group>
      ))}
    </group>
  );
}

function SkyRings({ theme }: { theme: ThemeDef }) {
  const rings = useMemo(() => {
    const z = zoneOfKind("sky");
    const out: { pos: THREE.Vector3; angle: number }[] = [];
    const n = 7;
    if (!z) return out;
    for (let i = 0; i < n; i++) {
      const t = z.t0 + ((i + 0.5) / n) * (z.t1 - z.t0);
      const p = trackCurve.getPointAt(t);
      const tan = trackCurve.getTangentAt(t);
      const u = (t - z.t0) / (z.t1 - z.t0);
      out.push({ pos: new THREE.Vector3(p.x, p.y + Math.sin(u * Math.PI) * SKY_ALTITUDE + 1.6, p.z), angle: Math.atan2(tan.x, tan.z) });
    }
    return out;
  }, []);
  return (
    <group>
      {rings.map((r, i) => (
        <mesh key={i} position={r.pos.toArray()} rotation={[0, r.angle, 0]}>
          <torusGeometry args={[3.4, 0.32, 10, 28]} />
          <meshStandardMaterial color={theme.glow} emissive={theme.glow} emissiveIntensity={2.6} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Terrain that follows the circuit: every vertex drops away from the height of the road
 * it is closest to, so an elevated circuit sits on a valley floor instead of a flat disc.
 */
/**
 * Ground for the whole lap. The old terrain was a polar mesh around the origin,
 * which stopped at 560 units while the circuits run to ~2000, so most of every
 * track floated over nothing. This one follows the road: a shoulder of terrain
 * either side plus a cliff face dropping from the road edge, so a raised section
 * reads as a solid plateau and a dip reads as a valley.
 */
/** how far the terrain reaches beside the road at t, capped by the corner radius */
function groundReach(t: number) {
  const c = trackCurve.getPointAt(t);
  const ahead = trackCurve.getPointAt((t + 0.004) % 1).clone().sub(c);
  const behind = c.clone().sub(trackCurve.getPointAt((t - 0.004 + 1) % 1));
  const turn = Math.abs(Math.atan2(ahead.x * behind.z - ahead.z * behind.x, ahead.x * behind.x + ahead.z * behind.z));
  const radius = turn > 1e-4 ? ahead.length() / turn : 9999;
  return { reach: Math.min(145, Math.max(26, radius * 0.42)), edge: halfWidthAt(t) + 1.6 };
}

/** height of the terrain d metres out from the road edge */
export function groundYAt(t: number, lateral: number) {
  const g = groundReach(t);
  const d = Math.max(0, Math.min(lateral, g.reach) - g.edge);
  return trackCurve.getPointAt(t).y + groundDrop(d, t);
}

function groundDrop(d: number, t: number) {
  const wobble = Math.sin(t * 260 + d * 0.31) * 0.5 + Math.sin(t * 90 - d * 0.17) * 1.15 + Math.sin(t * 517 + d * 0.07) * 0.8;
  return -1.2 - Math.min(17, d * 0.085) + wobble * Math.min(1, d / 26);
}

function buildGround() {
  const STEPS = 420; // samples around the lap
  // distance out from the road edge, both sides
  const BAND = [0, 3, 7, 12, 18, 26, 36, 48, 62, 78, 96, 118, 145];
  const cols: number[] = [];
  const ground: number[] = [];
  const skirt: number[] = [];
  const gIdx: number[] = [];
  const sIdx: number[] = [];
  const tan = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const prev = new THREE.Vector3();

  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const c = trackCurve.getPointAt(t);
    trackCurve.getTangentAt(t, tan);
    nrm.set(-tan.z, 0, tan.x).normalize();
    const { reach, edge } = groundReach(t);

    for (const side of [1, -1]) {
      const rowStart = ground.length / 3;
      for (const d of BAND) {
        const lat = edge + Math.min(d, reach);
        pos.copy(c).addScaledVector(nrm, side * lat);
        const y = c.y + groundDrop(lat - edge, t);
        ground.push(pos.x, y, pos.z);
        const shade = Math.min(1, (lat - edge) / (reach - edge || 1));
        // verge near the road, darker as it runs away
        const near = 1 - Math.min(1, (lat - edge) / 16);
        const v = 1 + near * 0.22 - shade * 0.34;
        cols.push(v, v * (0.99 - near * 0.02), v * (0.96 + near * 0.06));
      }
      // cliff from the road edge down to the ground band
      const sRow = skirt.length / 3;
      pos.copy(c).addScaledVector(nrm, side * edge);
      skirt.push(pos.x, c.y - 0.25, pos.z);
      pos.copy(c).addScaledVector(nrm, side * (edge + 3));
      skirt.push(pos.x, c.y + groundDrop(3, t) + 0.1, pos.z);

      const nb = BAND.length;
      for (let b = 0; b < nb - 1; b++) {
        const a = rowStart + b;
        if (side === 1) gIdx.push(a, a + nb, a + 1, a + 1, a + nb, a + nb + 1);
        else gIdx.push(a, a + 1, a + nb, a + 1, a + nb + 1, a + nb);
      }
      const s0 = sRow;
      if (side === 1) sIdx.push(s0, s0 + 1, s0 + 2, s0 + 1, s0 + 3, s0 + 2);
      else sIdx.push(s0, s0 + 2, s0 + 1, s0 + 1, s0 + 2, s0 + 3);
    }
    prev.copy(c);
  }
  void prev;

  const mk = (p: number[], idx: number[], colored: boolean) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    if (colored) g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  return { terrain: mk(ground, gIdx, true), skirt: mk(skirt, sIdx, false) };
}

function buildRibbon(halfWidth: number, y: number, pad: number, kind: ZoneKind = "water") {
  const z = zoneOfKind(kind);
  const N = 70;
  if (!z) return new THREE.BufferGeometry();
  const t0 = z.t0 - pad;
  const span = z.t1 - z.t0 + pad * 2;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = ((t0 + (span * i) / N) % 1 + 1) % 1;
    const c = trackCurve.getPointAt(t);
    const tan = trackCurve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const l = c.clone().addScaledVector(n, halfWidth);
    const r = c.clone().addScaledVector(n, -halfWidth);
    positions.push(l.x, c.y + y, l.z, r.x, c.y + y, r.z);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function Lake({ theme }: { theme: ThemeDef }) {
  const shore = useMemo(() => buildRibbon(TRACK_WIDTH / 2 + 12, -0.42, 0.02, "water"), []);
  const water = useMemo(() => buildRibbon(TRACK_WIDTH / 2 + 9, -0.3, 0.012, "water"), []);
  return (
    <group>
      <mesh geometry={shore} receiveShadow>
        <meshStandardMaterial color={theme.isle} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={water} receiveShadow>
        <meshStandardMaterial color={theme.water} transparent opacity={0.9} roughness={0.05} metalness={0.45} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Clouds({ theme }: { theme: ThemeDef }) {
  const clouds = useMemo(() => {
    const arr: [number, number, number, number][] = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const r = 420 + Math.random() * 420;
      arr.push([Math.cos(a) * r, 26 + Math.random() * 26, Math.sin(a) * r, 5 + Math.random() * 6]);
    }
    return arr;
  }, []);
  return (
    <group>
      {clouds.map((p, i) => (
        <group key={i} position={[p[0], p[1], p[2]]}>
          <mesh>
            <sphereGeometry args={[p[3], 10, 10]} />
            <meshStandardMaterial color={theme.cloud} roughness={1} transparent opacity={0.92} />
          </mesh>
          <mesh position={[p[3] * 0.85, -p[3] * 0.18, 0]}>
            <sphereGeometry args={[p[3] * 0.7, 10, 10]} />
            <meshStandardMaterial color={theme.cloud} roughness={1} transparent opacity={0.92} />
          </mesh>
          <mesh position={[-p[3] * 0.75, -p[3] * 0.12, 0.4]}>
            <sphereGeometry args={[p[3] * 0.6, 10, 10]} />
            <meshStandardMaterial color={theme.cloud} roughness={1} transparent opacity={0.92} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function StartArch({ theme }: { theme: ThemeDef }) {
  const p0 = trackCurve.getPointAt(0);
  const tangent = trackCurve.getTangentAt(0);
  const angle = Math.atan2(tangent.x, tangent.z);
  return (
    <group position={[p0.x, p0.y, p0.z]} rotation={[0, angle, 0]}>
      <mesh position={[-TRACK_WIDTH / 2 - 0.7, 3.4, 0]} castShadow>
        <boxGeometry args={[0.7, 6.8, 0.7]} />
        <meshStandardMaterial color={theme.barrierA} emissive={theme.barrierA} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[TRACK_WIDTH / 2 + 0.7, 3.4, 0]} castShadow>
        <boxGeometry args={[0.7, 6.8, 0.7]} />
        <meshStandardMaterial color={theme.barrierB} emissive={theme.barrierB} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 7, 0]} castShadow>
        <boxGeometry args={[TRACK_WIDTH + 2.6, 1, 1]} />
        <meshStandardMaterial color={theme.glow} emissive={theme.glow} emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      {/* checkered strip */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <planeGeometry args={[TRACK_WIDTH, 3]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} />
      </mesh>
    </group>
  );
}

/** Living scenery: rising glass bubbles, hot-air balloons, butterflies, pulsing zone gates. */
function AmbientLife({ theme }: { theme: ThemeDef }) {
  const BUB = 70;
  const bubRef = useRef<THREE.InstancedMesh>(null);
  const bubData = useMemo(
    () =>
      Array.from({ length: BUB }, () => ({
        x: (Math.random() - 0.5) * 340,
        z: (Math.random() - 0.5) * 340,
        y: Math.random() * 26,
        speed: 0.9 + Math.random() * 1.6,
        size: 0.25 + Math.random() * 0.75,
        wob: Math.random() * Math.PI * 2,
      })),
    []
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const balloons = useMemo(
    () =>
      [0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.7;
        return { x: Math.cos(a) * 120, z: Math.sin(a) * 120, y: 17 + i * 4, ph: i * 2.1, col: theme.particles[i % theme.particles.length] };
      }),
    [theme]
  );
  const balloonRefs = useRef<(THREE.Group | null)[]>([]);

  const FLY = 7;
  const flyRefs = useRef<(THREE.Group | null)[]>([]);
  const flyWings = useRef<(THREE.Mesh | null)[]>([]);
  const flyData = useMemo(
    () =>
      Array.from({ length: FLY }, (_, i) => ({
        t: Math.random(),
        speed: 0.012 + Math.random() * 0.01,
        side: (i % 2 === 0 ? 1 : -1) * (TRACK_WIDTH / 2 + 3 + Math.random() * 7),
        h: 2.2 + Math.random() * 3.5,
        ph: Math.random() * 9,
        col: theme.particles[i % theme.particles.length],
      })),
    [theme]
  );

  const gates = useMemo(
    () =>
      ZONES.map((z) => {
        const p = trackCurve.getPointAt(z.t0);
        const tan = trackCurve.getTangentAt(z.t0);
        return { pos: new THREE.Vector3(p.x, 0.3, p.z), angle: Math.atan2(tan.x, tan.z), water: z.type === "water" };
      }),
    []
  );
  const gateRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    // rising bubbles
    const m = bubRef.current;
    if (m) {
      for (let i = 0; i < BUB; i++) {
        const b = bubData[i];
        b.y += b.speed * dt;
        if (b.y > 30) b.y = -1;
        dummy.position.set(b.x + Math.sin(t * 0.7 + b.wob) * 1.6, b.y, b.z + Math.cos(t * 0.55 + b.wob) * 1.6);
        dummy.scale.setScalar(b.size);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    }
    // balloons bob + drift
    balloonRefs.current.forEach((g, i) => {
      if (!g) return;
      const b = balloons[i];
      g.position.set(b.x + Math.sin(t * 0.14 + b.ph) * 9, b.y + Math.sin(t * 0.5 + b.ph) * 1.6, b.z + Math.cos(t * 0.12 + b.ph) * 9);
      g.rotation.y = t * 0.1 + b.ph;
    });
    // butterflies along the track
    flyRefs.current.forEach((g, i) => {
      if (!g) return;
      const f = flyData[i];
      f.t = (f.t + f.speed * dt) % 1;
      const p = trackCurve.getPointAt(f.t);
      const tan = trackCurve.getTangentAt(f.t);
      const nrm = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      g.position.copy(p).addScaledVector(nrm, f.side);
      g.position.y = f.h + Math.sin(t * 2.3 + f.ph) * 0.8;
      g.rotation.y = Math.atan2(tan.x, tan.z);
      const w = flyWings.current[i];
      if (w) w.rotation.z = Math.sin(t * 16 + f.ph) * 0.8;
    });
    // pulsing zone gates
    gateRefs.current.forEach((g, i) => {
      if (!g) return;
      const s = 1 + Math.sin(t * 2.6 + i * 2) * 0.08;
      g.scale.setScalar(s);
      (g.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(t * 2.6 + i * 2) * 0.25;
    });
  });

  return (
    <group>
      <instancedMesh ref={bubRef} args={[undefined, undefined, BUB]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.3} roughness={0.05} clearcoat={1} depthWrite={false} />
      </instancedMesh>
      {balloons.map((b, i) => (
        <group key={`bl${i}`} ref={(el) => (balloonRefs.current[i] = el)} position={[b.x, b.y, b.z]}>
          <mesh castShadow>
            <sphereGeometry args={[2.6, 14, 14]} />
            <meshStandardMaterial color={b.col} roughness={0.3} emissive={b.col} emissiveIntensity={0.25} />
          </mesh>
          <mesh scale={[1.03, 1.03, 1.03]}>
            <sphereGeometry args={[2.6, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.28} toneMapped={false} />
          </mesh>
          <mesh position={[0, -3.3, 0]}>
            <boxGeometry args={[1.1, 0.9, 1.1]} />
            <meshStandardMaterial color="#b98a5a" roughness={0.9} />
          </mesh>
          {[-0.45, 0.45].map((x) =>
            [-0.45, 0.45].map((z) => (
              <mesh key={`${x}${z}`} position={[x, -2.1, z]}>
                <cylinderGeometry args={[0.025, 0.025, 1.6, 4]} />
                <meshStandardMaterial color="#8a6a48" />
              </mesh>
            ))
          )}
        </group>
      ))}
      {flyData.map((f, i) => (
        <group key={`fl${i}`} ref={(el) => (flyRefs.current[i] = el)}>
          <mesh>
            <capsuleGeometry args={[0.07, 0.3, 4, 6]} />
            <meshStandardMaterial color="#2b2f3a" roughness={0.6} />
          </mesh>
          <mesh ref={(el) => (flyWings.current[i] = el)}>
            <planeGeometry args={[0.9, 0.5]} />
            <meshStandardMaterial color={f.col} emissive={f.col} emissiveIntensity={0.6} side={THREE.DoubleSide} transparent opacity={0.85} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* multi-aesthetic glass life: floating droplets + rainbow prism arcs */}
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        const r = 130 + (i % 5) * 46;
        return (
          <mesh key={`dr${i}`} position={[Math.cos(a) * r, 6 + (i % 4) * 3.5, Math.sin(a) * r]} scale={0.9 + (i % 3) * 0.5}>
            <icosahedronGeometry args={[1.1, 1]} />
            <meshPhysicalMaterial color={theme.particles[i % 4]} transparent opacity={0.5} roughness={0.02} clearcoat={1} iridescence={1} iridescenceIOR={1.8} depthWrite={false} />
          </mesh>
        );
      })}
      {[0, 1, 2].map((i) => (
        <mesh key={`rc${i}`} position={[(i - 1) * 150, 26 + i * 6, -90 + i * 120]} rotation={[0, i * 1.1, 0]}>
          <torusGeometry args={[26 + i * 5, 0.5, 8, 44, Math.PI]} />
          <meshStandardMaterial color={theme.particles[i]} emissive={theme.particles[(i + 1) % 4]} emissiveIntensity={1.1} transparent opacity={0.65} toneMapped={false} />
        </mesh>
      ))}
      {gates.map((g, i) => (
        <mesh
          key={`gt${i}`}
          ref={(el) => (gateRefs.current[i] = el)}
          position={g.pos.toArray()}
          rotation={[0, g.angle, 0]}
        >
          <torusGeometry args={[TRACK_WIDTH / 2 + 1, 0.3, 8, 36]} />
          <meshBasicMaterial color={g.water ? theme.water : theme.glow} transparent opacity={0.55} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function zoneRibbon(zone: Zone, halfWidth: number, y: number, pad: number) {
  const N = 90;
  const t0 = zone.t0 - pad;
  const span = zone.t1 - zone.t0 + pad * 2;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = (((t0 + (span * i) / N) % 1) + 1) % 1;
    const c = trackCurve.getPointAt(t);
    const tan = trackCurve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const l = c.clone().addScaledVector(n, halfWidth);
    const r = c.clone().addScaledVector(n, -halfWidth);
    positions.push(l.x, y, l.z, r.x, y, r.z);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** Submarine section: translucent water sheet over a sunken road + glowing glass arches. */
function SubZone({ theme }: { theme: ThemeDef }) {
  const zone = ZONES.find((z) => z.type === "sub");
  // water-filled glass tube that swallows the road (aquarium tunnel)
  const geo = useMemo(() => {
    if (!zone) return null;
    const pts: THREE.Vector3[] = [];
    const N = 40;
    for (let i = 0; i <= N; i++) {
      const t = zone.t0 + ((zone.t1 - zone.t0) * i) / N;
      const p = trackCurve.getPointAt(t);
      pts.push(new THREE.Vector3(p.x, 2.4, p.z));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 8.4, 20, false);
  }, [zone]);
  const seabed = useMemo(() => (zone ? zoneRibbon(zone, TRACK_WIDTH / 2 + 3, 0.0, 0.0) : null), [zone]);
  const arches = useMemo(() => {
    if (!zone) return [];
    const out: { pos: THREE.Vector3; angle: number; i: number }[] = [];
    const n = 14;
    for (let i = 0; i < n; i++) {
      const t = zone.t0 + ((i + 0.5) / n) * (zone.t1 - zone.t0);
      const p = trackCurve.getPointAt(t);
      const tan = trackCurve.getTangentAt(t);
      out.push({ pos: new THREE.Vector3(p.x, 0.1, p.z), angle: Math.atan2(tan.x, tan.z), i });
    }
    return out;
  }, [zone]);
  if (!zone || !geo || !seabed) return null;
  return (
    <group>
      <mesh geometry={seabed}>
        <meshStandardMaterial color={theme.isle} roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geo}>
        <meshPhysicalMaterial color={theme.water} transparent opacity={0.24} roughness={0.03} metalness={0.2} clearcoat={1} iridescence={0.6} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {arches.map((a) => (
        <mesh key={a.i} position={a.pos.toArray()} rotation={[0, a.angle, 0]}>
          <torusGeometry args={[TRACK_WIDTH / 2 + 0.6, 0.16, 8, 28, Math.PI]} />
          <meshStandardMaterial color={theme.glow} emissive={a.i % 2 ? theme.barrierA : theme.glow} emissiveIntensity={2.2} transparent opacity={0.75} toneMapped={false} />
        </mesh>
      ))}
      {/* bubbles rising inside the water tube */}
      {arches.map((a, i) => (
        <mesh key={`b${i}`} position={[a.pos.x + Math.sin(i * 2.1) * 4, 1.2 + (i % 4) * 0.9, a.pos.z + Math.cos(i * 1.7) * 4]}>
          <sphereGeometry args={[0.28 + (i % 3) * 0.12, 8, 8]} />
          <meshPhysicalMaterial color="#ffffff" transparent opacity={0.4} roughness={0.05} clearcoat={1} depthWrite={false} />
        </mesh>
      ))}
      <SubFish zone={zone} />
    </group>
  );
}

/** Little glass fish school swimming along the underwater tunnel. */
function SubFish({ zone }: { zone: Zone }) {
  const FISH = 10;
  const refs = useRef<(THREE.Group | null)[]>([]);
  const data = useMemo(
    () =>
      Array.from({ length: FISH }, (_, i) => ({
        u: Math.random(),
        speed: 0.02 + Math.random() * 0.03,
        side: (i % 2 === 0 ? 1 : -1) * (2 + Math.random() * 4),
        h: 1.2 + Math.random() * 2.2,
        wobble: Math.random() * 9,
      })),
    []
  );
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    refs.current.forEach((g, i) => {
      if (!g) return;
      const f = data[i];
      f.u = (f.u + f.speed * dt) % 1;
      const tt = zone.t0 + f.u * (zone.t1 - zone.t0);
      const p = trackCurve.getPointAt(tt);
      const tan = trackCurve.getTangentAt(tt);
      const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      g.position.copy(p).addScaledVector(n, f.side);
      g.position.y = f.h + Math.sin(t * 1.8 + f.wobble) * 0.35;
      g.rotation.y = Math.atan2(tan.x, tan.z);
      g.rotation.z = Math.sin(t * 6 + f.wobble) * 0.18;
    });
  });
  return (
    <group>
      {data.map((_f, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)}>
          <mesh scale={[0.32, 0.22, 0.62]}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshPhysicalMaterial color={i % 2 ? "#b5f4ff" : "#ffd166"} roughness={0.1} metalness={0.3} clearcoat={1} iridescence={1} />
          </mesh>
          <mesh position={[0, 0, -0.62]} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[0.26, 0.5, 6]} />
            <meshPhysicalMaterial color={i % 2 ? "#7de1ff" : "#ff9f1c"} roughness={0.15} clearcoat={1} />
          </mesh>
          <mesh position={[0, 0.1, 0.45]}>
            <sphereGeometry args={[0.07, 6, 6]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Chevrons up the approach, a lit strip on the lip and a glow on the pit floor. */
function GapMarkers({ theme }: { theme: ThemeDef }) {
  const gaps = getActiveTrack().gaps ?? [];
  const marks = useMemo(() => {
    const out: { t: number; kind: "chevron" | "lip" | "floor" }[] = [];
    for (const g of gaps) {
      for (let i = 0; i < 5; i++) {
        out.push({ t: (((g.t0 - 0.035 + (i * 0.035) / 5) % 1) + 1) % 1, kind: "chevron" });
      }
      out.push({ t: (g.t0 + (g.t1 - g.t0) * 0.29) % 1, kind: "lip" });
      out.push({ t: (g.t0 + (g.t1 - g.t0) * 0.6) % 1, kind: "floor" });
    }
    return out;
  }, [gaps]);
  return (
    <group>
      {marks.map((m, i) => {
        const t = m.t;
        const c = trackPointAt(t);
        const tan = trackTangentAt(t);
        const heading = Math.atan2(tan.x, tan.z);
        const y = surfaceYAt(t);
        return (
          <group key={i} position={[c.x, y + 0.06, c.z]} rotation={[0, heading, 0]}>
            {m.kind === "chevron" && (
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[TRACK_WIDTH * 0.6, 1.6]} />
                <meshBasicMaterial color={theme.barrierB} transparent opacity={0.45} toneMapped={false} depthWrite={false} />
              </mesh>
            )}
            {m.kind === "lip" && (
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[TRACK_WIDTH * 0.95, 1.1]} />
                <meshBasicMaterial color={theme.barrierA} transparent opacity={0.85} toneMapped={false} depthWrite={false} />
              </mesh>
            )}
            {m.kind === "floor" && (
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[TRACK_WIDTH * 0.85, 3.2]} />
                <meshBasicMaterial color={theme.glow} transparent opacity={0.2} toneMapped={false} depthWrite={false} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

/** Hanging spike bars and sliding road spikes; they move with the same clock as the damage check. */
function MovingTraps({ theme }: { theme: ThemeDef }) {
  const traps = getActiveTrack().traps ?? [];
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame((state) => {
    const now = state.clock.elapsedTime * 1000;
    traps.forEach((tr, i) => {
      const g = refs.current[i];
      if (!g) return;
      const { p, ground, heading, span } = trapTransform(tr, now);
      g.position.set(p.x, ground, p.z);
      g.rotation.set(0, heading, 0);
      const k = tr.kind === "bar" ? span * 0.55 : 1;
      g.scale.set(k, 1, 1);
    });
  });
  return (
    <group>
      {traps.map((tr, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)}>
          {tr.kind === "bar" ? (
            <>
              <mesh position={[0, 2.2, 0]} castShadow>
                <boxGeometry args={[7, 0.5, 0.7]} />
                <meshStandardMaterial color={theme.barrierA} emissive={theme.barrierA} emissiveIntensity={1.8} toneMapped={false} />
              </mesh>
              <mesh position={[-3.2, 1.1, 0]}>
                <boxGeometry args={[0.4, 2.2, 0.4]} />
                <meshStandardMaterial color="#2b2b33" />
              </mesh>
              <mesh position={[3.2, 1.1, 0]}>
                <boxGeometry args={[0.4, 2.2, 0.4]} />
                <meshStandardMaterial color="#2b2b33" />
              </mesh>
            </>
          ) : (
            <>
              {[0, 1, 2].map((k) => (
                <mesh key={k} position={[(k - 1) * 1.1, 0.7, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
                  <cylinderGeometry args={[0.26, 0.26, 2.6, 5]} />
                  <meshStandardMaterial color="#ff4d6d" emissive="#ff4d6d" emissiveIntensity={1.4} toneMapped={false} />
                </mesh>
              ))}
            </>
          )}
        </group>
      ))}
    </group>
  );
}

/** Portal mouths: a swirl you can drive into that spits you out somewhere else on the lap. */
function Portals({ theme }: { theme: ThemeDef }) {
  const portals = getActiveTrack().portals ?? [];
  const inRefs = useRef<(THREE.Group | null)[]>([]);
  const outRefs = useRef<(THREE.Group | null)[]>([]);
  const nowRef = useRef(0);
  useFrame((state) => {
    nowRef.current = state.clock.elapsedTime * 1000;
    const now = nowRef.current;
    portals.forEach((pr, i) => {
      const a = inRefs.current[i];
      if (a) {
        const { p, ground, heading } = portalTransform(pr, "in");
        a.position.set(p.x, ground + 2.6, p.z);
        a.rotation.set(0, heading, now * 0.0012 + i);
      }
      const b = outRefs.current[i];
      if (b) {
        const { p, ground, heading } = portalTransform(pr, "out", pr);
        b.position.set(p.x, ground + 2.6, p.z);
        b.rotation.set(0, heading, -now * 0.0012 + i);
      }
    });
  });
  return (
    <group>
      {portals.map((_pr, i) =>
        [
          { ref: inRefs, key: "in", glow: theme.glow, ring: theme.barrierA },
          { ref: outRefs, key: "out", glow: theme.barrierB, ring: theme.barrierB },
        ].map(({ ref, key, glow, ring }) => (
          <group key={key + i} ref={(el) => (ref.current[i] = el)}>
            <mesh>
              <torusGeometry args={[2.7, 0.3, 12, 36]} />
              <meshBasicMaterial color={ring} toneMapped={false} />
            </mesh>
            <mesh>
              <circleGeometry args={[2.5, 30]} />
              <meshBasicMaterial color={glow} transparent opacity={0.28} side={THREE.DoubleSide} toneMapped={false} depthWrite={false} />
            </mesh>
            <mesh>
              <torusGeometry args={[1.6, 0.09, 8, 28]} />
              <meshBasicMaterial color={glow} toneMapped={false} />
            </mesh>
          </group>
        ))
      )}
    </group>
  );
}

/** Alternative paths: pulsing gates joined by a translucent glowing skyway arc. */
/**
 * A drivable mini route: the alternate line used to be a 0.3 wide glowing tube,
 * which read as decoration rather than as a road you could take. This builds an
 * actual carriageway along the same path, with verges, kerbs, side rails and
 * pillars down to the ground, so a branch is visible from the main road.
 */
function buildRouteRoad(path: THREE.Vector3[], halfW: number) {
  const curve = new THREE.CatmullRomCurve3(path);
  const N = 64;
  const deck: number[] = [];
  const kerbL: number[] = [];
  const kerbR: number[] = [];
  const idx: number[] = [];
  const rail: number[] = [];
  const railIdx: number[] = [];
  const tan = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const p = curve.getPointAt(u);
    curve.getTangentAt(u, tan);
    nrm.crossVectors(tan, up).normalize();
    const wobble = Math.sin(u * 9) * 0.12;
    deck.push(
      p.x + nrm.x * halfW, p.y + wobble, p.z + nrm.z * halfW,
      p.x - nrm.x * halfW, p.y + wobble, p.z - nrm.z * halfW
    );
    // kerb stripes just outside the carriageway
    for (const side of [1, -1]) {
      const a = p.clone().addScaledVector(nrm, side * (halfW + 0.55));
      (side === 1 ? kerbL : kerbR).push(a.x, a.y + 0.16, a.z);
      const b = p.clone().addScaledVector(nrm, side * (halfW + 1.5));
      (side === 1 ? kerbL : kerbR).push(b.x, b.y - 0.1, b.z);
    }
    // rail posts: two triangles a metre tall at the edge
    for (const side of [1, -1]) {
      const a = p.clone().addScaledVector(nrm, side * (halfW + 0.9));
      rail.push(a.x, a.y + 1.05, a.z);
      rail.push(a.x, a.y - 0.1, a.z);
    }
    if (i < N) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      const k = i * 2;
      kerbL.length; // kerbs are drawn as their own geometry below
      const r = i * 4;
      railIdx.push(r, r + 1, r + 2, r + 1, r + 3, r + 2);
      void k;
    }
  }

  const mk = (pts: number[], ind: number[]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    g.setIndex(ind);
    g.computeVertexNormals();
    return g;
  };
  const deckGeo = mk(deck, idx);
  const railGeo = mk(rail, railIdx);
  const kerbGeo = (() => {
    const pts: number[] = [...kerbL, ...kerbR];
    const ind: number[] = [];
    const half = N + 1;
    for (let side = 0; side < 2; side++) {
      const off = side * half * 2;
      for (let i = 0; i < N; i++) {
        const a = off + i * 2;
        ind.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    return mk(pts, ind);
  })();

  // pillars holding the route up where it floats
  const pillars: { x: number; z: number; top: number; bottom: number }[] = [];
  for (let i = 2; i < N - 1; i += 6) {
    const u = i / N;
    const p = curve.getPointAt(u);
    curve.getTangentAt(u, tan);
    nrm.crossVectors(tan, up).normalize();
    for (const side of [1, -1]) {
      const a = p.clone().addScaledVector(nrm, side * halfW * 0.7);
      const tt = nearestT(a);
      const ground = trackPointAt(tt).y - 1.4;
      if (p.y - ground > 2.2) pillars.push({ x: a.x, z: a.z, top: p.y - 0.3, bottom: ground });
    }
  }
  return { deckGeo, kerbGeo, railGeo, pillars };
}

function Shortcuts({ theme }: { theme: ThemeDef }) {
  const shortcuts = useMemo(() => getShortcuts(), []);
  const roads = useMemo(() => shortcuts.map((s) => buildRouteRoad(s.path, 3.6)), [shortcuts]);
  const gateRefs = useRef<(THREE.Group | null)[]>([]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    gateRefs.current.forEach((g, i) => {
      if (!g) return;
      const s = 1 + Math.sin(t * 3 + i) * 0.07;
      g.scale.setScalar(s);
      g.rotation.z = t * 0.9;
    });
  });
  return (
    <group>
      {shortcuts.map((s, i) => (
        <group key={i}>
          <mesh geometry={roads[i].deckGeo} receiveShadow>
            <meshStandardMaterial color={theme.road} roughness={0.85} metalness={0.05} />
          </mesh>
          <mesh geometry={roads[i].kerbGeo}>
            <meshStandardMaterial color={theme.roadEdge} roughness={0.6} side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={roads[i].railGeo}>
            <meshStandardMaterial
              color={theme.glow}
              emissive={theme.glow}
              emissiveIntensity={1.1}
              roughness={0.4}
              side={THREE.DoubleSide}
            />
          </mesh>
          {roads[i].pillars.map((pl, k) => (
            <mesh key={k} position={[pl.x, (pl.top + pl.bottom) / 2, pl.z]}>
              <boxGeometry args={[0.5, pl.top - pl.bottom, 0.5]} />
              <meshStandardMaterial color={theme.ground} roughness={1} />
            </mesh>
          ))}
          <mesh geometry={roads[i].deckGeo} position={[0, 0.05, 0]}>
            <meshStandardMaterial
              color={theme.glow}
              emissive={theme.glow}
              emissiveIntensity={0.9}
              transparent
              opacity={0.18}
              toneMapped={false}
              depthWrite={false}
            />
          </mesh>
          {[
            { p: s.path[0], h: s.entryHeading, k: 0 },
            { p: s.path[s.path.length - 1], h: s.heading, k: 1 },
          ].map((g) => (
            <group key={g.k} position={[g.p.x, g.p.y + 2.2, g.p.z]} rotation={[0, g.h, 0]}>
              <group ref={(el) => (gateRefs.current[i * 2 + g.k] = el)}>
                <mesh>
                  <torusGeometry args={[2.5, 0.22, 10, 32]} />
                  <meshBasicMaterial color={g.k === 0 ? theme.barrierA : theme.barrierB} toneMapped={false} />
                </mesh>
                <mesh>
                  <circleGeometry args={[2.3, 28]} />
                  <meshBasicMaterial color={theme.glow} transparent opacity={0.22} side={THREE.DoubleSide} toneMapped={false} depthWrite={false} />
                </mesh>
              </group>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/**
 * Alternate routes: translucent glass ribbons that peel off the main road and rejoin it.
 * Shorter lines cut the corner, longer ones carry extra coin bait.
 */
function BranchRibbons({ theme }: { theme: ThemeDef }) {
  const branches = getActiveTrack().branches;
  const flat = theme.id === "win98";
  const geos = useMemo(() => {
    return branches.map((b) => {
      const N = 64;
      const pos: number[] = [];
      const uvs: number[] = [];
      const idx: number[] = [];
      for (let i = 0; i <= N; i++) {
        const t = b.t0 + ((b.t1 - b.t0) * i) / N;
        const u = i / N;
        const env = Math.sin(u * Math.PI);
        const c = trackCurve.getPointAt(((t % 1) + 1) % 1);
        const tan = trackCurve.getTangentAt(((t % 1) + 1) % 1);
        const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
        const center = c.clone().addScaledVector(n, b.pull * env);
        const hw = TRACK_WIDTH / 2 - 0.4;
        const l = center.clone().addScaledVector(n, hw);
        const r = center.clone().addScaledVector(n, -hw);
        pos.push(l.x, 0.06, l.z, r.x, 0.06, r.z);
        uvs.push(0, u * 14, 1, u * 14);
      }
      for (let i = 0; i < N; i++) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    });
  }, [branches]);

  const chevrons = useMemo(() => {
    const out: { pos: THREE.Vector3; angle: number }[] = [];
    branches.forEach((b) => {
      for (let k = 0; k < 6; k++) {
        const u = (k + 0.5) / 6;
        const t = b.t0 + (b.t1 - b.t0) * u;
        const env = Math.sin(u * Math.PI);
        const c = trackCurve.getPointAt(((t % 1) + 1) % 1);
        const tan = trackCurve.getTangentAt(((t % 1) + 1) % 1);
        const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
        out.push({ pos: c.clone().addScaledVector(n, b.pull * env), angle: Math.atan2(tan.x, tan.z) });
      }
    });
    return out;
  }, [branches]);

  return (
    <group>
      {geos.map((g, i) => (
        <mesh key={`br${i}`} geometry={g} receiveShadow>
          <meshPhysicalMaterial
            color={theme.glow}
            transparent
            opacity={flat ? 0.75 : 0.5}
            roughness={0.08}
            metalness={theme.id === "y2k" ? 0.9 : 0.15}
            clearcoat={1}
            emissive={theme.glow}
            emissiveIntensity={flat ? 0.1 : 0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {chevrons.map((c, i) => (
        <mesh key={`ch${i}`} position={[c.pos.x, 0.14, c.pos.z]} rotation={[-Math.PI / 2, 0, -c.angle]}>
          <ringGeometry args={[1.5, 2.1, 3]} />
          <meshBasicMaterial color={theme.barrierB} transparent opacity={0.85} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/** Painted on the tarmac: where a mini route peels off and where a gap starts. */
function RoadMarks({ theme }: { theme: ThemeDef }) {
  const chevron = useMemo(() => {
    const sh = new THREE.Shape();
    sh.moveTo(-2.6, 0);
    sh.lineTo(0, 1.5);
    sh.lineTo(2.6, 0);
    sh.lineTo(2.6, 1.0);
    sh.lineTo(0, 2.6);
    sh.lineTo(-2.6, 1.0);
    sh.closePath();
    return new THREE.ShapeGeometry(sh);
  }, []);

  const marks = useMemo(() => {
    const out: { pos: THREE.Vector3; angle: number; kind: number; turn: number }[] = [];
    const tan = new THREE.Vector3();
    const nrm = new THREE.Vector3();
    const put = (t: number, lateral: number, kind: number, turn: number) => {
      const c = trackCurve.getPointAt(t);
      trackCurve.getTangentAt(t, tan);
      nrm.set(-tan.z, 0, tan.x).normalize();
      out.push({
        pos: c.clone().addScaledVector(nrm, lateral),
        angle: Math.atan2(tan.x, tan.z),
        kind,
        turn,
      });
    };
    // branch entries: three arrows stepping towards the side the route leaves on
    for (const sc of getShortcuts()) {
      for (let k = 0; k < 3; k++) {
        const t = (sc.t0 - 0.03 + k * 0.008 + 1) % 1;
        put(t, sc.side * (2 + k * 2.4), 0, sc.side);
      }
    }
    // gap approaches: hazard bars across the full width
    for (const g of getActiveTrack().gaps ?? []) {
      for (let k = 0; k < 4; k++) {
        const t = (g.t0 - 0.026 + k * 0.006 + 1) % 1;
        put(t, k % 2 === 0 ? -4.5 : 4.5, 1, 0);
      }
    }
    return out;
  }, []);

  return (
    <group>
      {marks.map((m, i) => (
        <mesh
          key={i}
          geometry={chevron}
          position={[m.pos.x, surfaceYAt(nearestT(m.pos)) + 0.09, m.pos.z]}
          rotation={[-Math.PI / 2, 0, -m.angle + (m.turn > 0 ? -0.5 : m.turn < 0 ? 0.5 : 0)]}
        >
          <meshBasicMaterial
            color={m.kind === 0 ? theme.barrierA : theme.barrierB}
            transparent
            opacity={m.kind === 0 ? 0.85 : 0.6}
            toneMapped={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

function sectorTexture(label: string, colour: string) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(8,10,18,0.92)";
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = colour;
  g.lineWidth = 8;
  g.strokeRect(6, 6, 244, 116);
  g.fillStyle = colour;
  g.font = "bold 74px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(label, 128, 68);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

/** Eight numbered boards around the lap plus a painted band: orientation cues. */
function SectorBoards({ theme }: { theme: ThemeDef }) {
  const boards = useMemo(
    () =>
      Array.from({ length: 8 }, (_, k) => {
        const t = k / 8;
        const c = trackCurve.getPointAt(t);
        const tan = trackCurve.getTangentAt(t);
        const nrm = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
        return {
          pos: c.clone().addScaledVector(nrm, -(halfWidthAt(t) + 5)),
          angle: Math.atan2(tan.x, tan.z),
          t,
        };
      }),
    []
  );
  const textures = useMemo(
    () => boards.map((_, k) => sectorTexture(String(k + 1), theme.barrierA)),
    [boards, theme]
  );
  const bands = useMemo(
    () =>
      boards.map((b) => {
        const tan = new THREE.Vector3(Math.sin(b.angle), 0, Math.cos(b.angle));
        return {
          p1: b.pos.clone().addScaledVector(tan, -1.6),
          p2: b.pos.clone().addScaledVector(tan, 1.6),
        };
      }),
    [boards]
  );

  return (
    <group>
      {boards.map((b, i) => (
        <group key={i} position={[b.pos.x, 0, b.pos.z]}>
          <mesh position={[0, 2.4, 0]} rotation={[0, b.angle + Math.PI / 2, 0]}>
            <planeGeometry args={[4.4, 2.2]} />
            <meshBasicMaterial map={textures[i]} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <boxGeometry args={[0.22, 2.2, 0.22]} />
            <meshStandardMaterial color="#20263c" roughness={0.8} />
          </mesh>
        </group>
      ))}
      {bands.map((b, i) => {
        const mid = b.p1.clone().lerp(b.p2, 0.5);
        const len = b.p1.distanceTo(b.p2);
        const ang = Math.atan2(b.p2.x - b.p1.x, b.p2.z - b.p1.z);
        return (
          <mesh key={i} position={[mid.x, surfaceYAt(boards[i].t) + 0.08, mid.z]} rotation={[-Math.PI / 2, 0, -ang]}>
            <planeGeometry args={[len, 1.6]} />
            <meshBasicMaterial color={theme.barrierA} transparent opacity={0.45} toneMapped={false} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * Ground clutter across the whole terrain band. The old scenery only placed 86
 * props within 16 units of the road, so everything past the verge was bare; this
 * fills the ground out to ~100 units with instanced rocks, tufts and shards.
 */
function Scatter({ theme }: { theme: ThemeDef }) {
  const COUNT = 430;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const rocks = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  const tufts = useMemo(() => new THREE.ConeGeometry(0.7, 2.4, 5), []);
  const shards = useMemo(() => new THREE.OctahedronGeometry(1, 0), []);

  const sets = useMemo(() => {
    const buckets: { m: THREE.Matrix4; kind: number }[] = [];
    const tan = new THREE.Vector3();
    const nrm = new THREE.Vector3();
    for (let i = 0; i < COUNT; i++) {
      const t = (i * 0.61803398875) % 1;
      const c = trackCurve.getPointAt(t);
      trackCurve.getTangentAt(t, tan);
      nrm.set(-tan.z, 0, tan.x).normalize();
      const side = i % 2 === 0 ? 1 : -1;
      const out = 4 + ((i * 37) % 84);
      const g = groundReach(t);
      const lateral = g.edge + Math.min(out, g.reach - 4);
      const p = c.clone().addScaledVector(nrm, side * lateral);
      p.y = groundYAt(t, lateral - g.edge) + 0.2;
      // keep clear of the carriageway and of water/sky zones
      const z = zoneAt(t);
      if (z) continue;
      const s = 0.5 + ((i * 17) % 100) / 100 * (out > 40 ? 3.4 : 1.7);
      dummy.position.copy(p);
      dummy.rotation.set(((i * 13) % 10) / 10, (i * 0.7) % Math.PI, ((i * 7) % 10) / 10);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      buckets.push({ m: dummy.matrix.clone(), kind: i % 3 });
    }
    return buckets;
  }, [dummy]);

  const byKind = (k: number) => sets.filter((x) => x.kind === k);
  const apply = (mesh: THREE.InstancedMesh | null, list: { m: THREE.Matrix4 }[]) => {
    if (!mesh) return;
    list.forEach((x, i) => mesh.setMatrixAt(i, x.m));
    mesh.instanceMatrix.needsUpdate = true;
  };

  return (
    <group>
      <instancedMesh ref={(el) => apply(el, byKind(0))} args={[rocks, undefined, byKind(0).length]}>
        <meshStandardMaterial color={theme.ground} roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={(el) => apply(el, byKind(1))} args={[tufts, undefined, byKind(1).length]}>
        <meshStandardMaterial color={theme.isle} roughness={0.85} flatShading />
      </instancedMesh>
      <instancedMesh ref={(el) => apply(el, byKind(2))} args={[shards, undefined, byKind(2).length]}>
        <meshStandardMaterial
          color={theme.glow}
          emissive={theme.glow}
          emissiveIntensity={0.5}
          roughness={0.3}
          flatShading
        />
      </instancedMesh>
    </group>
  );
}

export default function Track({ theme }: { theme: ThemeDef }) {
  const roadGeometry = useMemo(() => buildRoadGeometry(), []);
  const roadTexture = useMemo(() => makeRoadTexture(theme), [theme]);
  const barriers = useMemo(() => buildBarriers(), []);
  const ground = useMemo(() => buildGround(), []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -26, 0]}>
        <circleGeometry args={[2600, 72]} />
        <meshStandardMaterial color={theme.water} roughness={0.15} metalness={0.3} />
      </mesh>
      <mesh geometry={ground.skirt}>
        <meshStandardMaterial color={theme.ground} roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={ground.terrain} receiveShadow>
        <meshStandardMaterial vertexColors color={theme.ground} roughness={1} />
      </mesh>
      <Lake theme={theme} />
      <mesh geometry={roadGeometry} receiveShadow>
        <meshStandardMaterial map={roadTexture} roughness={theme.id === "techno" ? 0.4 : 0.8} metalness={theme.id === "techno" ? 0.4 : 0.05} />
      </mesh>
      <BarrierRing matrices={barriers} theme={theme} />
      <StartArch theme={theme} />
      <SkyRings theme={theme} />
      <ForkIslands theme={theme} />
      <BranchRibbons theme={theme} />
      <SubZone theme={theme} />
      <Shortcuts theme={theme} />
      <MovingTraps theme={theme} />
      <GapMarkers theme={theme} />
      <Portals theme={theme} />
      <MovingHazards theme={theme} />
      <RoadMarks theme={theme} />
      <SectorBoards theme={theme} />
      <Scatter theme={theme} />
      <Props theme={theme} />
      <Clouds theme={theme} />
      <AmbientLife theme={theme} />
    </group>
  );
}
