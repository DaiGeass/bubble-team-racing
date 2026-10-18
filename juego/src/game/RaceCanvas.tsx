import { graphicsProfile, ResolutionBudget } from "../graphics";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Suspense, useMemo, useRef } from "react";
import { EffectComposer, Bloom, Vignette, FXAA } from "@react-three/postprocessing";
import Scene from "./Scene";
import type { UseControlsReturn } from "../controls";
import { useGame } from "../store";
import { THEMES, raceSnapshot, themeOnLap } from "../data";
import { sectorMix } from "../trackCurve";

function PostFX({ intensity }: { intensity: number }) {
  const gl = useThree((s) => s.gl);
  // Not every WebGL2 driver supports floating-point colour attachments.
  const bufferType = gl.extensions.has("EXT_color_buffer_float") ? THREE.HalfFloatType : THREE.UnsignedByteType;
  return (
    <EffectComposer multisampling={0} frameBufferType={bufferType}>
      <Bloom intensity={intensity} luminanceThreshold={0.72} luminanceSmoothing={0.3} mipmapBlur radius={0.75} />
      <Vignette eskil={false} offset={0.18} darkness={0.55} />
      <FXAA />
    </EffectComposer>
  );
}

export default function RaceCanvas({ controls }: { controls: UseControlsReturn }) {
  const themeId = useGame((s) => s.theme);
  const bloomOn = useGame((s) => s.settings.bloom);
  const quality = useGame((s) => s.settings.graphicsQuality);
  const profile = graphicsProfile(quality);
  const theme = THEMES[themeId];

  return (
    <Canvas
      key={quality}
      shadows={profile.shadowSize > 0 ? "percentage" : false}
      dpr={[0.65, profile.maxDpr]}
      gl={{ antialias: profile.antialias, powerPreference: "high-performance" }}
      camera={{ fov: 64, near: 0.5, far: 1400, position: [0, 5, -14] }}
      style={{ background: "linear-gradient(180deg, #7fd7ff 0%, #eafff4 62%, #cdeeff 100%)" }}
    >
      <Suspense fallback={null}>
        {quality === "auto" && <AdaptiveResolution />}
        <BiomeFog theme={theme} />
        <Scene controls={controls} />
        {bloomOn && profile.bloom && <PostFX intensity={theme.bloom} />}
      </Suspense>
    </Canvas>
  );
}

function AdaptiveResolution() {
  const setDpr = useThree((s) => s.setDpr);
  const max = Math.min(window.devicePixelRatio || 1, graphicsProfile("auto").maxDpr);
  const budget = useMemo(() => new ResolutionBudget(max), [max]);
  useFrame((_, delta) => {
    if (document.hidden || useGame.getState().paused) {
      budget.reset();
      return;
    }
    const next = budget.sample(delta);
    if (next !== null) setDpr(next);
  });
  return null;
}

/** Fog, backdrop and fill light of the aesthetic the player is driving through. */
function BiomeFog({ theme }: { theme: { skyTop: string; skyBottom: string; fog: string; fogNear: number; fogFar: number } }) {
  const fogRef = useRef<THREE.Fog>(null);
  const ambRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const { gl } = useThree();
  const lap = useGame((s) => s.telemetry.lap) - 1;
  const cur = useRef({ fog: new THREE.Color(theme.fog), top: new THREE.Color(theme.skyTop), bot: new THREE.Color(theme.skyBottom) });
  const backgroundClock = useRef(0);
  const lastBackground = useRef("");
  const tmp = useRef({ a: new THREE.Color(), b: new THREE.Color() });
  useFrame((_, dt) => {
    const { a, b, u } = sectorMix(raceSnapshot.racers[0]?.t ?? 0);
    const ta = themeOnLap(a, lap);
    const tb = themeOnLap(b, lap);
    const k = Math.min(1, dt * 1.4);
    const c = cur.current;
    const t = tmp.current;
    // under water everything fades into the colour of the sea a short way off
    const under = raceSnapshot.racers[0]?.mode === "sub";
    if (under) {
      t.a.set(ta.water).multiplyScalar(0.55);
      c.fog.lerp(t.a, k * 2);
      c.top.lerp(t.b.set(ta.water).multiplyScalar(0.8), k * 2);
      c.bot.lerp(t.a, k * 2);
    } else {
      c.fog.lerp(t.a.set(ta.fog).lerp(t.b.set(tb.fog), u), k);
      c.top.lerp(t.a.set(ta.skyTop).lerp(t.b.set(tb.skyTop), u), k);
      c.bot.lerp(t.a.set(ta.skyBottom).lerp(t.b.set(tb.skyBottom), u), k);
    }
    if (fogRef.current) {
      fogRef.current.color.copy(c.fog);
      fogRef.current.near += ((under ? 8 : THREE.MathUtils.lerp(ta.fogNear, tb.fogNear, u)) - fogRef.current.near) * k * 2;
      fogRef.current.far += ((under ? 130 : THREE.MathUtils.lerp(ta.fogFar, tb.fogFar, u)) - fogRef.current.far) * k * 2;
    }
    if (ambRef.current) {
      ambRef.current.color.lerp(t.a.set(ta.ambientColor).lerp(t.b.set(tb.ambientColor), u), k);
      ambRef.current.intensity += (THREE.MathUtils.lerp(ta.ambient, tb.ambient, u) - ambRef.current.intensity) * k;
    }
    if (hemiRef.current) {
      hemiRef.current.color.lerp(t.a.set(ta.hemiSky).lerp(t.b.set(tb.hemiSky), u), k);
      hemiRef.current.groundColor.lerp(t.a.set(ta.hemiGround).lerp(t.b.set(tb.hemiGround), u), k);
    }
    backgroundClock.current += dt;
    if (backgroundClock.current >= 0.1) {
      backgroundClock.current = 0;
      const background = `linear-gradient(180deg, ${c.top.getStyle()} 0%, ${c.bot.getStyle()} 62%, ${c.fog.getStyle()} 100%)`;
      if (background !== lastBackground.current) {
        lastBackground.current = background;
        gl.domElement.style.background = background;
      }
    }
  });
  return (
    <>
      <fog ref={fogRef} attach="fog" args={[theme.fog, theme.fogNear, theme.fogFar]} />
      <ambientLight ref={ambRef} intensity={1} />
      <hemisphereLight ref={hemiRef} args={["#ffffff", "#888888", 0.85]} />
    </>
  );
}
