import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { getActiveTrack, getPaths, groundAt, makeGround, sectorIndexAt, terrainY, trackBounds, F_SOLID, F_WALL_POS, F_WALL_NEG } from "../trackCurve";
import { ZONES, raceSnapshot, type ThemeDef } from "../data";
import { emitParticles } from "../particles";

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

type Mark = "turbine" | "lighthouse" | "tower" | "pyramid" | "window" | "door" | "spot" | "penguin" | "swirl" | "peak" | "gel" | "blob" | "construction";

const MARK_OF: Record<string, Mark> = {
  frutiger: "turbine", eco: "turbine", aero: "turbine",
  aqua: "lighthouse", liquid: "lighthouse",
  techno: "tower", cyberpunk: "tower", y2k: "tower",
  sunset: "pyramid", vapor: "pyramid",
  win98: "window", dreamcore: "door", eden: "door", backrooms: "door", liminal: "spot", noir: "spot",
  metro: "spot", tux: "penguin", debian: "swirl", arch: "peak", mac: "gel", slime: "blob", webcore: "construction",
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
        out.push({ x, y, z, // facing the road
        rot: Math.atan2(main.tx[i], main.tz[i]) + (side > 0 ? Math.PI / 2 : -Math.PI / 2), kind: MARK_OF[theme.id] ?? "tower", theme, s: 1 + ((k * 7) % 5) * 0.12 });
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
            {m.kind === "penguin" && (
              <group ref={(el) => (bob.current[i] = el)} userData={{ base: 0.6 }} position={[0, 0.6, 0]}>
                {/* a penguin the size of a house, sitting on the ice */}
                <mesh position={[0, 7, 0]} scale={[1, 1.25, 0.95]} castShadow>
                  <sphereGeometry args={[5.4, 18, 16]} />
                  <meshStandardMaterial color="#1b2330" roughness={0.5} />
                </mesh>
                <mesh position={[0, 6.2, 2.1]} scale={[0.82, 1.1, 0.7]}>
                  <sphereGeometry args={[5, 16, 14]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.6} />
                </mesh>
                <mesh position={[0, 15, 0.4]} castShadow>
                  <sphereGeometry args={[3.4, 16, 14]} />
                  <meshStandardMaterial color="#1b2330" roughness={0.5} />
                </mesh>
                {[-1.2, 1.2].map((x) => (
                  <group key={x} position={[x, 15.8, 2.9]}>
                    <mesh scale={[1, 1.25, 0.5]}>
                      <sphereGeometry args={[0.95, 10, 10]} />
                      <meshStandardMaterial color="#ffffff" roughness={0.2} />
                    </mesh>
                    <mesh position={[0, -0.1, 0.42]}>
                      <sphereGeometry args={[0.4, 8, 8]} />
                      <meshBasicMaterial color="#0b0b12" />
                    </mesh>
                  </group>
                ))}
                <mesh position={[0, 14.2, 3.6]} rotation={[Math.PI / 2, 0, 0]} scale={[1.3, 1, 0.6]}>
                  <coneGeometry args={[1.2, 2.4, 10]} />
                  <meshStandardMaterial color="#ffc21f" roughness={0.5} />
                </mesh>
                {[-3, 3].map((x) => (
                  <mesh key={x} position={[x, 0.5, 3]} scale={[1.3, 0.4, 1.8]}>
                    <sphereGeometry args={[1.6, 10, 8]} />
                    <meshStandardMaterial color="#ffc21f" roughness={0.5} />
                  </mesh>
                ))}
                {[-1, 1].map((sd) => (
                  <mesh key={sd} position={[sd * 5.6, 7.6, 0]} rotation={[0, 0, sd * 0.35]} scale={[0.3, 1, 0.7]}>
                    <sphereGeometry args={[3.6, 10, 10]} />
                    <meshStandardMaterial color="#1b2330" roughness={0.5} />
                  </mesh>
                ))}
              </group>
            )}
            {m.kind === "swirl" && (
              <>
                <mesh position={[0, 5, 0]}>
                  <cylinderGeometry args={[0.5, 0.9, 10, 8]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.4} />
                </mesh>
                {/* a spiral that keeps winding in on itself */}
                <group ref={(el) => (spin.current[i] = el)} userData={{ axis: "z", rate: 0.7 }} position={[0, 19, 0]}>
                  {[9, 6.6, 4.4, 2.6].map((r, k) => (
                    <mesh key={r} rotation={[0, 0, k * 1.5]} position={[Math.cos(k * 1.5 + 2.4) * 1.1 * k, Math.sin(k * 1.5 + 2.4) * 1.1 * k, 0]}>
                      <torusGeometry args={[r, 0.9 - k * 0.15, 8, 30, Math.PI * 1.5]} />
                      <meshStandardMaterial color={th.barrierA} emissive={th.barrierA} emissiveIntensity={0.7} roughness={0.3} />
                    </mesh>
                  ))}
                </group>
              </>
            )}
            {m.kind === "peak" && (
              <>
                {/* two blades leaning together, and the gap between them */}
                {[-1, 1].map((sd) => (
                  <mesh key={sd} position={[sd * 5.2, 14, 0]} rotation={[0, 0, sd * -0.34]} castShadow>
                    <boxGeometry args={[4.4, 30, 3.4]} />
                    <meshStandardMaterial color={th.barrierA} roughness={0.35} metalness={0.3} emissive={th.barrierA} emissiveIntensity={0.25} />
                  </mesh>
                ))}
                <mesh position={[0, 29.5, 0]} rotation={[0, Math.PI / 4, 0]}>
                  <coneGeometry args={[3.4, 6, 4]} />
                  <meshStandardMaterial color="#ffffff" emissive={th.glow} emissiveIntensity={1.6} toneMapped={false} />
                </mesh>
                <mesh position={[0, 9, 0]}>
                  <boxGeometry args={[9, 1.4, 3]} />
                  <meshStandardMaterial color={th.barrierB} roughness={0.5} />
                </mesh>
              </>
            )}
            {m.kind === "gel" && (
              <>
                {/* a brushed-metal bar with three jelly buttons, and a big blue one above it */}
                <mesh position={[0, 4, 0]} castShadow>
                  <boxGeometry args={[22, 8, 4]} />
                  <meshStandardMaterial color="#cfd6df" metalness={0.3} roughness={0.35} />
                </mesh>
                {["#ff5f57", "#febc2e", "#28c840"].map((c, k) => (
                  <mesh key={c} position={[-7 + k * 4, 5.4, 2.2]}>
                    <sphereGeometry args={[1.5, 14, 12]} />
                    <meshPhysicalMaterial color={c} roughness={0.08} clearcoat={1} emissive={c} emissiveIntensity={0.35} />
                  </mesh>
                ))}
                <group ref={(el) => (bob.current[i] = el)} userData={{ base: 17 }} position={[0, 17, 0]}>
                  <mesh scale={[1, 0.62, 1]}>
                    <sphereGeometry args={[6, 22, 16]} />
                    <meshPhysicalMaterial color={th.water} roughness={0.05} clearcoat={1} transmission={0.4} thickness={2} emissive={th.water} emissiveIntensity={0.3} />
                  </mesh>
                  <mesh position={[0, 2.2, 0]} scale={[0.8, 0.22, 0.8]}>
                    <sphereGeometry args={[5, 16, 10]} />
                    <meshBasicMaterial color="#ffffff" transparent opacity={0.55} toneMapped={false} />
                  </mesh>
                </group>
              </>
            )}
            {m.kind === "blob" && (
              <group ref={(el) => (bob.current[i] = el)} userData={{ base: 5 }} position={[0, 5, 0]}>
                {/* a hill of slime that is paying attention */}
                <mesh scale={[1.3, 0.9, 1.3]} castShadow>
                  <sphereGeometry args={[7, 20, 16]} />
                  <meshPhysicalMaterial color={th.barrierA} roughness={0.05} clearcoat={1} transparent opacity={0.82} emissive={th.barrierA} emissiveIntensity={0.25} />
                </mesh>
                {[[-3, 4, 4], [3.5, 2, -3], [0, 6.4, 0], [-4, 1, -3]].map(([x, y, z], k) => (
                  <mesh key={k} position={[x, y, z]}>
                    <sphereGeometry args={[1.2 + (k % 2) * 0.6, 10, 10]} />
                    <meshPhysicalMaterial color={th.barrierB} roughness={0.05} clearcoat={1} transparent opacity={0.7} />
                  </mesh>
                ))}
                {[-2.4, 2.4].map((x) => (
                  <group key={x} position={[x, 2.4, 7.6]}>
                    <mesh>
                      <sphereGeometry args={[1.5, 12, 12]} />
                      <meshStandardMaterial color="#ffffff" roughness={0.15} />
                    </mesh>
                    <mesh position={[0, 0, 1.1]}>
                      <sphereGeometry args={[0.7, 10, 10]} />
                      <meshBasicMaterial color="#0b0b12" />
                    </mesh>
                  </group>
                ))}
              </group>
            )}
            {m.kind === "construction" && (
              <>
                {/* the sign every home page had, and the globe that never stopped turning */}
                <mesh position={[0, 6, 0]}>
                  <cylinderGeometry args={[0.3, 0.3, 12, 6]} />
                  <meshStandardMaterial color="#808080" metalness={0.6} roughness={0.4} />
                </mesh>
                <mesh position={[0, 15, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
                  <boxGeometry args={[10, 10, 0.5]} />
                  <meshStandardMaterial color="#ffd400" emissive="#ffd400" emissiveIntensity={0.5} roughness={0.5} />
                </mesh>
                <mesh position={[0, 15, 0.3]} rotation={[0, 0, Math.PI / 4]}>
                  <boxGeometry args={[8.8, 8.8, 0.1]} />
                  <meshStandardMaterial color="#111111" wireframe />
                </mesh>
                <mesh position={[-0.6, 14.4, 0.4]} rotation={[0, 0, 0.6]}>
                  <boxGeometry args={[1, 4.4, 0.2]} />
                  <meshStandardMaterial color="#111111" />
                </mesh>
                <mesh position={[0.2, 17.4, 0.4]}>
                  <sphereGeometry args={[0.8, 8, 8]} />
                  <meshStandardMaterial color="#111111" />
                </mesh>
                <mesh position={[2, 13, 0.4]} scale={[1.6, 0.8, 0.3]}>
                  <sphereGeometry args={[1.2, 8, 6]} />
                  <meshStandardMaterial color="#111111" />
                </mesh>
                <group ref={(el) => (spin.current[i] = el)} userData={{ axis: "y", rate: 1.4 }} position={[9, 5, 0]}>
                  <mesh>
                    <sphereGeometry args={[3.4, 12, 8]} />
                    <meshStandardMaterial color="#0000ee" emissive="#0000ee" emissiveIntensity={0.4} flatShading />
                  </mesh>
                  <mesh scale={1.03}>
                    <sphereGeometry args={[3.4, 12, 8]} />
                    <meshBasicMaterial color="#00ff66" wireframe toneMapped={false} />
                  </mesh>
                </group>
              </>
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

type MoteKind = "petal" | "snow" | "ember" | "bit" | "bubble" | "dust" | "rain";

const MOTE_OF: Record<string, MoteKind> = {
  frutiger: "petal", eco: "petal", eden: "petal",
  aero: "snow", dreamcore: "snow", liminal: "dust", backrooms: "dust",
  sunset: "ember", vapor: "ember",
  techno: "bit", cyberpunk: "bit", y2k: "bit", win98: "bit",
  aqua: "bubble", liquid: "bubble",
  noir: "rain",
  metro: "dust", tux: "snow", debian: "petal", arch: "snow", mac: "bubble", slime: "bubble", webcore: "bit",
};
/** vertical speed, sideways drift, size */
const MOTE_STYLE: Record<MoteKind, [number, number, number]> = {
  petal: [-1.4, 1.6, 0.16],
  snow: [-2.2, 0.9, 0.11],
  ember: [2.4, 0.8, 0.1],
  bit: [3.2, 0.1, 0.12],
  bubble: [1.8, 0.5, 0.17],
  dust: [-0.25, 0.35, 0.07],
  rain: [-26, 0.2, 0.07],
};

/**
 * What is in the air of the stretch you are driving through: petals over the
 * meadow, snow in the clouds, embers at sunset, bubbles by the sea, dust in
 * the corridors. It travels with the camera, so there is always some about.
 */
export function Motes({ themes }: { themes: ThemeDef[] }) {
  const N = 150;
  const BOX = 64;
  const TALL = 26;
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const seeds = useMemo(() => Array.from({ length: N }, () => ({ x: Math.random() * BOX, y: Math.random() * TALL, z: Math.random() * BOX, ph: Math.random() * 6.3, k: 0.6 + Math.random() * 0.8 })), []);
  const d = useMemo(() => new THREE.Object3D(), []);
  const tint = useMemo(() => new THREE.Color(), []);
  const wrap = (v: number, size: number) => ((v % size) + size) % size;
  useFrame((s, dt) => {
    const m = ref.current;
    if (!m) return;
    const theme = themes[sectorIndexAt(raceSnapshot.racers[0]?.t ?? 0)] ?? themes[0];
    const kind = MOTE_OF[theme.id] ?? "dust";
    const [vy, sway, size] = MOTE_STYLE[kind];
    const cam = s.camera.position;
    const t = s.clock.elapsedTime;
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < N; i++) {
      const p = seeds[i];
      p.y = wrap(p.y + vy * p.k * step, TALL);
      p.x = wrap(p.x + Math.sin(t * 0.7 + p.ph) * sway * step, BOX);
      p.z = wrap(p.z + Math.cos(t * 0.6 + p.ph) * sway * step, BOX);
      // the box of motes is tiled over the world: only the tile round the camera is drawn
      d.position.set(cam.x + wrap(p.x - cam.x, BOX) - BOX / 2, cam.y + wrap(p.y - cam.y, TALL) - TALL / 2, cam.z + wrap(p.z - cam.z, BOX) - BOX / 2);
      d.rotation.set(t * p.k + p.ph, t * 0.7 * p.k, 0);
      if (kind === "rain") d.scale.set(size * 0.4, size * 14, size * 0.4);
      else d.scale.setScalar(size * (0.7 + p.k * 0.5));
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    if (mat.current) {
      tint.set(kind === "ember" ? "#ffb347" : kind === "petal" ? theme.barrierA : kind === "bit" ? theme.glow : "#ffffff");
      mat.current.color.lerp(tint, 0.05);
      mat.current.opacity = kind === "dust" ? 0.45 : kind === "rain" ? 0.4 : 0.8;
    }
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial ref={mat} color="#ffffff" transparent opacity={0.8} toneMapped={false} depthWrite={false} />
    </instancedMesh>
  );
}

/**
 * Pennants along the road: a pole every so often on alternate sides of every
 * walled stretch, with a flag in the colours of that stretch, flying.
 */
export function Pennants({ themes }: { themes: ThemeDef[] }) {
  const built = useMemo(() => {
    const main = getPaths()[0];
    const poles: THREE.Matrix4[] = [];
    const flags: { x: number; y: number; z: number; rot: number; ph: number; c: THREE.Color }[] = [];
    if (!main) return { poles, flags };
    const probe = makeGround();
    const d = new THREE.Object3D();
    const every = Math.max(1, Math.round(58 / main.ds));
    let n = 0;
    for (let i = Math.round(every / 2); i < main.n; i += every) {
      n++;
      const t = main.prog[i];
      if (!(main.flags[i] & F_SOLID) || ZONES.some((z) => t >= z.t0 - 0.01 && t <= z.t1 + 0.01)) continue;
      const side = n % 2 ? 1 : -1;
      if (!(main.flags[i] & (side === 1 ? F_WALL_POS : F_WALL_NEG))) continue;
      const lat = (main.half[i] + 2.2) * side;
      const x = main.px[i] - main.tz[i] * lat;
      const z = main.pz[i] + main.tx[i] * lat;
      // not where another road runs alongside
      if (groundAt(x, z, 1e6, probe, 0)) continue;
      const th = themes[sectorIndexAt(t)] ?? themes[0];
      d.position.set(x, main.py[i] + 3.2, z);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      poles.push(d.matrix.clone());
      flags.push({ x, y: main.py[i] + 5.6, z, rot: Math.atan2(main.tx[i], main.tz[i]), ph: n * 1.3, c: new THREE.Color(n % 4 < 2 ? th.barrierA : th.barrierB) });
    }
    return { poles, flags };
  }, [themes]);
  const pole = useMemo(() => new THREE.CylinderGeometry(0.09, 0.12, 6.4, 6), []);
  // a pennant hinged on its pole: the geometry starts at the pole and runs back from it
  const cloth = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0.6, 0, 0, -0.6, 0, 0, 0, -2.4], 3));
    g.computeVertexNormals();
    return g;
  }, []);
  const flagRef = useRef<THREE.InstancedMesh>(null);
  const d = useMemo(() => new THREE.Object3D(), []);
  const coloured = useRef(false);
  useFrame((s) => {
    const m = flagRef.current;
    if (!m) return;
    const t = s.clock.elapsedTime;
    built.flags.forEach((f, i) => {
      d.position.set(f.x, f.y, f.z);
      d.rotation.set(0, f.rot + Math.sin(t * 3.1 + f.ph) * 0.35, Math.sin(t * 4.3 + f.ph) * 0.12);
      d.scale.setScalar(1);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      if (!coloured.current) m.setColorAt(i, f.c);
    });
    m.instanceMatrix.needsUpdate = true;
    if (!coloured.current && m.instanceColor) {
      m.instanceColor.needsUpdate = true;
      coloured.current = true;
    }
  });
  if (!built.poles.length) return null;
  return (
    <group>
      <instancedMesh
        ref={(el) => {
          if (!el) return;
          built.poles.forEach((mm, i) => el.setMatrixAt(i, mm));
          el.instanceMatrix.needsUpdate = true;
        }}
        args={[pole, undefined, built.poles.length]}
        frustumCulled={false}
      >
        <meshStandardMaterial color="#e2e8f0" metalness={0.6} roughness={0.35} />
      </instancedMesh>
      <instancedMesh ref={flagRef} args={[cloth, undefined, built.flags.length]} frustumCulled={false}>
        <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/** Airships going slowly round over the circuit, each trailing a banner. */
export function Airships({ theme }: { theme: ThemeDef }) {
  const bb = useMemo(() => trackBounds(), []);
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    refs.current.forEach((g, i) => {
      if (!g) return;
      const dir = i % 2 ? -1 : 1;
      const a = t * 0.035 * dir + i * 2.4;
      const r = bb.r * (0.55 + i * 0.25);
      g.position.set(bb.cx + Math.cos(a) * r, bb.top + 38 + i * 12 + Math.sin(t * 0.3 + i) * 2, bb.cz + Math.sin(a) * r);
      g.rotation.y = Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir);
    });
  });
  return (
    <group>
      {[0, 1].map((i) => {
        const a = theme.particles[(i + 1) % theme.particles.length];
        const b = theme.particles[(i + 2) % theme.particles.length];
        return (
          <group key={i} ref={(el) => (refs.current[i] = el)}>
            <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.85]}>
              <capsuleGeometry args={[4.2, 13, 8, 18]} />
              <meshStandardMaterial color={a} roughness={0.4} emissive={a} emissiveIntensity={0.15} />
            </mesh>
            {[-3, 3].map((z) => (
              <mesh key={z} position={[0, 0, z]} scale={[1, 0.85, 1]}>
                <torusGeometry args={[4.25, 0.18, 6, 26]} />
                <meshStandardMaterial color={b} emissive={b} emissiveIntensity={1.2} toneMapped={false} />
              </mesh>
            ))}
            {[0, 1, 2].map((k) => (
              <mesh key={k} position={[Math.sin((k * Math.PI * 2) / 3) * 3.4, Math.cos((k * Math.PI * 2) / 3) * 3, -9.5]} rotation={[0, 0, (-k * Math.PI * 2) / 3]}>
                <boxGeometry args={[0.25, 3.4, 3.2]} />
                <meshStandardMaterial color={b} roughness={0.5} />
              </mesh>
            ))}
            <mesh position={[0, -4.6, 0.5]}>
              <boxGeometry args={[2.2, 1.5, 5]} />
              <meshStandardMaterial color="#f1f5f9" roughness={0.5} />
            </mesh>
            {/* the banner it tows */}
            <mesh position={[0, 0, -21]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[16, 3.6]} />
              <meshBasicMaterial color={b} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0, -12]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 3, 4]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Fireworks over the start line, a rocket every couple of seconds. */
export function Fireworks({ theme }: { theme: ThemeDef }) {
  const spot = useMemo(() => {
    const main = getPaths()[0];
    return main ? new THREE.Vector3(main.px[0], main.py[0], main.pz[0]) : null;
  }, []);
  const next = useRef(1.5);
  useFrame((s) => {
    if (!spot || s.clock.elapsedTime < next.current) return;
    next.current = s.clock.elapsedTime + 1.6 + Math.random() * 2.4;
    const a = Math.random() * Math.PI * 2;
    const r = 26 + Math.random() * 30;
    emitParticles({
      position: new THREE.Vector3(spot.x + Math.cos(a) * r, spot.y + 26 + Math.random() * 16, spot.z + Math.sin(a) * r),
      color: theme.particles[Math.floor(Math.random() * theme.particles.length)],
      count: 26, speed: 9, spread: 3.14, size: 0.5, life: 1.3, gravity: 5,
    });
  });
  return null;
}

/** A geometry painted one flat colour, ready to be merged with others into one mesh. */
function painted(g: THREE.BufferGeometry, colour: string) {
  const flat = g.index ? g.toNonIndexed() : g;
  const c = new THREE.Color(colour);
  const n = flat.getAttribute("position").count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  flat.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  flat.deleteAttribute("uv");
  return flat;
}

const CAP_COLOURS = ["#ff5fa2", "#ffb347", "#fff07a", "#7be36f", "#5fd0ff", "#b98cff", "#ff7a7a", "#ffffff"];

/**
 * The garden that looks back. Sunflowers with an eye where the seeds should
 * be, all turned towards you wherever you are; mushrooms of every colour with
 * eyes on their stalks; small houses alone on the hills with a light on and
 * nobody home; and overhead, wheels within wheels covered in eyes, with wings,
 * that turn to watch you go by.
 */
export function Eden({ theme }: { theme: ThemeDef }) {
  const def = getActiveTrack();
  const built = useMemo(() => {
    const bb = trackBounds();
    const probe = makeGround();
    const free = (x: number, z: number, r: number) => {
      for (const [ox, oz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) if (groundAt(x + ox, z + oz, 1e6, probe, 0)) return false;
      return true;
    };
    const land = (x: number, z: number) => (def.floor !== undefined ? terrainY(x, z) : 0);
    const main = getPaths()[0];
    // flowers and mushrooms grow in drifts beside the road, thinning out towards the horizon
    const flowers: { x: number; y: number; z: number; s: number }[] = [];
    const shrooms: { x: number; y: number; z: number; s: number; rot: number; c: THREE.Color }[] = [];
    let guard = 0;
    while ((flowers.length < 420 || shrooms.length < 220) && guard++ < 9000 && main) {
      const i = Math.floor(Math.random() * main.n);
      const lat = (main.half[i] + 5 + Math.random() ** 2 * 64) * (Math.random() < 0.5 ? 1 : -1);
      const x = main.px[i] - main.tz[i] * lat;
      const z = main.pz[i] + main.tx[i] * lat;
      if (!free(x, z, 4)) continue;
      const y = land(x, z);
      if (guard % 5 < 3 && flowers.length < 420) flowers.push({ x, y, z, s: 0.8 + Math.random() * 1.5 });
      else if (shrooms.length < 220) shrooms.push({ x, y, z, s: 0.7 + Math.random() * 2.4, rot: Math.random() * 6.3, c: new THREE.Color(CAP_COLOURS[Math.floor(Math.random() * CAP_COLOURS.length)]) });
    }
    // houses stand on the highest ground there is, well away from everything
    const tops: { x: number; y: number; z: number; rot: number }[] = [];
    const cand: { x: number; y: number; z: number }[] = [];
    for (let k = 0; k < 500; k++) {
      const x = bb.cx + (Math.random() - 0.5) * bb.r * 2.6;
      const z = bb.cz + (Math.random() - 0.5) * bb.r * 2.6;
      if (free(x, z, 16)) cand.push({ x, y: land(x, z), z });
    }
    cand.sort((a, b) => b.y - a.y);
    for (const c of cand) {
      if (tops.length >= 13) break;
      if (tops.some((t) => Math.hypot(t.x - c.x, t.z - c.z) < 90)) continue;
      tops.push({ ...c, rot: Math.random() * 6.3 });
    }
    // the watchers hang over the lap, one every so often, off to one side
    const angels: { x: number; y: number; z: number; s: number }[] = [];
    if (main) {
      for (let k = 0; k < 7; k++) {
        const i = Math.floor(((k + 0.5) / 7) * main.n);
        const lat = (36 + (k % 3) * 16) * (k % 2 ? 1 : -1);
        angels.push({ x: main.px[i] - main.tz[i] * lat, y: main.py[i] + 30 + (k % 3) * 9, z: main.pz[i] + main.tx[i] * lat, s: 1 + (k % 3) * 0.35 });
      }
    }
    return { flowers, shrooms, tops, angels };
  }, [def]);

  const geo = useMemo(() => {
    const stem = new THREE.CylinderGeometry(0.09, 0.12, 3, 5).translate(0, 1.5, 0);
    const leaf = new THREE.SphereGeometry(0.45, 6, 4).scale(1, 0.18, 0.5).translate(0.45, 1.3, 0);
    // the head faces +z: petals, a dark disc, and the eye in the middle of it
    const petals: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      petals.push(painted(new THREE.SphereGeometry(0.36, 5, 4).scale(0.5, 1, 0.16).translate(0, 0.86, 0).rotateZ(a), k % 2 ? "#ffd21f" : "#ffb300"));
    }
    const head = mergeGeometries([
      ...petals,
      painted(new THREE.CylinderGeometry(0.62, 0.62, 0.16, 14).rotateX(Math.PI / 2), "#5a3a1c"),
      painted(new THREE.SphereGeometry(0.44, 12, 10).scale(1, 1, 0.5).translate(0, 0, 0.1), "#ffffff"),
      painted(new THREE.SphereGeometry(0.22, 10, 8).scale(1, 1, 0.4).translate(0, 0, 0.3), "#3a7bd5"),
      painted(new THREE.SphereGeometry(0.11, 8, 6).scale(1, 1, 0.4).translate(0, 0, 0.37), "#0b0b12"),
    ])!;
    const stalk = mergeGeometries([
      painted(new THREE.CylinderGeometry(0.3, 0.42, 1.3, 8).translate(0, 0.65, 0), "#fff6e0"),
      ...[-0.16, 0.16].flatMap((x) => [
        painted(new THREE.SphereGeometry(0.12, 8, 6).translate(x, 0.8, 0.32), "#ffffff"),
        painted(new THREE.SphereGeometry(0.06, 6, 5).translate(x, 0.8, 0.42), "#0b0b12"),
      ]),
    ])!;
    const cap = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1).translate(0, 1.2, 0);
    const spots: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      spots.push(new THREE.SphereGeometry(0.15, 6, 5).scale(1, 0.4, 1).translate(Math.cos(a) * 0.62, 1.2 + 0.52, Math.sin(a) * 0.62));
    }
    return { stem: mergeGeometries([stem, leaf])!, head, stalk, cap, spots: mergeGeometries(spots)! };
  }, []);

  const d = useMemo(() => new THREE.Object3D(), []);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const angelRefs = useRef<(THREE.Group | null)[]>([]);
  const wheelRefs = useRef<(THREE.Group | null)[]>([]);
  const wingRefs = useRef<(THREE.Group | null)[]>([]);
  useFrame((s) => {
    const cam = s.camera.position;
    const t = s.clock.elapsedTime;
    // every sunflower turns its face to you
    const m = headRef.current;
    if (m) {
      built.flowers.forEach((f, i) => {
        d.position.set(f.x, f.y + 3 * f.s, f.z);
        d.rotation.set(-0.15, Math.atan2(cam.x - f.x, cam.z - f.z), Math.sin(t * 1.3 + i) * 0.06);
        d.scale.setScalar(f.s);
        d.updateMatrix();
        m.setMatrixAt(i, d.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    }
    angelRefs.current.forEach((g, i) => {
      if (!g) return;
      const a = built.angels[i];
      g.position.y = a.y + Math.sin(t * 0.5 + i * 1.9) * 2.2;
      g.lookAt(cam.x, cam.y, cam.z);
    });
    wheelRefs.current.forEach((g, i) => {
      if (g) g.rotation.set(t * (0.5 + (i % 3) * 0.2), t * (0.35 + (i % 2) * 0.25), i);
    });
    wingRefs.current.forEach((g, i) => {
      if (g) g.rotation.z = (i % 2 ? -1 : 1) * (0.25 + Math.sin(t * 2.2 + Math.floor(i / 2)) * 0.22);
    });
  });

  const stud = (r: number, n: number, key: string) =>
    Array.from({ length: n }, (_, k) => {
      const a = (k / n) * Math.PI * 2;
      return (
        <group key={`${key}${k}`} position={[Math.cos(a) * r, Math.sin(a) * r, 0]}>
          <mesh>
            <sphereGeometry args={[0.42, 8, 8]} />
            <meshStandardMaterial color="#ffffff" roughness={0.2} />
          </mesh>
          <mesh position={[0, 0, 0.3]}>
            <sphereGeometry args={[0.2, 6, 6]} />
            <meshBasicMaterial color="#0b0b12" />
          </mesh>
        </group>
      );
    });

  const setAll = <T,>(list: T[], place: (o: THREE.Object3D, item: T) => void, colour?: (item: T) => THREE.Color) => (el: THREE.InstancedMesh | null) => {
    if (!el) return;
    list.forEach((item, i) => {
      place(d, item);
      d.updateMatrix();
      el.setMatrixAt(i, d.matrix);
      if (colour) el.setColorAt(i, colour(item));
    });
    el.instanceMatrix.needsUpdate = true;
    if (colour && el.instanceColor) el.instanceColor.needsUpdate = true;
  };
  const placeShroom = (o: THREE.Object3D, sh: (typeof built.shrooms)[number]) => {
    o.position.set(sh.x, sh.y, sh.z);
    o.rotation.set(0, sh.rot, 0);
    o.scale.setScalar(sh.s);
  };

  return (
    <group>
      <instancedMesh
        ref={setAll(built.flowers, (o, f) => {
          o.position.set(f.x, f.y, f.z);
          o.rotation.set(0, f.x, 0);
          o.scale.setScalar(f.s);
        })}
        args={[geo.stem, undefined, built.flowers.length]}
        frustumCulled={false}
      >
        <meshStandardMaterial color="#3fae3f" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[geo.head, undefined, built.flowers.length]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={setAll(built.shrooms, placeShroom)} args={[geo.stalk, undefined, built.shrooms.length]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={setAll(built.shrooms, placeShroom, (sh) => sh.c)} args={[geo.cap, undefined, built.shrooms.length]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.45} />
      </instancedMesh>
      <instancedMesh ref={setAll(built.shrooms, placeShroom)} args={[geo.spots, undefined, built.shrooms.length]} frustumCulled={false}>
        <meshStandardMaterial color="#ffffff" roughness={0.5} />
      </instancedMesh>

      {built.tops.map((h, i) => (
        <group key={`h${i}`} position={[h.x, h.y - 0.3, h.z]} rotation={[0, h.rot, 0]}>
          <mesh position={[0, 3, 0]} castShadow>
            <boxGeometry args={[8, 6, 7]} />
            <meshStandardMaterial color={i % 3 === 0 ? "#fff6e0" : i % 3 === 1 ? "#ffe0ef" : "#e0f0ff"} roughness={0.9} />
          </mesh>
          <mesh position={[0, 7.6, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[6.6, 3.6, 4]} />
            <meshStandardMaterial color={i % 2 ? "#d9534f" : "#5b7fd6"} roughness={0.8} flatShading />
          </mesh>
          <mesh position={[0, 1.6, 3.52]}>
            <boxGeometry args={[1.5, 3.2, 0.1]} />
            <meshStandardMaterial color="#6b4a2f" roughness={0.8} />
          </mesh>
          {[-2.5, 2.5].map((x) => (
            <mesh key={x} position={[x, 3.6, 3.52]}>
              <boxGeometry args={[1.5, 1.5, 0.1]} />
              <meshStandardMaterial color="#fff7c2" emissive="#ffe98a" emissiveIntensity={2.2} toneMapped={false} />
            </mesh>
          ))}
          <mesh position={[2.4, 8.4, -1.4]}>
            <boxGeometry args={[1, 2.6, 1]} />
            <meshStandardMaterial color="#b9b0a4" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {built.angels.map((a, i) => (
        <group key={`a${i}`} ref={(el) => (angelRefs.current[i] = el)} position={[a.x, a.y, a.z]} scale={a.s}>
          {/* the eye in the middle */}
          <mesh>
            <sphereGeometry args={[2.6, 22, 18]} />
            <meshStandardMaterial color="#ffffff" roughness={0.15} emissive="#ffffff" emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[0, 0, 2.05]}>
            <sphereGeometry args={[1.3, 16, 14]} />
            <meshStandardMaterial color={theme.particles[i % theme.particles.length]} emissive={theme.particles[i % theme.particles.length]} emissiveIntensity={0.6} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0, 3.0]}>
            <sphereGeometry args={[0.62, 12, 10]} />
            <meshBasicMaterial color="#0b0b12" />
          </mesh>
          {/* wheels within wheels, set with eyes */}
          <group ref={(el) => (wheelRefs.current[i * 2] = el)}>
            <mesh>
              <torusGeometry args={[5.2, 0.28, 8, 44]} />
              <meshStandardMaterial color="#ffd86b" metalness={0.9} roughness={0.2} emissive="#ffd86b" emissiveIntensity={0.5} />
            </mesh>
            {stud(5.2, 10, "o")}
          </group>
          <group ref={(el) => (wheelRefs.current[i * 2 + 1] = el)}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[4.1, 0.24, 8, 40]} />
              <meshStandardMaterial color="#ffd86b" metalness={0.9} roughness={0.2} emissive="#ffd86b" emissiveIntensity={0.5} />
            </mesh>
            <group rotation={[Math.PI / 2, 0, 0]}>{stud(4.1, 8, "i")}</group>
          </group>
          {/* three pairs of wings */}
          {[-1, 1].flatMap((side) =>
            [0, 1, 2].map((k) => (
              <group key={`${side}${k}`} position={[side * 2.2, (k - 1) * 1.7, -0.6]}>
                <group ref={(el) => (wingRefs.current[i * 6 + k * 2 + (side > 0 ? 1 : 0)] = el)}>
                  <mesh position={[side * (4.2 - k * 0.5), 0.9, 0]} rotation={[0, 0, side * (0.5 - k * 0.45)]} scale={[1, 0.34, 0.08]}>
                    <sphereGeometry args={[4.4 - k * 0.6, 10, 6]} />
                    <meshStandardMaterial color="#ffffff" roughness={0.6} emissive="#ffffff" emissiveIntensity={0.2} />
                  </mesh>
                </group>
              </group>
            ))
          )}
          <mesh position={[0, 0, -1.2]}>
            <ringGeometry args={[6.4, 7.2, 40]} />
            <meshBasicMaterial color="#fff7c2" transparent opacity={0.5} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * The people who came to watch: a row of them behind the barrier on the long
 * straights, in the colours of the stretch, jumping as the karts go by.
 */
export function Fans({ themes }: { themes: ThemeDef[] }) {
  const list = useMemo(() => {
    const main = getPaths()[0];
    const out: { x: number; y: number; z: number; ph: number; s: number; c: THREE.Color }[] = [];
    if (!main) return out;
    const probe = makeGround();
    const step = Math.max(1, Math.round(2.6 / main.ds));
    const block = Math.max(1, Math.round(120 / main.ds));
    for (let i = 0; i < main.n && out.length < 170; i += step) {
      // a group of them, then a gap, then another group on the other side
      const b = Math.floor(i / block);
      if (b % 3 !== 0) continue;
      const t = main.prog[i];
      if (!(main.flags[i] & F_SOLID) || ZONES.some((z) => t >= z.t0 - 0.01 && t <= z.t1 + 0.01)) continue;
      const side = (b / 3) % 2 ? 1 : -1;
      if (!(main.flags[i] & (side === 1 ? F_WALL_POS : F_WALL_NEG))) continue;
      const lat = (main.half[i] + 1.9 + ((i * 7) % 3) * 0.7) * side;
      const x = main.px[i] - main.tz[i] * lat;
      const z = main.pz[i] + main.tx[i] * lat;
      if (groundAt(x, z, 1e6, probe, 0)) continue;
      const th = themes[sectorIndexAt(t)] ?? themes[0];
      out.push({ x, y: main.py[i] + 0.2, z, ph: i * 0.37, s: 0.75 + ((i * 13) % 5) * 0.08, c: new THREE.Color(th.particles[(i / step) % th.particles.length | 0]) });
    }
    return out;
  }, [themes]);
  const ref = useRef<THREE.InstancedMesh>(null);
  const d = useMemo(() => new THREE.Object3D(), []);
  const coloured = useRef(false);
  const geo = useMemo(() => new THREE.CapsuleGeometry(0.42, 0.55, 3, 8).translate(0, 0.7, 0), []);
  useFrame((s) => {
    const m = ref.current;
    if (!m) return;
    const t = s.clock.elapsedTime;
    const me = raceSnapshot.racers[0];
    list.forEach((f, i) => {
      // they jump higher the nearer the player is
      const near = me ? Math.max(0, 1 - Math.hypot(me.x - f.x, me.z - f.z) / 45) : 0;
      d.position.set(f.x, f.y + Math.abs(Math.sin(t * 5 + f.ph)) * (0.15 + near * 0.9), f.z);
      d.rotation.set(0, f.ph, Math.sin(t * 3 + f.ph) * 0.12);
      d.scale.setScalar(f.s);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      if (!coloured.current) m.setColorAt(i, f.c);
    });
    m.instanceMatrix.needsUpdate = true;
    if (!coloured.current && m.instanceColor) {
      m.instanceColor.needsUpdate = true;
      coloured.current = true;
    }
  });
  if (!list.length) return null;
  return (
    <instancedMesh ref={ref} args={[geo, undefined, list.length]} frustumCulled={false}>
      <meshStandardMaterial roughness={0.55} />
    </instancedMesh>
  );
}

type Vent = "spray" | "fire" | "spark" | "bubble" | "glitter";
const VENT_OF: Record<string, Vent> = {
  aqua: "spray", liquid: "spray", mac: "spray", tux: "spray", liminal: "spray",
  sunset: "fire", cyberpunk: "fire", vapor: "fire",
  techno: "spark", y2k: "spark", webcore: "spark", win98: "spark", metro: "spark", arch: "spark",
  slime: "bubble", backrooms: "bubble",
};

/** Things that go off beside the road every few seconds: a geyser, a jet of flame, a shower of sparks, a burst of glitter. */
export function Vents({ themes }: { themes: ThemeDef[] }) {
  const spots = useMemo(() => {
    const main = getPaths()[0];
    const out: { p: THREE.Vector3; theme: ThemeDef; next: number; left: number }[] = [];
    if (!main) return out;
    const probe = makeGround();
    for (let k = 0; k < 12; k++) {
      const i = Math.floor(((k + 0.21) / 12) * main.n) % main.n;
      const lat = (main.half[i] + 9 + (k % 3) * 4) * (k % 2 ? 1 : -1);
      const x = main.px[i] - main.tz[i] * lat;
      const z = main.pz[i] + main.tx[i] * lat;
      if (groundAt(x, z, 1e6, probe, 0)) continue;
      out.push({ p: new THREE.Vector3(x, main.py[i] - 0.5, z), theme: themes[sectorIndexAt(main.prog[i])] ?? themes[0], next: 1 + k * 0.7, left: 0 });
    }
    return out;
  }, [themes]);
  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    for (const v of spots) {
      if (t > v.next) {
        v.next = t + 3.5 + Math.random() * 4;
        v.left = 1.1;
      }
      if (v.left <= 0) continue;
      v.left -= dt;
      const kind = VENT_OF[v.theme.id] ?? "glitter";
      const colour = kind === "fire" ? (Math.random() < 0.5 ? "#ffb347" : "#ff5f3a") : kind === "spray" ? "#e8fbff" : kind === "spark" ? v.theme.glow : kind === "bubble" ? v.theme.barrierB : v.theme.particles[Math.floor(Math.random() * v.theme.particles.length)];
      emitParticles({
        position: v.p,
        color: colour,
        count: 3,
        speed: kind === "bubble" ? 4 : 11,
        spread: kind === "spark" || kind === "glitter" ? 0.9 : 0.28,
        size: kind === "spray" || kind === "bubble" ? 0.34 : 0.24,
        life: kind === "bubble" ? 1.6 : 1.0,
        upBias: 2.6,
        gravity: kind === "bubble" ? 1 : 16,
      });
    }
  });
  return null;
}

type Beast = "whale" | "saucer" | "jelly";
const BEAST_OF: Record<string, Beast> = {
  aqua: "whale", liquid: "whale", mac: "whale", tux: "whale", frutiger: "whale", slime: "whale",
  techno: "saucer", cyberpunk: "saucer", y2k: "saucer", webcore: "saucer", win98: "saucer", arch: "saucer", noir: "saucer",
};

/** Something very large and in no hurry, going by overhead: a whale, a saucer or a jellyfish, as the place has it. */
export function SkyBeasts({ theme }: { theme: ThemeDef }) {
  const bb = useMemo(() => trackBounds(), []);
  const kind = BEAST_OF[theme.id] ?? "jelly";
  const refs = useRef<(THREE.Group | null)[]>([]);
  const parts = useRef<(THREE.Object3D | null)[]>([]);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    refs.current.forEach((g, i) => {
      if (!g) return;
      const dir = i % 2 ? 1 : -1;
      const a = t * 0.028 * dir + i * 3.3 + 1;
      const r = bb.r * (0.3 + i * 0.5);
      g.position.set(bb.cx + Math.cos(a) * r, bb.top + 60 + i * 22 + Math.sin(t * 0.35 + i) * 4, bb.cz + Math.sin(a) * r);
      g.rotation.set(Math.sin(t * 0.35 + i) * 0.08, Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir), 0);
    });
    parts.current.forEach((o, i) => {
      if (!o) return;
      if (kind === "whale") o.rotation.x = Math.sin(t * 1.3 + i) * 0.35;
      else if (kind === "saucer") o.rotation.y = t * 1.2;
      else o.scale.set(1, 1 + Math.sin(t * 1.6 + i) * 0.18, 1);
    });
  });
  const a = theme.particles[0];
  const b = theme.particles[1 % theme.particles.length];
  return (
    <group>
      {[0, 1].map((i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)} scale={1 + i * 0.4}>
          {kind === "whale" && (
            <>
              <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.8]}>
                <capsuleGeometry args={[7, 20, 8, 18]} />
                <meshStandardMaterial color="#5b8fd6" roughness={0.6} />
              </mesh>
              <mesh position={[0, -3, 2]} rotation={[Math.PI / 2, 0, 0]} scale={[0.85, 0.9, 0.4]}>
                <capsuleGeometry args={[7, 17, 6, 14]} />
                <meshStandardMaterial color="#eaf4ff" roughness={0.7} />
              </mesh>
              <group ref={(el) => (parts.current[i] = el)} position={[0, 0, -16]}>
                <mesh position={[0, 0, -4]} scale={[1, 0.12, 0.6]}>
                  <sphereGeometry args={[8, 12, 8]} />
                  <meshStandardMaterial color="#5b8fd6" roughness={0.6} />
                </mesh>
              </group>
              {[-1, 1].map((sd) => (
                <mesh key={sd} position={[sd * 8, -2.5, 6]} rotation={[0, 0, sd * 0.5]} scale={[1, 0.1, 0.45]}>
                  <sphereGeometry args={[6, 10, 8]} />
                  <meshStandardMaterial color="#4a7cc0" roughness={0.6} />
                </mesh>
              ))}
              {[-1, 1].map((sd) => (
                <mesh key={sd} position={[sd * 5.6, 1.2, 12]}>
                  <sphereGeometry args={[0.7, 8, 8]} />
                  <meshBasicMaterial color="#0b0b12" />
                </mesh>
              ))}
            </>
          )}
          {kind === "saucer" && (
            <>
              <mesh scale={[1, 0.18, 1]}>
                <sphereGeometry args={[16, 26, 12]} />
                <meshStandardMaterial color="#aab6c8" metalness={0.5} roughness={0.3} />
              </mesh>
              <mesh position={[0, 2.4, 0]}>
                <sphereGeometry args={[6.5, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial color={a} emissive={a} emissiveIntensity={0.7} transparent opacity={0.75} />
              </mesh>
              <group ref={(el) => (parts.current[i] = el)}>
                {Array.from({ length: 10 }, (_, k) => (
                  <mesh key={k} position={[Math.cos((k / 10) * 6.283) * 13, -1, Math.sin((k / 10) * 6.283) * 13]}>
                    <sphereGeometry args={[1, 8, 8]} />
                    <meshStandardMaterial color={k % 2 ? a : b} emissive={k % 2 ? a : b} emissiveIntensity={3} toneMapped={false} />
                  </mesh>
                ))}
              </group>
              <mesh position={[0, -16, 0]}>
                <coneGeometry args={[9, 30, 18, 1, true]} />
                <meshBasicMaterial color={b} transparent opacity={0.13} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
              </mesh>
            </>
          )}
          {kind === "jelly" && (
            <group ref={(el) => (parts.current[i] = el)}>
              <mesh>
                <sphereGeometry args={[10, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshPhysicalMaterial color={a} roughness={0.1} clearcoat={1} transparent opacity={0.7} emissive={a} emissiveIntensity={0.35} side={THREE.DoubleSide} />
              </mesh>
              {Array.from({ length: 8 }, (_, k) => (
                <mesh key={k} position={[Math.cos((k / 8) * 6.283) * 6, -9, Math.sin((k / 8) * 6.283) * 6]}>
                  <cylinderGeometry args={[0.5, 0.15, 18, 5]} />
                  <meshStandardMaterial color={b} emissive={b} emissiveIntensity={0.6} transparent opacity={0.8} />
                </mesh>
              ))}
            </group>
          )}
        </group>
      ))}
    </group>
  );
}
