import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGame } from "../store";
import Vehicle, { type KartVisualState } from "../game/Vehicle";
import { CHARACTERS, THEMES, type ThemeId, type VehicleMode } from "../data";

// ---------------------------------------------------------------------------
// The scene behind a menu: the player's kart on a turntable, in the aesthetic
// they picked, with bubbles drifting up past it and rings turning round it.
// The camera goes slowly round, and every few seconds the kart changes into
// another of its crafts, so the menu shows what the game is about.
// ---------------------------------------------------------------------------

const MODES: VehicleMode[] = ["land", "boat", "plane", "sub", "hover"];

function Sky({ top, bottom }: { top: string; bottom: string }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } },
        vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader:
          "uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y * 0.8 + 0.45, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0); }",
      }),
    [top, bottom],
  );
  return (
    <mesh material={material}>
      <sphereGeometry args={[60, 24, 16]} />
    </mesh>
  );
}

function Bubbles({ tint }: { tint: string }) {
  const N = 40;
  const ref = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(() => Array.from({ length: N }, (_, i) => ({ a: (i * 2.39996) % 6.283, r: 3 + ((i * 7) % 9) * 0.9, s: 0.08 + ((i * 13) % 7) * 0.05, v: 0.3 + ((i * 5) % 6) * 0.12, y: ((i * 11) % 14) - 4 })), []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    seeds.forEach((b, i) => {
      const y = ((b.y + t * b.v + 4) % 14) - 4;
      const a = b.a + t * 0.05;
      m.makeScale(b.s, b.s, b.s).setPosition(Math.cos(a) * b.r + Math.sin(t + i) * 0.2, y, Math.sin(a) * b.r);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} frustumCulled={false}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshPhysicalMaterial color="#ffffff" emissive={tint} emissiveIntensity={0.25} transparent opacity={0.45} roughness={0.05} clearcoat={1} />
    </instancedMesh>
  );
}

function Stage({ themeId }: { themeId: ThemeId }) {
  const theme = THEMES[themeId];
  const characterId = useGame((s) => s.characterId);
  const vehicle = useGame((s) => s.vehicle);
  const char = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0];
  const kart = useRef<THREE.Group>(null);
  const table = useRef<THREE.Group>(null);
  const rings = useRef<THREE.Group>(null);
  const visual = useRef<KartVisualState>({ boosting: false, shielded: false, steer: 0, speedFrac: 0.6, stunned: false, mode: "land", drift: false });

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    // round the kart, slowly, a little above it
    const a = t * 0.12;
    state.camera.position.set(Math.sin(a) * 7.2, 2.6 + Math.sin(t * 0.3) * 0.4, Math.cos(a) * 7.2);
    state.camera.lookAt(0, 0.6, 0);
    // on a wide screen the menu sits in the middle: put the kart beside it
    const cam = state.camera as THREE.PerspectiveCamera;
    const { width, height } = state.size;
    const shift = width >= 1100 ? -Math.round(width * 0.24) : 0;
    if (cam.view?.offsetX !== shift || cam.view?.fullWidth !== width || cam.view?.fullHeight !== height) {
      if (shift) cam.setViewOffset(width, height, shift, 0, width, height);
      else cam.clearViewOffset();
    }
    if (table.current) table.current.rotation.y += dt * 0.35;
    if (kart.current) kart.current.position.y = 0.55 + Math.sin(t * 1.6) * 0.08;
    if (rings.current) {
      rings.current.children.forEach((ring, i) => {
        ring.rotation.x = 1.2 + Math.sin(t * 0.4 + i) * 0.25;
        ring.rotation.z = t * (0.2 + i * 0.07) * (i % 2 ? -1 : 1);
      });
    }
    const v = visual.current;
    v.mode = MODES[Math.floor(t / 6) % MODES.length];
    v.boosting = Math.sin(t * 2.1) > 0.3;
    v.steer = Math.sin(t * 0.9) * 0.4;
  });

  return (
    <>
      <Sky top={theme.skyTop} bottom={theme.skyBottom} />
      <fog attach="fog" args={[theme.fog, 14, 45]} />
      <ambientLight intensity={1.0} color={theme.ambientColor} />
      <hemisphereLight args={[theme.hemiSky, theme.hemiGround, 0.6]} />
      <directionalLight position={[5, 8, 4]} intensity={theme.sunIntensity} color={theme.sun} />
      <pointLight position={[-3, 2, -3]} intensity={30} color={theme.glow} distance={14} />
      <group ref={table}>
        <mesh position={[0, -0.15, 0]} receiveShadow>
          <cylinderGeometry args={[2.6, 2.9, 0.3, 48]} />
          <meshPhysicalMaterial color={theme.road} roughness={0.15} metalness={0.2} clearcoat={1} />
        </mesh>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.35, 2.55, 64]} />
          <meshBasicMaterial color={theme.glow} toneMapped={false} />
        </mesh>
        {Array.from({ length: 12 }, (_, i) => (
          <mesh key={i} position={[Math.cos((i / 12) * 6.283) * 2.75, -0.1, Math.sin((i / 12) * 6.283) * 2.75]}>
            <sphereGeometry args={[0.07, 8, 6]} />
            <meshBasicMaterial color={i % 2 ? theme.barrierA : theme.barrierB} toneMapped={false} />
          </mesh>
        ))}
        <group ref={kart} position={[0, 0.55, 0]}>
          <Vehicle character={char} vehicle={vehicle} stateRef={visual} scale={1.35} isPlayer glow={theme.glow} />
        </group>
      </group>
      <group ref={rings}>
        {[3.6, 4.4, 5.3].map((r, i) => (
          <mesh key={r} position={[0, 0.8, 0]}>
            <torusGeometry args={[r, 0.025 + i * 0.01, 8, 96]} />
            <meshBasicMaterial color={i === 1 ? theme.barrierA : theme.glow} transparent opacity={0.55} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <Bubbles tint={theme.glow} />
      <mesh position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[30, 48]} />
        <meshStandardMaterial color={theme.ground} roughness={0.9} />
      </mesh>
    </>
  );
}

/** Full-screen 3D scene to sit behind a menu. */
export default function MenuStage({ themeId }: { themeId: ThemeId }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <Canvas camera={{ position: [0, 2.6, 7.2], fov: 46 }} dpr={[1, 1.25]} gl={{ antialias: true, powerPreference: "low-power" }}>
        <Stage themeId={themeId} />
      </Canvas>
    </div>
  );
}
