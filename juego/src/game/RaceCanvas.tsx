import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Suspense, useRef } from "react";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import Scene from "./Scene";
import type { UseControlsReturn } from "../controls";
import { useGame } from "../store";
import { THEMES, raceSnapshot, themeOnLap } from "../data";
import { sectorMix } from "../trackCurve";

function PostFX({ intensity }: { intensity: number }) {
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={intensity} luminanceThreshold={0.45} luminanceSmoothing={0.3} mipmapBlur radius={0.75} />
      <Vignette eskil={false} offset={0.18} darkness={0.55} />
    </EffectComposer>
  );
}

export default function RaceCanvas({ controls }: { controls: UseControlsReturn }) {
  const themeId = useGame((s) => s.theme);
  const bloomOn = useGame((s) => s.settings.bloom);
  const theme = THEMES[themeId];

  return (
    <Canvas
      shadows
      dpr={[1, 1.7]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ fov: 64, near: 0.5, far: 1400, position: [0, 5, -14] }}
      style={{ background: "linear-gradient(180deg, #7fd7ff 0%, #eafff4 62%, #cdeeff 100%)" }}
    >
      <Suspense fallback={null}>
        <BiomeFog theme={theme} />
        <Scene controls={controls} />
        {bloomOn && <PostFX intensity={theme.bloom} />}
      </Suspense>
    </Canvas>
  );
}

/** Fog, backdrop and fill light of the aesthetic the player is driving through. */
function BiomeFog({ theme }: { theme: { skyTop: string; skyBottom: string; fog: string; fogNear: number; fogFar: number } }) {
  const fogRef = useRef<THREE.Fog>(null);
  const ambRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const { gl } = useThree();
  const lap = useGame((s) => s.telemetry.lap) - 1;
  const cur = useRef({ fog: new THREE.Color(theme.fog), top: new THREE.Color(theme.skyTop), bot: new THREE.Color(theme.skyBottom) });
  const tmp = useRef({ a: new THREE.Color(), b: new THREE.Color() });
  useFrame((_, dt) => {
    const { a, b, u } = sectorMix(raceSnapshot.racers[0]?.t ?? 0);
    const ta = themeOnLap(a, lap);
    const tb = themeOnLap(b, lap);
    const k = Math.min(1, dt * 1.4);
    const c = cur.current;
    const t = tmp.current;
    c.fog.lerp(t.a.set(ta.fog).lerp(t.b.set(tb.fog), u), k);
    c.top.lerp(t.a.set(ta.skyTop).lerp(t.b.set(tb.skyTop), u), k);
    c.bot.lerp(t.a.set(ta.skyBottom).lerp(t.b.set(tb.skyBottom), u), k);
    if (fogRef.current) {
      fogRef.current.color.copy(c.fog);
      fogRef.current.near += (THREE.MathUtils.lerp(ta.fogNear, tb.fogNear, u) - fogRef.current.near) * k;
      fogRef.current.far += (THREE.MathUtils.lerp(ta.fogFar, tb.fogFar, u) - fogRef.current.far) * k;
    }
    if (ambRef.current) {
      ambRef.current.color.lerp(t.a.set(ta.ambientColor).lerp(t.b.set(tb.ambientColor), u), k);
      ambRef.current.intensity += (THREE.MathUtils.lerp(ta.ambient, tb.ambient, u) - ambRef.current.intensity) * k;
    }
    if (hemiRef.current) {
      hemiRef.current.color.lerp(t.a.set(ta.hemiSky).lerp(t.b.set(tb.hemiSky), u), k);
      hemiRef.current.groundColor.lerp(t.a.set(ta.hemiGround).lerp(t.b.set(tb.hemiGround), u), k);
    }
    gl.domElement.style.background = `linear-gradient(180deg, ${c.top.getStyle()} 0%, ${c.bot.getStyle()} 62%, ${c.fog.getStyle()} 100%)`;
  });
  return (
    <>
      <fog ref={fogRef} attach="fog" args={[theme.fog, theme.fogNear, theme.fogFar]} />
      <ambientLight ref={ambRef} intensity={1} />
      <hemisphereLight ref={hemiRef} args={["#ffffff", "#888888", 0.85]} />
    </>
  );
}
