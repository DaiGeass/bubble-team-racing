import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BoatId, CharacterDef, PlaneId, ShapeId, SubId, VehicleMode } from "../data";
import type { KartVisualState } from "./Vehicle";

interface C {
  body: string;
  decal: string;
  glow?: string;
}

function Glass({ color = "#eaf9ff", opacity = 0.32 }: { color?: string; opacity?: number }) {
  return (
    <meshPhysicalMaterial
      color={color}
      transparent
      opacity={opacity}
      roughness={0.02}
      metalness={0.1}
      clearcoat={1}
      iridescence={0.9}
      iridescenceIOR={1.7}
      depthWrite={false}
    />
  );
}

function Neon({ color, i = 2.6 }: { color: string; i?: number }) {
  return <meshStandardMaterial color={color} emissive={color} emissiveIntensity={i} toneMapped={false} />;
}

function Paint({ color, metal = 0.6, rough = 0.12 }: { color: string; metal?: number; rough?: number }) {
  return <meshStandardMaterial color={color} roughness={rough} metalness={metal} />;
}

/** Rocket dragster: long glass-nosed speed machine with side fins. */
export function RocketChassis({ body, decal, glow }: C) {
  const g = glow ?? "#7de1ff";
  return (
    <group>
      <mesh position={[0, 0.45, -0.15]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.72]} castShadow>
        <capsuleGeometry args={[0.55, 2.4, 8, 16]} />
        <Paint color={body} metal={0.75} rough={0.08} />
      </mesh>
      <mesh position={[0, 0.45, 1.85]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.5, 1.4, 14]} />
        <Glass opacity={0.42} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 1.15, 0.5, -0.9]} rotation={[0, 0, s * 1.35]}>
            <boxGeometry args={[1.15, 0.08, 0.75]} />
            <Paint color={decal} metal={0.4} />
          </mesh>
          <mesh position={[s * 1.55, 0.62, -1.0]}>
            <boxGeometry args={[0.08, 0.55, 0.5]} />
            <Neon color={g} i={2.2} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.72, -1.15]}>
        <boxGeometry args={[1.35, 0.08, 0.6]} />
        <Paint color={decal} metal={0.5} />
      </mesh>
      {[-0.35, 0, 0.35].map((x) => (
        <mesh key={x} position={[x, 0.45, -1.7]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.16, 0.22, 0.35, 10]} />
          <Neon color="#ffffff" i={3} />
        </mesh>
      ))}
      <mesh position={[0, 0.22, -0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.15, 2.7]} />
        <meshBasicMaterial color={g} transparent opacity={0.45} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Glass yacht: sleek white hull with a transparent bubble lounge. */
export function YachtBoat({ body, decal, glow }: C) {
  const g = glow ?? "#4fd8e8";
  return (
    <group>
      <mesh position={[0, -0.05, 0.15]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.45, 0.6]} castShadow>
        <capsuleGeometry args={[0.95, 2.6, 8, 18]} />
        <meshStandardMaterial color="#ffffff" roughness={0.08} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0.16, 0.15]} rotation={[Math.PI / 2, 0, 0]} scale={[0.97, 1.42, 0.4]}>
        <capsuleGeometry args={[0.95, 2.6, 8, 18]} />
        <Paint color={body} metal={0.4} />
      </mesh>
      <mesh position={[0, 0.75, -0.3]}>
        <boxGeometry args={[1.25, 0.1, 1.5]} />
        <meshStandardMaterial color="#ffffff" roughness={0.12} />
      </mesh>
      <mesh position={[0, 1.15, -0.15]} scale={[1, 0.62, 1.25]}>
        <sphereGeometry args={[0.8, 22, 16]} />
        <Glass opacity={0.3} />
      </mesh>
      <mesh position={[0, 1.75, -0.5]}>
        <boxGeometry args={[1.15, 0.08, 0.5]} />
        <Paint color={decal} metal={0.3} />
      </mesh>
      <mesh position={[0, 1.55, -0.6]}>
        <cylinderGeometry args={[0.045, 0.045, 0.75, 6]} />
        <Paint color={decal} />
      </mesh>
      <mesh position={[0, 0.55, 1.65]} rotation={[0.65, 0, 0]}>
        <boxGeometry args={[1.1, 0.5, 0.05]} />
        <Glass />
      </mesh>
      <mesh position={[0, 0.3, 2.1]} rotation={[0.85, 0, 0]}>
        <coneGeometry args={[0.32, 0.75, 4]} />
        <meshStandardMaterial color="#ffffff" roughness={0.15} />
      </mesh>
      {[-1.18, 1.18].map((x) => (
        <mesh key={x} position={[x, 0.32, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.13, 2.4, 4, 10]} />
          <Neon color={g} i={2.2} />
        </mesh>
      ))}
    </group>
  );
}

/** Stealth jet: faceted dark glass delta with glowing edge strips. */
export function StealthPlane({ body, decal, glow }: C) {
  const g = glow ?? "#7dffea";
  const shape = new THREE.Shape();
  shape.moveTo(0, 2.0);
  shape.lineTo(-1.35, -0.4);
  shape.lineTo(-0.85, -1.5);
  shape.lineTo(0, -1.1);
  shape.lineTo(0.85, -1.5);
  shape.lineTo(1.35, -0.4);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.05, bevelSegments: 2 });
  return (
    <group>
      <mesh geometry={geo} position={[0, 0.62, -0.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <meshStandardMaterial color={body} roughness={0.22} metalness={0.85} flatShading />
      </mesh>
      <mesh position={[0, 0.92, 0.25]} scale={[0.42, 0.24, 1.15]}>
        <sphereGeometry args={[0.75, 14, 12]} />
        <Glass color="#bff4ff" opacity={0.4} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 1.05, 0.72, -1.15]} rotation={[0, 0, s * 0.28]}>
            <boxGeometry args={[0.09, 0.85, 0.7]} />
            <Paint color={body} metal={0.85} />
          </mesh>
          <mesh position={[s * 1.28, 0.66, -0.55]} rotation={[0, 0, s * 0.12]}>
            <boxGeometry args={[0.07, 0.06, 1.9]} />
            <Neon color={g} i={2.8} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.62, -1.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.36, 0.5, 12]} />
        <Neon color={decal} i={2.6} />
      </mesh>
    </group>
  );
}

