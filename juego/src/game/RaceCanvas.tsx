import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Suspense, useRef } from "react";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import Scene from "./Scene";
import type { UseControlsReturn } from "../controls";
import { useGame } from "../store";
import { THEMES, raceSnapshot, biomeMix } from "../data";

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
        <ambientLight intensity={theme.ambient} color={theme.ambientColor} />
        <hemisphereLight args={[theme.hemiSky, theme.hemiGround, 0.85]} />
        <Scene controls={controls} />
        {bloomOn && <PostFX intensity={theme.bloom} />}
      </Suspense>
    </Canvas>
  );
}

function BiomeFog({ theme }: { theme: { skyTop: string; skyBottom: string; fog: string; fogNear: number; fogFar: number } }) {
  const fogRef = useRef<THREE.Fog>(null);
  const { gl } = useThree();
  const cur = new THREE.Color(theme.fog);
  const target = new THREE.Color();
  const curTop = new THREE.Color(theme.skyTop);
  const tgtTop = new THREE.Color();
  const curBot = new THREE.Color(theme.skyBottom);
  const tgtBot = new THREE.Color();
  useFrame((_: any, dt: number) => {
    const r = raceSnapshot.racers[0];
    const t = r?.t ?? 0;
    const { a, b, u } = biomeMix(t);
    tgtTop.copy(new THREE.Color(a.skyTop)).lerp(new THREE.Color(b.skyTop), u);
    tgtBot.copy(new THREE.Color(a.skyBottom)).lerp(new THREE.Color(b.skyBottom), u);
    target.copy(new THREE.Color(a.fog)).lerp(new THREE.Color(b.fog), u);
    const k = Math.min(1, dt * 1.4);
    cur.lerp(target, k);
    curTop.lerp(tgtTop, k);
    curBot.lerp(tgtBot, k);
    if (fogRef.current) {
      fogRef.current.color.copy(cur);
      const near = THREE.MathUtils.lerp((a as any).fogNear ?? theme.fogNear, (b as any).fogNear ?? theme.fogNear, u);
      const far = THREE.MathUtils.lerp((a as any).fogFar ?? theme.fogFar, (b as any).fogFar ?? theme.fogFar, u);
      fogRef.current.near = near;
      fogRef.current.far = far;
    }
    const el = gl.domElement;
    el.style.background = `linear-gradient(180deg, ${curTop.getStyle()} 0%, ${curBot.getStyle()} 62%, ${cur.getStyle()} 100%)`;
  });
  return <fog ref={fogRef} attach="fog" args={[theme.fog, theme.fogNear, theme.fogFar]} />;
}
