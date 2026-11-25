import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getPaths, sectorIndexAt, F_SOLID } from "../trackCurve";
import { ZONES, type ThemeDef, type ThemeId } from "../data";
import { songClock } from "../music";

// ---------------------------------------------------------------------------
// The furniture of the internet aesthetics, beside the road of every stretch
// that is in one: eyes that hang in the air and follow you (weirdcore), cubes
// that will not keep still (glitchcore), toy blocks and beach balls
// (kidcore), toadstools (cottagecore), great soft bears (traumacore),
// equaliser pillars that jump to the music (nightcore), party balloons under
// the ceiling (Level Fun), concrete columns (Level 1) and, in the night sky
// of Frutiger Aurora, the aurora.
// ---------------------------------------------------------------------------

type Kind = "eye" | "glitch" | "block" | "shroom" | "bear" | "eq" | "balloon" | "pillar" | "aurora";

const KIND_OF: Partial<Record<ThemeId, Kind>> = {
  weirdcore: "eye", glitchcore: "glitch", kidcore: "block", cottagecore: "shroom", traumacore: "bear",
  nightcore: "eq", levelfun: "balloon", level1: "pillar", aurora: "aurora",
};


interface Spot {
  p: THREE.Vector3;
  rot: number;
  s: number;
  theme: ThemeDef;
  phase: number;
}

function useSpots(themes: ThemeDef[]) {
  return useMemo(() => {
    const out: Partial<Record<Kind, Spot[]>> = {};
    const main = getPaths()[0];
    if (!main) return out;
    const every = Math.max(1, Math.round(34 / main.ds));
    let k = 0;
    for (let i = 0; i < main.n; i += every, k++) {
      const t = main.prog[i];
      const theme = themes[sectorIndexAt(t)] ?? themes[0];
      const kind = KIND_OF[theme.id];
      if (!kind) continue;
      const zone = ZONES.find((z) => t >= z.t0 && t <= z.t1);
      if (zone?.type === "sub") continue;
      const side = k % 2 ? 1 : -1;
      const inside = kind === "balloon" || kind === "pillar";
      if (inside && !(main.flags[i] & F_SOLID)) continue;
      const lat = side * (inside ? main.half[i] - 0.4 : main.half[i] + 9 + ((k * 7) % 13));
      const up = kind === "eye" ? 6 + ((k * 5) % 7) : kind === "glitch" ? 3 + ((k * 3) % 8) : kind === "balloon" ? 4.6 + ((k * 3) % 4) * 0.35 : kind === "aurora" ? 70 + ((k * 11) % 30) : 0;
      const p = new THREE.Vector3(main.px[i] - main.tz[i] * lat, main.py[i] + up - (kind === "block" || kind === "shroom" || kind === "bear" || kind === "eq" ? 0.6 : 0), main.pz[i] + main.tx[i] * lat);
      // facing the road
      (out[kind] ??= []).push({ p, rot: Math.atan2(main.tz[i] * side, -main.tx[i] * side), s: 0.8 + ((k * 13) % 7) * 0.08, theme, phase: k * 1.37 });
      // the aurora wants long ribbons: only one in three
      if (kind === "aurora") i += every * 2;
    }
    for (const key of Object.keys(out) as Kind[]) out[key] = out[key]!.slice(0, 80);
    return out;
  }, [themes]);
}

