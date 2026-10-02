import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import Scene from "./Scene";
import type { UseControlsReturn } from "../controls";
import { useGame } from "../store";
import { THEMES } from "../data";

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
      style={{ background: `linear-gradient(180deg, ${theme.skyTop} 0%, ${theme.skyBottom} 62%, ${theme.fog} 100%)` }}
    >
      <Suspense fallback={null}>
        <fog attach="fog" args={[theme.fog, theme.fogNear, theme.fogFar]} />
        <ambientLight intensity={theme.ambient} color={theme.ambientColor} />
        <directionalLight
          position={[45, 65, -25]}
          intensity={theme.sunIntensity}
          color={theme.sun}
          castShadow
          shadow-mapSize={[1536, 1536]}
          shadow-camera-left={-140}
          shadow-camera-right={140}
          shadow-camera-top={140}
          shadow-camera-bottom={-140}
          shadow-camera-far={520}
          shadow-bias={-0.0008}
        />
        <hemisphereLight args={[theme.hemiSky, theme.hemiGround, 0.85]} />
        <Scene controls={controls} />
        {bloomOn && <PostFX intensity={theme.bloom} />}
      </Suspense>
    </Canvas>
  );
}
