import { useGame } from "../store";
import { graphicsProfile } from "../graphics";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { previewDistance } from "../modelDetail";
import { visibleModelBounds } from "./previewBounds";
import Vehicle, { type KartVisualState, type VehicleConfig } from "./Vehicle";
import type { CharacterDef, ThemeDef, VehicleMode } from "../data";

function Spinner({
  character,
  vehicle,
  theme,
  mode,
}: {
  character: CharacterDef;
  vehicle: VehicleConfig;
  theme: ThemeDef;
  mode: VehicleMode;
}) {
  const ref = useRef<THREE.Group>(null);
  const size = useThree((s) => s.size);
  const fit = useRef(3);
  const bounds = useMemo(() => new THREE.Box3(), []);
  const center = useMemo(() => new THREE.Vector3(), []);
  const half = useMemo(() => new THREE.Vector3(), []);
  const direction = useMemo(() => new THREE.Vector3(3.4, 2.3, 5.6).normalize(), []);
  useEffect(() => { fit.current = 3; }, [character, vehicle, mode, size.width, size.height]);
  const visual = useRef<KartVisualState>({
    boosting: true,
    shielded: false,
    steer: 0,
    speedFrac: 0.6,
    stunned: false,
    mode: "land",
    drift: false,
  });
  useFrame((state, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.75;
    visual.current.boosting = Math.sin(state.clock.elapsedTime * 2) > -0.4;
    visual.current.mode = mode;
    if (ref.current && fit.current > 0 && --fit.current === 0) {
      visibleModelBounds(ref.current, bounds);
      if (!bounds.isEmpty()) {
        bounds.getCenter(center); bounds.getSize(half).multiplyScalar(0.5);
        const radius = Math.hypot(half.x + Math.abs(center.x), half.y, half.z + Math.abs(center.z));
        center.set(0, center.y, 0);
        const camera = state.camera as THREE.PerspectiveCamera;
        camera.position.copy(center).addScaledVector(direction, previewDistance(radius, camera.fov, size.width / Math.max(1, size.height)));
        camera.lookAt(center); camera.updateProjectionMatrix();
      }
    }
  });
  return (
    <group ref={ref} position={[0, mode === "sub" ? -0.1 : -0.55, 0]}>
      <Vehicle character={character} vehicle={vehicle} stateRef={visual} scale={1.4} isPlayer glow={theme.glow} />
    </group>
  );
}

export default function CharacterPreview({
  character,
  vehicle,
  theme,
  mode = "land",
}: {
  character: CharacterDef;
  vehicle: VehicleConfig;
  theme: ThemeDef;
  mode?: VehicleMode;
}) {
  const quality = useGame((s) => s.settings.graphicsQuality);
  const profile = graphicsProfile(quality);
  return (
    <Canvas
      key={quality}
      gl={{ antialias: profile.antialias, powerPreference: "high-performance" }}
      camera={{ position: [3.4, 2.3, 5.6], fov: 42 }}
      dpr={[0.65, Math.min(1.6, profile.maxDpr)]}
      style={{ background: `linear-gradient(160deg, ${theme.skyTop}, ${theme.skyBottom} 60%, ${theme.ground})`, borderRadius: 24 }}
    >
      <ambientLight intensity={1} color={theme.ambientColor} />
      <directionalLight position={[4, 6, 3]} intensity={theme.sunIntensity} color={theme.sun} />
      <pointLight position={[-3, 2, -3]} intensity={30} color={theme.glow} distance={14} />
      <Spinner character={character} vehicle={vehicle} theme={theme} mode={mode} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.62, 0]}>
        <circleGeometry args={[2.8, 32]} />
        <meshStandardMaterial color={mode === "sub" || mode === "boat" ? theme.water : theme.road} roughness={0.3} metalness={0.2} transparent opacity={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]}>
        <ringGeometry args={[2.8, 3.05, 40]} />
        <meshBasicMaterial color={theme.glow} toneMapped={false} />
      </mesh>
      {mode === "sub" && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1.1, 0]}>
          <circleGeometry args={[3.4, 32]} />
          <meshPhysicalMaterial color={theme.water} transparent opacity={0.28} roughness={0.03} clearcoat={1} depthWrite={false} />
        </mesh>
      )}
    </Canvas>
  );
}