/** One part of a prop, drawn for every spot of its kind. */
function Part({ spots, geometry, children, offset = [0, 0, 0], scale = [1, 1, 1], animate }: {
  spots: Spot[];
  geometry: THREE.BufferGeometry;
  children: React.ReactNode;
  offset?: [number, number, number];
  scale?: [number, number, number];
  animate?: (o: THREE.Object3D, s: Spot, time: number) => void;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  const local = useMemo(() => new THREE.Matrix4().compose(new THREE.Vector3(...offset), new THREE.Quaternion(), new THREE.Vector3(...scale)), [offset, scale]);
  const lay = (time: number) => {
    const mesh = ref.current;
    if (!mesh) return;
    spots.forEach((s, i) => {
      o.position.copy(s.p);
      o.rotation.set(0, s.rot, 0);
      o.scale.setScalar(s.s);
      animate?.(o, s, time);
      o.updateMatrix();
      o.matrix.multiply(local);
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  useFrame((state) => {
    if (animate || !ref.current?.userData.laid) {
      lay(state.clock.elapsedTime);
      if (ref.current) ref.current.userData.laid = true;
    }
  });
  if (!spots.length) return null;
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, spots.length]} frustumCulled={false}>
      {children}
    </instancedMesh>
  );
}

export default function CoreDecor({ themes }: { themes: ThemeDef[] }) {
  const spots = useSpots(themes);
  const geo = useMemo(
    () => ({
      ball: new THREE.SphereGeometry(1, 16, 12),
      box: new THREE.BoxGeometry(1, 1, 1),
      cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
      cap: new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      plane: new THREE.PlaneGeometry(1, 1, 24, 1),
    }),
    [],
  );
  const pick = (k: Kind) => spots[k] ?? [];
  const glowOf = (k: Kind) => pick(k)[0]?.theme.glow ?? "#ffffff";
  const aOf = (k: Kind) => pick(k)[0]?.theme.barrierA ?? "#ffffff";
  const bOf = (k: Kind) => pick(k)[0]?.theme.barrierB ?? "#ffffff";

  // a bob for things that hang in the air, and a jitter for the glitches
  const bob = (o: THREE.Object3D, s: Spot, t: number) => {
    o.position.y += Math.sin(t * 0.8 + s.phase) * 0.9;
  };
  const glitch = (o: THREE.Object3D, s: Spot, t: number) => {
    const step = Math.floor(t * 4 + s.phase);
    const jump = Math.sin(step * 12.9898 + s.phase) * 43758.5453;
    const r = jump - Math.floor(jump);
    if (r > 0.8) o.position.x += (r - 0.9) * 8;
    o.rotation.set(step * 0.7, step * 1.3, 0);
    o.scale.multiplyScalar(r > 0.92 ? 1.6 : 1);
  };
  const eq = (o: THREE.Object3D, s: Spot, t: number) => {
    const beat = songClock()?.beat ?? (t * 2) % 1;
    const h = 2 + 8 * Math.abs(Math.sin(t * 2.3 + s.phase)) * (0.5 + 0.5 * Math.pow(1 - beat, 2));
    o.scale.set(s.s, h, s.s);
  };
  const sway = (o: THREE.Object3D, s: Spot, t: number) => {
    o.position.y += Math.sin(t * 1.4 + s.phase) * 0.25;
    o.rotation.z = Math.sin(t * 0.9 + s.phase) * 0.12;
  };
  const wave = (o: THREE.Object3D, s: Spot, t: number) => {
    o.position.y += Math.sin(t * 0.3 + s.phase) * 6;
    o.rotation.y += Math.sin(t * 0.2 + s.phase) * 0.3;
  };

  return (
    <group>
      {/* weirdcore: an eye, white with a coloured iris, turned to the road */}
      <Part spots={pick("eye")} geometry={geo.ball} scale={[1.6, 1.6, 1.6]} animate={bob}>
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.35} roughness={0.3} />
      </Part>
      <Part spots={pick("eye")} geometry={geo.ball} offset={[0, 0, 1.25]} scale={[0.75, 0.75, 0.5]} animate={bob}>
        <meshStandardMaterial color={aOf("eye")} emissive={aOf("eye")} emissiveIntensity={0.6} />
      </Part>
      <Part spots={pick("eye")} geometry={geo.ball} offset={[0, 0, 1.6]} scale={[0.32, 0.32, 0.2]} animate={bob}>
        <meshBasicMaterial color="#05010a" />
      </Part>

      {/* glitchcore: cubes that jump about and come apart */}
      <Part spots={pick("glitch")} geometry={geo.box} scale={[2.2, 2.2, 2.2]} animate={glitch}>
        <meshStandardMaterial color={aOf("glitch")} emissive={aOf("glitch")} emissiveIntensity={1.4} toneMapped={false} wireframe />
      </Part>
      <Part spots={pick("glitch")} geometry={geo.box} scale={[1.3, 1.3, 1.3]} animate={glitch}>
        <meshStandardMaterial color={bOf("glitch")} emissive={bOf("glitch")} emissiveIntensity={1.2} toneMapped={false} />
      </Part>

      {/* kidcore: a stack of toy blocks and a beach ball */}
      <Part spots={pick("block")} geometry={geo.box} offset={[0, 1.2, 0]} scale={[2.4, 2.4, 2.4]}>
        <meshStandardMaterial color="#ff3b3b" roughness={0.45} />
      </Part>
      <Part spots={pick("block")} geometry={geo.box} offset={[0.3, 3.4, 0.2]} scale={[2, 2, 2]}>
        <meshStandardMaterial color="#2f6dff" roughness={0.45} />
      </Part>
      <Part spots={pick("block")} geometry={geo.box} offset={[-0.2, 5.1, -0.1]} scale={[1.5, 1.5, 1.5]}>
        <meshStandardMaterial color="#ffd400" roughness={0.45} />
      </Part>
      <Part spots={pick("block")} geometry={geo.ball} offset={[3.2, 1.3, 1]} scale={[1.3, 1.3, 1.3]}>
        <meshStandardMaterial color="#5ad44a" roughness={0.3} />
      </Part>

      {/* cottagecore: a toadstool */}
      <Part spots={pick("shroom")} geometry={geo.cyl} offset={[0, 1.4, 0]} scale={[0.55, 2.8, 0.55]}>
        <meshStandardMaterial color="#fff4e0" roughness={0.8} />
      </Part>
      <Part spots={pick("shroom")} geometry={geo.cap} offset={[0, 2.7, 0]} scale={[2.2, 1.6, 2.2]}>
        <meshStandardMaterial color="#e2433b" roughness={0.5} />
      </Part>
      <Part spots={pick("shroom")} geometry={geo.ball} offset={[0.9, 3.9, 0.6]} scale={[0.28, 0.2, 0.28]}>
        <meshStandardMaterial color="#ffffff" />
      </Part>
      <Part spots={pick("shroom")} geometry={geo.ball} offset={[-0.8, 3.7, -0.7]} scale={[0.32, 0.22, 0.32]}>
        <meshStandardMaterial color="#ffffff" />
      </Part>

      {/* traumacore: a great soft bear, sitting */}
      <Part spots={pick("bear")} geometry={geo.ball} offset={[0, 2.2, 0]} scale={[2.3, 2.5, 2]} animate={sway}>
        <meshStandardMaterial color={aOf("bear")} roughness={0.95} />
      </Part>
      <Part spots={pick("bear")} geometry={geo.ball} offset={[0, 5.4, 0.2]} scale={[1.7, 1.6, 1.6]} animate={sway}>
        <meshStandardMaterial color={aOf("bear")} roughness={0.95} />
      </Part>
      <Part spots={pick("bear")} geometry={geo.ball} offset={[1.2, 6.7, 0]} scale={[0.6, 0.6, 0.4]} animate={sway}>
        <meshStandardMaterial color={bOf("bear")} roughness={0.95} />
      </Part>
      <Part spots={pick("bear")} geometry={geo.ball} offset={[-1.2, 6.7, 0]} scale={[0.6, 0.6, 0.4]} animate={sway}>
        <meshStandardMaterial color={bOf("bear")} roughness={0.95} />
      </Part>
      <Part spots={pick("bear")} geometry={geo.ball} offset={[0, 5.2, 1.5]} scale={[0.5, 0.4, 0.35]} animate={sway}>
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </Part>

      {/* nightcore: equaliser pillars, as tall as the music is loud */}
      <Part spots={pick("eq")} geometry={geo.box} offset={[0, 0.5, 0]} scale={[1.4, 1, 1.4]} animate={eq}>
        <meshStandardMaterial color={aOf("eq")} emissive={glowOf("eq")} emissiveIntensity={1.8} toneMapped={false} />
      </Part>

      {/* Level Fun: balloons under the ceiling */}
      <Part spots={pick("balloon")} geometry={geo.ball} scale={[0.55, 0.68, 0.55]} animate={bob}>
        <meshStandardMaterial color={aOf("balloon")} roughness={0.2} metalness={0.1} />
      </Part>
      <Part spots={pick("balloon")} geometry={geo.ball} offset={[0.9, -0.3, 0.3]} scale={[0.5, 0.62, 0.5]} animate={bob}>
        <meshStandardMaterial color={bOf("balloon")} roughness={0.2} metalness={0.1} />
      </Part>
      <Part spots={pick("balloon")} geometry={geo.ball} offset={[-0.7, -0.2, -0.4]} scale={[0.5, 0.62, 0.5]} animate={bob}>
        <meshStandardMaterial color="#3dc6ff" roughness={0.2} metalness={0.1} />
      </Part>

      {/* Level 1: a concrete column against the wall, with a hazard band */}
      <Part spots={pick("pillar")} geometry={geo.box} offset={[0, 3.6, 0]} scale={[1.2, 7.2, 1.2]}>
        <meshStandardMaterial color="#8a8d90" roughness={0.95} />
      </Part>
      <Part spots={pick("pillar")} geometry={geo.box} offset={[0, 0.6, 0]} scale={[1.3, 1.2, 1.3]}>
        <meshStandardMaterial color="#d9c34a" roughness={0.7} />
      </Part>

      {/* Frutiger Aurora: curtains of light high in the night */}
      <Part spots={pick("aurora")} geometry={geo.plane} scale={[90, 26, 1]} animate={wave}>
        <meshBasicMaterial color={glowOf("aurora")} transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </Part>
      <Part spots={pick("aurora")} geometry={geo.plane} offset={[0, 14, 6]} scale={[70, 18, 1]} animate={wave}>
        <meshBasicMaterial color={bOf("aurora")} transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </Part>
    </group>
  );
}
