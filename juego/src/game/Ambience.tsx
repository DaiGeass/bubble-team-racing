import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getActiveTrack, getPaths, groundAt, makeGround, sectorIndexAt, terrainY, trackBounds, F_SOLID, F_WALL_POS, F_WALL_NEG } from "../trackCurve";
import { ZONES, type ThemeDef } from "../data";

// ---------------------------------------------------------------------------
// What a circuit has around it besides the road: the walls and ceiling of an
// indoor one, the big things on the horizon, the crowd at the line and the
// birds overhead. None of it is driven on; all of it is what makes a place.
// ---------------------------------------------------------------------------

const CEILING = 7.2;

/**
 * An indoor circuit: every road runs down a corridor. The walls stand on the
 * barriers, so they open exactly where the barriers do, at every junction, and
 * the ceiling carries strip lights, a few of which are on their way out.
 */
export function Corridor({ themes }: { themes: ThemeDef[] }) {
  const built = useMemo(() => {
    const pos: number[] = [];
    const col: number[] = [];
    const steady: THREE.Matrix4[] = [];
    const dying: THREE.Matrix4[] = [];
    const wall = themes.map((t) => new THREE.Color(t.barrierA));
    const band = themes.map((t) => new THREE.Color(t.barrierB).multiplyScalar(0.82));
    const roof = themes.map((t) => new THREE.Color(t.cloud));
    const roofB = themes.map((t) => new THREE.Color(t.cloud).multiplyScalar(0.9));
    const quad = (a: number[], b: number[], c: number[], d: number[], colour: THREE.Color) => {
      pos.push(...a, ...b, ...c, ...b, ...d, ...c);
      for (let n = 0; n < 6; n++) col.push(colour.r, colour.g, colour.b);
    };
    const d = new THREE.Object3D();
    for (const path of getPaths()) {
      const count = path.closed ? path.n : path.n - 1;
      const lampEvery = Math.max(2, Math.round(15 / path.ds));
      for (let i = 0; i < count; i++) {
        const j = (i + 1) % path.n;
        if (!(path.flags[i] & F_SOLID) || !(path.flags[j] & F_SOLID)) continue;
        const s = sectorIndexAt(path.prog[i]);
        const at = (k: number, lat: number, up: number) => [path.px[k] - path.tz[k] * lat, path.py[k] + up, path.pz[k] + path.tx[k] * lat];
        for (const side of [1, -1]) {
          const bit = side === 1 ? F_WALL_POS : F_WALL_NEG;
          if (!(path.flags[i] & bit) || !(path.flags[j] & bit)) continue;
          const o = (k: number) => (path.half[k] + 0.75) * side;
          // a skirting band above the barrier, then wall to the ceiling
          quad(at(i, o(i), 1.0), at(j, o(j), 1.0), at(i, o(i), 1.9), at(j, o(j), 1.9), band[s] ?? band[0]);
          quad(at(i, o(i), 1.9), at(j, o(j), 1.9), at(i, o(i), CEILING), at(j, o(j), CEILING), wall[s] ?? wall[0]);
        }
        // ceiling tiles, in two shades so the eye has something to count
        const tile = Math.floor((i * path.ds) / 6) % 2 ? roofB : roof;
        const w = (k: number) => path.half[k] + 0.75;
        quad(at(i, -w(i), CEILING), at(j, -w(j), CEILING), at(i, w(i), CEILING), at(j, w(j), CEILING), tile[s] ?? tile[0]);
        if (i % lampEvery === 0) {
          d.position.set(path.px[i], path.py[i] + CEILING - 0.12, path.pz[i]);
          d.rotation.set(0, Math.atan2(path.tx[i], path.tz[i]), 0);
          d.updateMatrix();
          // one in five is on its way out
          ((i / lampEvery) % 5 === 3 ? dying : steady).push(d.matrix.clone());
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return { g, steady, dying };
  }, [themes]);
  const lamp = useMemo(() => new THREE.BoxGeometry(4.6, 0.14, 1.3), []);
  const dyingMat = useRef<THREE.MeshStandardMaterial>(null);
  const flick = useRef({ next: 0, on: true });
  useFrame((s) => {
    const m = dyingMat.current;
    if (!m) return;
    // a bad tube: mostly on, with bursts of stutter
    if (s.clock.elapsedTime > flick.current.next) {
      flick.current.on = !flick.current.on;
      flick.current.next = s.clock.elapsedTime + (flick.current.on ? 0.25 + Math.random() * 2.2 : 0.04 + Math.random() * 0.14);
    }
    m.emissiveIntensity = flick.current.on ? 2.6 : 0.25;
  });
  const glow = themes[0].glow;
  const place = (mats: THREE.Matrix4[]) => (el: THREE.InstancedMesh | null) => {
    if (!el) return;
    mats.forEach((m, i) => el.setMatrixAt(i, m));
    el.instanceMatrix.needsUpdate = true;
  };
  return (
    <group>
      <mesh geometry={built.g}>
        <meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {built.steady.length > 0 && (
        <instancedMesh ref={place(built.steady)} args={[lamp, undefined, built.steady.length]} frustumCulled={false}>
          <meshStandardMaterial color="#ffffff" emissive={glow} emissiveIntensity={2.6} toneMapped={false} />
        </instancedMesh>
      )}
      {built.dying.length > 0 && (
        <instancedMesh ref={place(built.dying)} args={[lamp, undefined, built.dying.length]} frustumCulled={false}>
          <meshStandardMaterial ref={dyingMat} color="#ffffff" emissive={glow} emissiveIntensity={2.6} toneMapped={false} />
        </instancedMesh>
      )}
    </group>
  );
}

type Mark = "turbine" | "lighthouse" | "tower" | "pyramid" | "window" | "door" | "spot";

const MARK_OF: Record<string, Mark> = {
  frutiger: "turbine", eco: "turbine", aero: "turbine",
  aqua: "lighthouse", liquid: "lighthouse",
  techno: "tower", cyberpunk: "tower", y2k: "tower",
  sunset: "pyramid", vapor: "pyramid",
  win98: "window", dreamcore: "door", backrooms: "door", liminal: "spot", noir: "spot",
};

/**
 * The big things you steer by: a wind turbine on the hill, a lighthouse on the
 * point, a tower with a ring turning on its roof. One every so often round the
 * lap, well back from the road, each in the manner of the stretch it stands in.
 */
export function Landmarks({ themes }: { themes: ThemeDef[] }) {
  const def = getActiveTrack();
  const spots = useMemo(() => {
    const out: { x: number; y: number; z: number; rot: number; kind: Mark; theme: ThemeDef; s: number }[] = [];
    const main = getPaths()[0];
    if (!main) return out;
    const probe = makeGround();
    const N = 9;
    for (let k = 0; k < N; k++) {
      const i = Math.floor(((k + 0.37) / N) * main.n) % main.n;
      const t = main.prog[i];
      // not over a flight line or the open sea: those have their own furniture
      if (ZONES.some((z) => (z.type === "sky" || z.type === "sub") && t >= z.t0 && t <= z.t1)) continue;
      for (const side of k % 2 ? [1, -1] : [-1, 1]) {
        const lat = (46 + ((k * 13) % 30)) * side;
        const x = main.px[i] - main.tz[i] * lat;
        const z = main.pz[i] + main.tx[i] * lat;
        let clear = true;
        for (let a = 0; a < 8 && clear; a++) {
          for (const r of [0, 9, 18]) {
            if (groundAt(x + Math.cos((a * Math.PI) / 4) * r, z + Math.sin((a * Math.PI) / 4) * r, 1e6, probe, 0)) clear = false;
          }
        }
        if (!clear) continue;
        const theme = themes[sectorIndexAt(t)] ?? themes[0];
        const land = def.floor !== undefined ? terrainY(x, z) : main.py[i] - 2;
        const y = def.sea !== undefined ? Math.max(land, def.sea) : land;
        out.push({ x, y, z, rot: Math.atan2(main.tx[i], main.tz[i]) + (side > 0 ? -Math.PI / 2 : Math.PI / 2), kind: MARK_OF[theme.id] ?? "tower", theme, s: 1 + ((k * 7) % 5) * 0.12 });
        break;
      }
    }
    return out;
  }, [themes, def]);
  const spin = useRef<(THREE.Object3D | null)[]>([]);
  const bob = useRef<(THREE.Object3D | null)[]>([]);
  useFrame((s, dt) => {
    spin.current.forEach((o, i) => {
      if (o) o.rotation[o.userData.axis as "x" | "y" | "z"] += dt * (o.userData.rate ?? 1) * (i % 2 ? 1 : 0.8);
    });
    bob.current.forEach((o, i) => {
      if (o) o.position.y = (o.userData.base ?? 0) + Math.sin(s.clock.elapsedTime * 0.7 + i * 1.7) * 1.4;
    });
  });
  return (
    <group>
      {spots.map((m, i) => {
        const th = m.theme;
        return (
          <group key={i} position={[m.x, m.y, m.z]} rotation={[0, m.rot, 0]} scale={m.s}>
            {m.kind === "turbine" && (
              <>
                <mesh position={[0, 13, 0]} castShadow>
                  <cylinderGeometry args={[0.5, 1.1, 26, 10]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.4} />
                </mesh>
                <mesh position={[0, 26, 0.6]}>
                  <boxGeometry args={[1.4, 1.4, 3]} />
                  <meshStandardMaterial color="#f1f5f9" roughness={0.4} />
                </mesh>
                <group ref={(el) => (spin.current[i] = el)} userData={{ axis: "z", rate: 1.1 }} position={[0, 26, 2.3]}>
                  {[0, 1, 2].map((b) => (
                    <mesh key={b} rotation={[0, 0, (b * Math.PI * 2) / 3]} position={[Math.sin((-b * Math.PI * 2) / 3) * 5.5, Math.cos((b * Math.PI * 2) / 3) * 5.5, 0]}>
                      <boxGeometry args={[0.9, 11, 0.16]} />
                      <meshStandardMaterial color="#ffffff" roughness={0.3} />
                    </mesh>
                  ))}
                  <mesh>
                    <sphereGeometry args={[0.9, 10, 10]} />
                    <meshStandardMaterial color={th.barrierA} emissive={th.barrierA} emissiveIntensity={0.5} />
                  </mesh>
                </group>
              </>
            )}
            {m.kind === "lighthouse" && (
              <>
                {[0, 1, 2, 3].map((b) => (
                  <mesh key={b} position={[0, 2.5 + b * 5, 0]} castShadow>
                    <cylinderGeometry args={[2.4 - b * 0.35, 2.75 - b * 0.35, 5, 14]} />
                    <meshStandardMaterial color={b % 2 ? "#ffffff" : th.barrierA} roughness={0.6} />
                  </mesh>
                ))}
                <mesh position={[0, 21.4, 0]}>
                  <cylinderGeometry args={[1.5, 1.5, 2.6, 12]} />
                  <meshStandardMaterial color="#fff7c2" emissive="#fff3a0" emissiveIntensity={2.6} toneMapped={false} />
                </mesh>
                <mesh position={[0, 23.6, 0]}>
                  <coneGeometry args={[2.1, 2.2, 12]} />
                  <meshStandardMaterial color={th.barrierB} roughness={0.5} />
                </mesh>
                <group ref={(el) => (spin.current[i] = el)} userData={{ axis: "y", rate: 0.9 }} position={[0, 21.4, 0]}>
                  <mesh position={[0, 0, 13]} rotation={[Math.PI / 2, 0, 0]}>
                    <coneGeometry args={[3.4, 26, 14, 1, true]} />
                    <meshBasicMaterial color="#fff7c2" transparent opacity={0.16} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
                  </mesh>
                </group>
              </>
            )}
            {m.kind === "tower" && (
              <>
                <mesh position={[0, 17, 0]} castShadow>
                  <boxGeometry args={[9, 34, 9]} />
                  <meshStandardMaterial color="#1c2242" roughness={0.35} metalness={0.5} />
                </mesh>
                {[5, 11, 17, 23, 29].map((y, b) => (
                  <mesh key={y} position={[0, y, 0]}>
                    <boxGeometry args={[9.2, 0.5, 9.2]} />
                    <meshStandardMaterial color={b % 2 ? th.barrierA : th.barrierB} emissive={b % 2 ? th.barrierA : th.barrierB} emissiveIntensity={2} toneMapped={false} />
                  </mesh>
                ))}
                <mesh position={[0, 37, 0]}>
                  <cylinderGeometry args={[0.2, 0.2, 6, 6]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
                </mesh>
                <group ref={(el) => (spin.current[i] = el)} userData={{ axis: "y", rate: 0.7 }} position={[0, 38, 0]}>
                  <mesh rotation={[Math.PI / 2.4, 0, 0]}>
                    <torusGeometry args={[6.5, 0.3, 8, 40]} />
                    <meshStandardMaterial color={th.glow} emissive={th.glow} emissiveIntensity={2.6} toneMapped={false} />
                  </mesh>
                </group>
              </>
            )}
            {m.kind === "pyramid" && (
              <>
                <mesh position={[0, 9, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                  <coneGeometry args={[15, 18, 4]} />
                  <meshStandardMaterial color={th.isle} roughness={0.8} flatShading />
                </mesh>
                <mesh position={[0, 18.6, 0]} rotation={[0, Math.PI / 4, 0]}>
                  <coneGeometry args={[2.6, 3.2, 4]} />
                  <meshStandardMaterial color={th.glow} emissive={th.glow} emissiveIntensity={2.4} toneMapped={false} />
                </mesh>
                <group ref={(el) => (bob.current[i] = el)} userData={{ base: 27 }} position={[0, 27, 0]}>
                  <mesh>
                    <torusGeometry args={[5, 0.35, 8, 36]} />
                    <meshStandardMaterial color={th.barrierA} emissive={th.barrierA} emissiveIntensity={1.8} toneMapped={false} />
                  </mesh>
                </group>
              </>
            )}
            {m.kind === "window" && (
              <group ref={(el) => (bob.current[i] = el)} userData={{ base: 15 }} position={[0, 15, 0]}>
                <mesh castShadow>
                  <boxGeometry args={[20, 14, 0.6]} />
                  <meshStandardMaterial color="#c0c0c0" roughness={0.8} />
                </mesh>
                <mesh position={[0, 6, 0.35]}>
                  <boxGeometry args={[19.4, 1.5, 0.1]} />
                  <meshStandardMaterial color="#000080" emissive="#000080" emissiveIntensity={0.8} />
                </mesh>
                <mesh position={[0, -1, 0.35]}>
                  <boxGeometry args={[18.6, 11, 0.1]} />
                  <meshStandardMaterial color="#008080" emissive="#008080" emissiveIntensity={0.4} />
                </mesh>
                {[7.2, 8.6].map((x) => (
                  <mesh key={x} position={[x, 6, 0.45]}>
                    <boxGeometry args={[1.1, 1, 0.1]} />
                    <meshStandardMaterial color="#c0c0c0" />
                  </mesh>
                ))}
              </group>
            )}
            {m.kind === "door" && (
              <group ref={(el) => (bob.current[i] = el)} userData={{ base: 10 }} position={[0, 10, 0]}>
                {/* a door standing in the air, ajar, with light behind it */}
                <mesh castShadow>
                  <boxGeometry args={[9, 16, 0.8]} />
                  <meshStandardMaterial color="#f5efe6" roughness={0.7} />
                </mesh>
                <mesh position={[0, -0.4, 0.1]}>
                  <boxGeometry args={[7, 14.4, 0.9]} />
                  <meshStandardMaterial color="#fffbe0" emissive={th.glow} emissiveIntensity={2.2} toneMapped={false} />
                </mesh>
                <mesh position={[-2.2, -0.4, 2.6]} rotation={[0, 0.9, 0]}>
                  <boxGeometry args={[7, 14.4, 0.3]} />
                  <meshStandardMaterial color={th.barrierA} roughness={0.6} />
                </mesh>
                <mesh position={[0.2, -0.4, 5]}>
                  <sphereGeometry args={[0.4, 10, 10]} />
                  <meshStandardMaterial color="#e8c56a" metalness={0.9} roughness={0.2} />
                </mesh>
              </group>
            )}
            {m.kind === "spot" && (
              <>
                {/* a lamp post in an empty lot */}
                <mesh position={[0, 8, 0]}>
                  <cylinderGeometry args={[0.25, 0.4, 16, 8]} />
                  <meshStandardMaterial color="#8a93a3" metalness={0.6} roughness={0.4} />
                </mesh>
                <mesh position={[0, 16, 1.8]}>
                  <boxGeometry args={[1.2, 0.4, 4]} />
                  <meshStandardMaterial color="#8a93a3" metalness={0.6} roughness={0.4} />
                </mesh>
                <mesh position={[0, 15.7, 3.2]}>
                  <boxGeometry args={[1, 0.2, 1.6]} />
                  <meshStandardMaterial color="#ffffff" emissive={th.glow} emissiveIntensity={3} toneMapped={false} />
                </mesh>
                <mesh position={[0, 7.8, 3.2]}>
                  <coneGeometry args={[5, 15.6, 16, 1, true]} />
                  <meshBasicMaterial color={th.glow} transparent opacity={0.1} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
                </mesh>
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}

/** Two stands of spectators by the start line, hopping up and down as the pack goes by. */
export function Grandstand({ theme }: { theme: ThemeDef }) {
  const def = getActiveTrack();
  const built = useMemo(() => {
    const main = getPaths()[0];
    const stands: { x: number; y: number; z: number; rot: number }[] = [];
    if (!main) return { stands, crowd: [] as { m: THREE.Matrix4; c: THREE.Color }[] };
    const probe = makeGround();
    const i = Math.round(26 / main.ds) % main.n;
    for (const side of [1, -1]) {
      const lat = (main.half[i] + 9.5) * side;
      const x = main.px[i] - main.tz[i] * lat;
      const z = main.pz[i] + main.tx[i] * lat;
      let clear = true;
      for (const [ox, oz] of [[0, 0], [7, 0], [-7, 0], [0, 7], [0, -7]]) if (groundAt(x + ox, z + oz, 1e6, probe, 0)) clear = false;
      if (!clear) continue;
      stands.push({ x, y: main.py[i], z, rot: Math.atan2(main.tx[i], main.tz[i]) + (side > 0 ? -Math.PI / 2 : Math.PI / 2) });
    }
    const crowd: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const d = new THREE.Object3D();
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 11; k++) {
        d.position.set((k - 5) * 1.45 + (row % 2) * 0.5, 1.4 + row * 1.25, -1.2 - row * 1.5);
        d.scale.setScalar(0.85 + ((k * 7 + row * 3) % 5) * 0.06);
        d.updateMatrix();
        crowd.push({ m: d.matrix.clone(), c: new THREE.Color(theme.particles[(k + row * 2) % theme.particles.length]) });
      }
    }
    return { stands, crowd };
  }, [theme, def]);
  const crowdRefs = useRef<(THREE.Group | null)[]>([]);
  useFrame((s) => {
    crowdRefs.current.forEach((g, i) => {
      if (g) g.position.y = Math.abs(Math.sin(s.clock.elapsedTime * 4.2 + i)) * 0.28;
    });
  });
  const blob = useMemo(() => new THREE.SphereGeometry(0.55, 8, 7), []);
  return (
    <group>
      {built.stands.map((st, i) => (
        <group key={i} position={[st.x, st.y, st.z]} rotation={[0, st.rot, 0]}>
          {[0, 1, 2, 3].map((row) => (
            <mesh key={row} position={[0, 0.3 + row * 1.25, -1.2 - row * 1.5]} castShadow>
              <boxGeometry args={[17, 0.9 + row * 0.2, 1.5]} />
              <meshStandardMaterial color={row % 2 ? theme.barrierA : theme.barrierB} roughness={0.7} />
            </mesh>
          ))}
          <mesh position={[0, 7.4, -3.4]} rotation={[0.18, 0, 0]}>
            <boxGeometry args={[18, 0.25, 8]} />
            <meshStandardMaterial color="#ffffff" roughness={0.5} />
          </mesh>
          {[-8.4, 8.4].map((x) => (
            <mesh key={x} position={[x, 3.5, -6.4]}>
              <cylinderGeometry args={[0.2, 0.2, 7, 6]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.6} />
            </mesh>
          ))}
          <group ref={(el) => (crowdRefs.current[i] = el)}>
            <instancedMesh
              ref={(el) => {
                if (!el) return;
                built.crowd.forEach((c, k) => {
                  el.setMatrixAt(k, c.m);
                  el.setColorAt(k, c.c);
                });
                el.instanceMatrix.needsUpdate = true;
                if (el.instanceColor) el.instanceColor.needsUpdate = true;
              }}
              args={[blob, undefined, built.crowd.length]}
            >
              <meshStandardMaterial roughness={0.6} />
            </instancedMesh>
          </group>
        </group>
      ))}
    </group>
  );
}

/** Flocks wheeling over the circuit: birds by day, and under the sea the same thing is a shoal. */
export function Flocks({ theme }: { theme: ThemeDef }) {
  const bb = useMemo(() => trackBounds(), []);
  const N = 27;
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    // a shallow V: two wings swept back from a point
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.5, -1.3, 0.25, -0.5, 0, 0, -0.1, 0, 0, 0.5, 0, 0, -0.1, 1.3, 0.25, -0.5], 3));
    g.computeVertexNormals();
    return g;
  }, []);
  const d = useMemo(() => new THREE.Object3D(), []);
  useFrame((s) => {
    const m = ref.current;
    if (!m) return;
    const t = s.clock.elapsedTime;
    for (let i = 0; i < N; i++) {
      const flock = i % 3;
      const k = Math.floor(i / 3);
      const a = t * (0.1 + flock * 0.03) * (flock % 2 ? -1 : 1) + flock * 2.1;
      const r = bb.r * (0.35 + flock * 0.22);
      // behind and beside the leader, in a wedge
      const back = Math.ceil(k / 2) * 2.6;
      const wing = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 2.2;
      const dir = flock % 2 ? -1 : 1;
      const lx = bb.cx + Math.cos(a) * r;
      const lz = bb.cz + Math.sin(a) * r;
      const tx = -Math.sin(a) * dir;
      const tz = Math.cos(a) * dir;
      d.position.set(lx - tx * back - tz * wing, bb.top + 22 + flock * 9 + Math.sin(t * 0.6 + i) * 1.2, lz - tz * back + tx * wing);
      d.rotation.set(0, Math.atan2(tx, tz), Math.sin(t * 7 + i * 1.3) * 0.25);
      d.scale.setScalar(1.5);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[geo, undefined, N]} frustumCulled={false}>
      <meshBasicMaterial color={theme.dark ? theme.glow : "#3b4252"} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}