/** Diver pod: two-seater glass sphere with articulated arms and big headlights. */
export function DiverSub({ body, decal, glow }: C) {
  const g = glow ?? "#7de1ff";
  const arm = useRef<THREE.Group>(null);
  const prop = useRef<THREE.Group>(null);
  useFrame((s, dt) => {
    if (arm.current) arm.current.rotation.x = Math.sin(s.clock.elapsedTime * 1.6) * 0.5;
    if (prop.current) prop.current.rotation.z += dt * 22;
  });
  return (
    <group>
      <mesh position={[0, 0.62, 0.1]} scale={[1, 0.95, 1.15]}>
        <sphereGeometry args={[1.05, 24, 18]} />
        <Glass color="#d8f7ff" opacity={0.3} />
      </mesh>
      <mesh position={[0, 0.62, 0.1]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.15, 1]}>
        <torusGeometry args={[1.02, 0.11, 10, 30]} />
        <Paint color={body} />
      </mesh>
      <mesh position={[0, 1.72, 0.1]}>
        <sphereGeometry args={[0.12, 10, 10]} />
        <Neon color={g} i={3} />
      </mesh>
      <mesh position={[0, 1.42, 0.1]}>
        <cylinderGeometry args={[0.035, 0.035, 0.5, 6]} />
        <Paint color={decal} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 1.02, 0.55, 1.15]}>
            <sphereGeometry args={[0.2, 12, 12]} />
            <Neon color="#ffffff" i={3} />
          </mesh>
          <mesh position={[s * 1.0, 0.55, 1.3]} scale={[1, 1, 0.5]}>
            <sphereGeometry args={[0.26, 12, 12]} />
            <Glass />
          </mesh>
          <group ref={s === 1 ? arm : undefined} position={[s * 1.15, 0.15, -0.1]}>
            <mesh position={[s * 0.28, -0.15, 0.35]} rotation={[0.5, 0, s * 0.6]}>
              <capsuleGeometry args={[0.075, 0.62, 4, 8]} />
              <Paint color={decal} metal={0.5} />
            </mesh>
            <mesh position={[s * 0.52, -0.38, 0.72]} rotation={[0.9, 0, s * 0.35]}>
              <capsuleGeometry args={[0.065, 0.5, 4, 8]} />
              <Paint color={decal} metal={0.5} />
            </mesh>
          </group>
        </group>
      ))}
      <group ref={prop} position={[0, 0.62, -1.55]}>
        {[0, 1, 2].map((k) => (
          <mesh key={k} rotation={[0, 0, (k * Math.PI * 2) / 3]}>
            <boxGeometry args={[0.11, 0.75, 0.05]} />
            <Paint color="#cbd5e1" metal={0.85} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0.62, -1.35]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.32, 0.36, 0.35, 12]} />
        <Paint color={body} />
      </mesh>
      <mesh position={[0, 0.28, -1.3]}>
        <boxGeometry args={[1.35, 0.07, 0.5]} />
        <Neon color={decal} i={2} />
      </mesh>
    </group>
  );
}

/** Renders the newest models and hides itself when a legacy model is selected. */
export function ModeModels({
  vehicle,
  stateRef,
  glow,
}: {
  vehicle: { body: string; decal: string; shape: ShapeId; boat?: BoatId; plane?: PlaneId; sub?: SubId };
  stateRef?: React.MutableRefObject<KartVisualState>;
  glow?: string;
}) {
  const landRef = useRef<THREE.Group>(null);
  const boatRef = useRef<THREE.Group>(null);
  const planeRef = useRef<THREE.Group>(null);
  const subRef = useRef<THREE.Group>(null);
  useFrame(() => {
    const mode: VehicleMode = stateRef?.current.mode ?? "land";
    if (landRef.current) landRef.current.visible = mode === "land" && vehicle.shape === "rocket";
    if (boatRef.current) boatRef.current.visible = mode === "boat" && vehicle.boat === "yacht";
    if (planeRef.current) planeRef.current.visible = mode === "plane" && vehicle.plane === "stealth";
    if (subRef.current) subRef.current.visible = mode === "sub" && vehicle.sub === "diver";
  });
  return (
    <>
      <group ref={landRef} visible={false}>
        <RocketChassis body={vehicle.body} decal={vehicle.decal} glow={glow} />
      </group>
      <group ref={boatRef} visible={false}>
        <YachtBoat body={vehicle.body} decal={vehicle.decal} glow={glow} />
      </group>
      <group ref={planeRef} visible={false}>
        <StealthPlane body={vehicle.body} decal={vehicle.decal} glow={glow} />
      </group>
      <group ref={subRef} visible={false}>
        <DiverSub body={vehicle.body} decal={vehicle.decal} glow={glow} />
      </group>
    </>
  );
}

export function PilotAnchor({ char }: { char: CharacterDef }) {
  return <>{char.name}</>;
}
