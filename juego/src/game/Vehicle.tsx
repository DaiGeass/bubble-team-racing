import Craft4 from "./Models4";
import { NEW_CRAFT, type NewCraftId } from "../craftModels";
import VehicleDetails from "./VehicleDetails";
import { characterPhase, eyeOpen } from "../modelDetail";
import { Paint } from "./Models";
import { createWheelResources, hasRoadWheels } from "./wheelResources";
import { VehicleMotion } from "./vehicleMotion";
import { VehicleEffects } from "./vehicleEffects";
import { useLayoutEffect, useMemo, useRef } from "react";
import { frameBlend } from "../motion";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BoatId, BoosterId, CharacterDef, FinishId, PlaneId, ShapeId, SpoilerId, SubId, VehicleMode, WheelStyle } from "../data";
import { BoatAlt, ExtraShapes, PlaneAlt, SubModel } from "./Models";
import { ModeModels } from "./Models2";
import { Boat3, Hover3, Land3, Plane3, Sub3, SUB3 } from "./Models3";

export interface KartVisualState {
  boosting: boolean;
  shielded: boolean;
  steer: number;
  speedFrac: number;
  speed?: number;
  airborne?: boolean;
  vy?: number;
  stunned: boolean;
  mode: VehicleMode;
  drift: boolean;
  activeIsPartner?: boolean;
  fused?: boolean;
  ghost?: boolean;
  magnet?: boolean;
  /** riding on another kart as its gunner: shows the barrel */
  gunning?: boolean;
  /** where the kart's own turret points, relative to the nose */
  turretAim?: number;
  exploding?: boolean;
}

export interface VehicleConfig {
  body: string;
  decal: string;
  wheel: WheelStyle;
  shape: ShapeId;
  finish?: FinishId;
  spoiler?: SpoilerId;
  booster?: BoosterId;
  boat?: BoatId;
  plane?: PlaneId;
  sub?: SubId;
  hover?: import("../data").HoverId;
}

interface Props {
  character: CharacterDef;
  partner?: CharacterDef | null;
  vehicle: VehicleConfig;
  stateRef?: React.MutableRefObject<KartVisualState>;
  scale?: number;
  isPlayer?: boolean;
  glow?: string;
}

/** Shared kawaii face used by every Frutiger life-form. */
function Face({ char, glow, eyes, z = 0.3, y = 0 }: { char: CharacterDef; glow?: string; eyes: React.RefObject<THREE.Group | null>; z?: number; y?: number }) {
  return (
    <group position={[0, y, z]}>
      <group ref={eyes}>
      {char.eye === "visor" ? (
        <mesh position={[0, 0.06, 0.02]}>
          <boxGeometry args={[0.42, 0.13, 0.08]} />
          <meshStandardMaterial color="#0b1020" emissive={glow ?? char.accent} emissiveIntensity={2.4} toneMapped={false} />
        </mesh>
      ) : char.eye === "sleepy" ? (
        <>
          <mesh position={[-0.12, 0.06, 0.02]} rotation={[0, 0, 0.3]}>
            <boxGeometry args={[0.15, 0.04, 0.04]} />
            <meshStandardMaterial color="#1d2233" />
          </mesh>
          <mesh position={[0.12, 0.06, 0.02]} rotation={[0, 0, -0.3]}>
            <boxGeometry args={[0.15, 0.04, 0.04]} />
            <meshStandardMaterial color="#1d2233" />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[-0.12, 0.07, 0]} scale={[1, 1.3, 0.55]}>
            <sphereGeometry args={[0.085, 12, 12]} />
            <meshStandardMaterial color="#ffffff" roughness={0.15} />
          </mesh>
          <mesh position={[0.12, 0.07, 0]} scale={[1, 1.3, 0.55]}>
            <sphereGeometry args={[0.085, 12, 12]} />
            <meshStandardMaterial color="#ffffff" roughness={0.15} />
          </mesh>
          <mesh position={[-0.115, 0.06, 0.05]}>
            <sphereGeometry args={[char.eye === "sharp" ? 0.05 : 0.058, 10, 10]} />
            <meshStandardMaterial color="#1d2233" roughness={0.1} />
          </mesh>
          <mesh position={[0.125, 0.06, 0.05]}>
            <sphereGeometry args={[char.eye === "sharp" ? 0.05 : 0.058, 10, 10]} />
            <meshStandardMaterial color="#1d2233" roughness={0.1} />
          </mesh>
          <mesh position={[-0.095, 0.09, 0.09]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.2} toneMapped={false} />
          </mesh>
          <mesh position={[0.145, 0.09, 0.09]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.2} toneMapped={false} />
          </mesh>
        </>
      )}
      </group>
      {/* smile */}
      <mesh position={[0, -0.09, 0.02]} rotation={[0.3, 0, 0]}>
        <torusGeometry args={[0.07, 0.016, 6, 10, Math.PI]} />
        <meshStandardMaterial color={char.accent} roughness={0.3} />
      </mesh>
      {/* blush */}
      <mesh position={[-0.21, -0.04, -0.02]} scale={[1, 0.6, 0.4]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#ff8fbf" roughness={0.6} transparent opacity={0.75} />
      </mesh>
      <mesh position={[0.21, -0.04, -0.02]} scale={[1, 0.6, 0.4]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#ff8fbf" roughness={0.6} transparent opacity={0.75} />
      </mesh>
    </group>
  );
}

/** Frutiger Aero life-form pilot: droplet, bubble, leaf, crystal, holo, cloud, star or flame. */
function Pilot({ char, glow, gunner, stateRef }: { char: CharacterDef; glow?: string; gunner?: boolean; stateRef?: React.MutableRefObject<KartVisualState> }) {
  const personality = useMemo(() => characterPhase(char.id), [char.id]);
  const bob = useRef(personality * 6);
  const eyes = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);
  const aura = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (!root.current?.parent?.visible || !root.current.parent.parent?.visible) return;
    bob.current += Math.min(dt, 0.1);
    if (eyes.current) {
      eyes.current.scale.y = eyeOpen(bob.current, personality, !!stateRef?.current.stunned);
      eyes.current.position.x = (stateRef?.current.steer ?? 0) * 0.02;
    }
    if (root.current) {
      root.current.position.y = 0.78 + Math.sin(bob.current * 3.4) * 0.05;
      root.current.rotation.z = Math.sin(bob.current * 2.1) * 0.06;
      if (char.form === "holo") root.current.rotation.y = Math.sin(bob.current * 1.4) * 0.22;
    }
    if (aura.current) {
      const s = 1 + Math.sin(bob.current * 5) * 0.07;
      aura.current.scale.setScalar(s);
    }
  });

  // glossy "liquid glass" main material
  const glassy = (color: string, opacity = 1, emissive = "#000000", ei = 0) => (
    <meshPhysicalMaterial
      color={color}
      roughness={0.02}
      metalness={0.08}
      clearcoat={1}
      clearcoatRoughness={0.02}
      iridescence={1}
      iridescenceIOR={1.75}
      iridescenceThicknessRange={[120, 760]}
      sheen={1}
      sheenColor={"#ffffff"}
      specularIntensity={1}
      transmission={opacity < 1 ? 0.35 : 0}
      thickness={0.8}
      transparent={opacity < 1}
      opacity={opacity}
      emissive={emissive === "#000000" ? color : emissive}
      emissiveIntensity={ei === 0 ? 0.28 : ei}
      toneMapped={false}
    />
  );

  return (
    <group position={[0, gunner ? 0.2 : 0.3, gunner ? 0 : -0.15]} scale={gunner ? 0.85 : 1}>
      <group ref={root} position={[0, 0.78, 0]}>
        {!gunner && [-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.27, -0.25, 0.43]} scale={[1, 0.8, 1.2]}>
            <sphereGeometry args={[0.085, 8, 6]} />
            <meshStandardMaterial color={char.secondary} roughness={0.3} metalness={0.1} />
          </mesh>
        ))}
        {/* inner luminous core + soft halo makes every life-form glow like wet glass */}
        <mesh scale={0.34}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshBasicMaterial color={char.secondary} toneMapped={false} transparent opacity={0.9} />
        </mesh>
        <mesh scale={0.72}>
          <sphereGeometry args={[1, 14, 14]} />
          <meshBasicMaterial color={char.primary} toneMapped={false} transparent opacity={0.18} depthWrite={false} />
        </mesh>
        {char.form === "drop" && (
          <group>
            <mesh castShadow scale={[1, 1.12, 1]}>
              <sphereGeometry args={[0.42, 20, 20]} />
              {glassy(char.primary, 0.94)}
            </mesh>
            <mesh position={[0, 0.5, 0]} scale={[0.5, 1, 0.5]}>
              <coneGeometry args={[0.3, 0.5, 12]} />
              {glassy(char.primary, 0.94)}
            </mesh>
            {/* inner shine bubble */}
            <mesh position={[-0.14, 0.18, 0.18]}>
              <sphereGeometry args={[0.09, 10, 10]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.85} toneMapped={false} />
            </mesh>
            <Face char={char} glow={glow} eyes={eyes} z={0.36} />
          </group>
        )}
        {char.form === "bubble" && (
          <group>
            <mesh castShadow>
              <sphereGeometry args={[0.46, 20, 20]} />
              {glassy(char.primary, 0.38)}
            </mesh>
            <mesh>
              <sphereGeometry args={[0.26, 16, 16]} />
              {glassy(char.secondary, 0.95)}
            </mesh>
            <mesh position={[-0.17, 0.2, 0.2]} scale={[1, 0.6, 0.6]}>
              <sphereGeometry args={[0.11, 10, 10]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.9} toneMapped={false} />
            </mesh>
            {/* orbiting micro-bubbles */}
            <mesh position={[0.38, 0.28, -0.1]}>
              <sphereGeometry args={[0.07, 8, 8]} />
              {glassy(char.primary, 0.5)}
            </mesh>
            <mesh position={[-0.4, -0.12, 0.08]}>
              <sphereGeometry args={[0.055, 8, 8]} />
              {glassy(char.primary, 0.5)}
            </mesh>
            <Face char={char} glow={glow} eyes={eyes} z={0.3} />
          </group>
        )}
        {char.form === "leaf" && (
          <group>
            <mesh castShadow scale={[0.95, 1.1, 0.75]}>
              <sphereGeometry args={[0.42, 18, 18]} />
              {glassy(char.primary)}
            </mesh>
            {/* sprout stem + leaves */}
            <mesh position={[0, 0.52, 0]} rotation={[0, 0, 0.15]}>
              <cylinderGeometry args={[0.03, 0.045, 0.28, 6]} />
              <meshStandardMaterial color={char.accent} roughness={0.5} />
            </mesh>
            <mesh position={[-0.12, 0.68, 0]} rotation={[0, 0, 0.9]} scale={[1, 0.45, 0.2]}>
              <sphereGeometry args={[0.18, 10, 10]} />
              {glassy(char.primary)}
            </mesh>
            <mesh position={[0.12, 0.68, 0]} rotation={[0, 0, -0.9]} scale={[1, 0.45, 0.2]}>
              <sphereGeometry args={[0.18, 10, 10]} />
              {glassy(char.secondary)}
            </mesh>
            <Face char={char} glow={glow} eyes={eyes} z={0.33} />
          </group>
        )}
        {char.form === "crystal" && (
          <group>
            <mesh castShadow>
              <octahedronGeometry args={[0.48, 0]} />
              <meshPhysicalMaterial
                color={char.primary}
                roughness={0.05}
                metalness={0.25}
                clearcoat={1}
                flatShading
                emissive={char.accent}
                emissiveIntensity={0.35}
                transparent
                opacity={0.95}
              />
            </mesh>
            <mesh rotation={[0, Math.PI / 4, 0]} scale={0.62}>
              <octahedronGeometry args={[0.48, 0]} />
              <meshBasicMaterial color={char.secondary} transparent opacity={0.5} toneMapped={false} />
            </mesh>
            <Face char={char} glow={glow} eyes={eyes} z={0.3} y={0.02} />
          </group>
        )}
        {char.form === "holo" && (
          <group>
            <mesh castShadow>
              <boxGeometry args={[0.6, 0.6, 0.6]} />
              {glassy(char.primary, 0.55, char.accent, 0.4)}
            </mesh>
            <mesh scale={1.04}>
              <boxGeometry args={[0.6, 0.6, 0.6]} />
              <meshBasicMaterial color={glow ?? char.secondary} wireframe transparent opacity={0.8} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0.46, 0]}>
              <sphereGeometry args={[0.07, 8, 8]} />
              <meshStandardMaterial color={glow ?? "#7dffea"} emissive={glow ?? "#7dffea"} emissiveIntensity={3} toneMapped={false} />
            </mesh>
            <Face char={char} glow={glow} eyes={eyes} z={0.32} />
          </group>
        )}
        {char.form === "cloud" && (
          <group>
            <mesh castShadow scale={[1.15, 0.9, 0.95]}>
              <sphereGeometry args={[0.4, 16, 16]} />
              {glassy(char.primary)}
            </mesh>
            <mesh position={[-0.32, 0.12, 0]} scale={0.6}>
              <sphereGeometry args={[0.4, 14, 14]} />
              {glassy(char.secondary)}
            </mesh>
            <mesh position={[0.32, 0.14, 0]} scale={0.68}>
              <sphereGeometry args={[0.4, 14, 14]} />
              {glassy(char.secondary)}
            </mesh>
            <mesh position={[0, 0.3, -0.05]} scale={0.56}>
              <sphereGeometry args={[0.4, 14, 14]} />
              {glassy(char.primary)}
            </mesh>
            <Face char={char} glow={glow} eyes={eyes} z={0.38} />
          </group>
        )}
        {char.form === "star" && (
          <group>
            <mesh castShadow>
              <sphereGeometry args={[0.38, 18, 18]} />
              {glassy(char.primary, 1, char.primary, 0.3)}
            </mesh>
            {/* 5 glossy points */}
            {[
              [0, 0.52, 0, 0, 0, 0],
              [-0.48, 0.18, 0, 0, 0, 1.15],
              [0.48, 0.18, 0, 0, 0, -1.15],
              [-0.32, -0.42, 0, 0, 0, 2.5],
              [0.32, -0.42, 0, 0, 0, -2.5],
            ].map((p, i) => (
              <mesh key={i} position={[p[0], p[1], p[2]]} rotation={[p[3], p[4], p[5]]}>
                <coneGeometry args={[0.13, 0.34, 8]} />
                {glassy(char.secondary, 1, char.primary, 0.5)}
              </mesh>
            ))}
            <Face char={char} glow={glow} eyes={eyes} z={0.32} />
          </group>
        )}
        {char.form === "flame" && (
          <group>
            <mesh ref={aura}>
              <sphereGeometry args={[0.5, 14, 14]} />
              <meshBasicMaterial color={char.primary} transparent opacity={0.25} toneMapped={false} />
            </mesh>
            <mesh castShadow scale={[1, 1.15, 1]}>
              <sphereGeometry args={[0.38, 18, 18]} />
              {glassy(char.primary, 1, char.primary, 0.7)}
            </mesh>
            <mesh position={[0, 0.48, 0]} rotation={[0, 0, 0.2]} scale={[0.6, 1, 0.6]}>
              <coneGeometry args={[0.26, 0.5, 10]} />
              {glassy(char.secondary, 0.9, char.primary, 0.9)}
            </mesh>
            <Face char={char} glow={glow} eyes={eyes} z={0.33} />
          </group>
        )}
      </group>
    </group>
  );
}

function Spoiler({ kind, decal, glow, finish }: { kind: SpoilerId; decal: string; glow?: string; finish?: FinishId }) {
  if (kind === "none") return null;
  if (kind === "wing")
    return (
      <group position={[0, 0.95, -1.05]}>
        <mesh>
          <boxGeometry args={[1.5, 0.08, 0.4]} />
          <Paint color={decal} rough={0.2} metal={0.5} finish={finish} />
        </mesh>
        <mesh position={[-0.6, -0.18, 0]}>
          <boxGeometry args={[0.08, 0.3, 0.3]} />
          <meshStandardMaterial color="#2b2f3a" />
        </mesh>
        <mesh position={[0.6, -0.18, 0]}>
          <boxGeometry args={[0.08, 0.3, 0.3]} />
          <meshStandardMaterial color="#2b2f3a" />
        </mesh>
      </group>
    );
  return (
    <mesh position={[0, 0.95, -1.0]} rotation={[0.25, 0, 0]}>
      <coneGeometry args={[0.3, 0.9, 4]} />
      <meshStandardMaterial color={decal} emissive={glow ?? decal} emissiveIntensity={1.2} toneMapped={false} />
    </mesh>
  );
}

function Boosters({ kind, glow }: { kind: BoosterId; glow?: string }) {
  const g = glow ?? "#7de1ff";
  if (kind === "twin")
    return (
      <>
        <mesh position={[-0.42, 0.5, -1.15]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.16, 0.2, 0.5, 10]} />
          <meshStandardMaterial color="#2b2f3a" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0.42, 0.5, -1.15]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.16, 0.2, 0.5, 10]} />
          <meshStandardMaterial color="#2b2f3a" metalness={0.7} roughness={0.3} />
        </mesh>
      </>
    );
  if (kind === "neon")
    return (
      <mesh position={[0, 0.48, -1.18]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.28, 0.09, 8, 18]} />
        <meshStandardMaterial color={g} emissive={g} emissiveIntensity={2.6} toneMapped={false} />
      </mesh>
    );
  return (
    <mesh position={[0, 0.5, -1.18]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.2, 0.26, 0.5, 12]} />
      <meshStandardMaterial color="#2b2f3a" metalness={0.7} roughness={0.3} />
    </mesh>
  );
}

function Chassis({
  vehicle,
  glow,
  hullRef,
  wingRef,
  wheelRef,
}: {
  vehicle: VehicleConfig;
  glow?: string;
  hullRef: React.MutableRefObject<THREE.Group | null>;
  wingRef: React.MutableRefObject<THREE.Group | null>;
  wheelRef: React.MutableRefObject<THREE.Group | null>;
}) {
  const { body, decal, shape, finish } = vehicle;
  const propRef = useRef<THREE.Mesh>(null);
  const wheels = useMemo(() => hasRoadWheels(vehicle.shape) ? createWheelResources(vehicle.wheel) : null, [vehicle.shape, vehicle.wheel]);
  useLayoutEffect(() => () => wheels?.dispose(), [wheels]);
  useFrame((_, dt) => {
    if (propRef.current && wingRef.current?.visible) propRef.current.rotation.z += dt * 30;
  });

  return (
    <group>
      {shape === "kart" && (
        <>
          <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.2, 0.34, 2.15]} />
            <Paint color={body} rough={0.22} metal={0.4} finish={finish} />
          </mesh>
          <mesh position={[0, 0.62, -0.2]}>
            <boxGeometry args={[1.0, 0.16, 1.2]} />
            <Paint color={decal} rough={0.25} metal={0.25} finish={finish} />
          </mesh>
          <mesh position={[0, 0.4, 1.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <coneGeometry args={[0.58, 0.85, 4]} />
            <Paint color={body} rough={0.22} metal={0.4} finish={finish} />
          </mesh>
          <mesh position={[0, 0.62, 0.62]} rotation={[-0.5, 0, 0]}>
            <boxGeometry args={[0.8, 0.45, 0.06]} />
            <meshStandardMaterial color="#dff6ff" transparent opacity={0.55} roughness={0.05} metalness={0.5} />
          </mesh>
        </>
      )}
      {shape === "hover" && (
        <>
          <mesh position={[0, 0.62, 0]} castShadow>
            <sphereGeometry args={[1.05, 20, 14]} />
            <Paint color={body} rough={0.1} metal={0.65} finish={finish} />
          </mesh>
          <mesh position={[0, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.0, 0.17, 10, 26]} />
            <meshStandardMaterial color={decal} emissive={glow ?? "#7de1ff"} emissiveIntensity={3} toneMapped={false} />
          </mesh>
        </>
      )}
      {shape === "buggy" && (
        <>
          <mesh position={[0, 0.58, 0]} castShadow>
            <boxGeometry args={[1.5, 0.62, 2.2]} />
            <Paint color={body} rough={0.45} metal={0.2} finish={finish} />
          </mesh>
          <mesh position={[0, 1.0, -0.5]} castShadow>
            <boxGeometry args={[1.15, 0.32, 0.95]} />
            <meshStandardMaterial color={decal} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.62, 1.15]}>
            <boxGeometry args={[1.3, 0.2, 0.2]} />
            <meshStandardMaterial color={glow ?? "#ffd166"} emissive={glow ?? "#ffd166"} emissiveIntensity={1.6} toneMapped={false} />
          </mesh>
        </>
      )}
      {shape === "jet" && (
        <>
          <mesh position={[0, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <coneGeometry args={[0.6, 3.0, 12]} />
            <Paint color={body} rough={0.12} metal={0.8} finish={finish} />
          </mesh>
          <mesh position={[0, 0.62, -0.95]}>
            <boxGeometry args={[2.0, 0.09, 0.55]} />
            <meshStandardMaterial color={decal} emissive={glow ?? "#ff3ea5"} emissiveIntensity={1.8} toneMapped={false} />
          </mesh>
        </>
      )}
      {shape === "cruiser" && (
        <>
          <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <capsuleGeometry args={[0.62, 1.6, 6, 14]} />
            <Paint color={body} rough={0.18} metal={0.5} finish={finish} />
          </mesh>
          <mesh position={[0, 0.78, -0.15]}>
            <boxGeometry args={[1.0, 0.14, 1.5]} />
            <Paint color={decal} rough={0.3} metal={0.3} finish={finish} />
          </mesh>
        </>
      )}
      {shape === "moto" && (
        <>
          <mesh position={[0, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <capsuleGeometry args={[0.36, 1.9, 6, 12]} />
            <Paint color={body} rough={0.15} metal={0.6} finish={finish} />
          </mesh>
          <mesh position={[0, 0.85, 0.75]} rotation={[-0.6, 0, 0]}>
            <boxGeometry args={[0.65, 0.4, 0.07]} />
            <meshStandardMaterial color="#dff6ff" transparent opacity={0.55} roughness={0.05} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0.7, -0.85]}>
            <boxGeometry args={[0.5, 0.3, 0.5]} />
            <meshStandardMaterial color={decal} roughness={0.3} />
          </mesh>
        </>
      )}
      {shape === "ufo" && (
        <>
          <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[1.15, 1.15, 0.34, 20]} />
            <Paint color={body} rough={0.1} metal={0.7} finish={finish} />
          </mesh>
          <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.15, 0.12, 10, 26]} />
            <meshStandardMaterial color={decal} emissive={glow ?? "#7de1ff"} emissiveIntensity={2.6} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.78, 0]}>
            <sphereGeometry args={[0.55, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#dff6ff" transparent opacity={0.4} roughness={0.05} metalness={0.5} />
          </mesh>
        </>
      )}

      <ExtraShapes shape={shape} body={body} decal={decal} glow={glow} finish={finish} />
      {(NEW_CRAFT.land as readonly string[]).includes(shape) && <Craft4 kind={shape as NewCraftId} body={body} decal={decal} glow={glow} finish={finish} />}
      <Land3 shape={shape} body={body} decal={decal} glow={glow} finish={finish} />
      <Spoiler kind={vehicle.spoiler ?? "none"} decal={decal} glow={glow} finish={finish} />
      <Boosters kind={vehicle.booster ?? "single"} glow={glow} />

      {/* boat hull */}
      {(vehicle.boat ?? "cat") === "cat" && <group ref={hullRef} visible={false}>
        <mesh position={[0, 0.02, 0.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <capsuleGeometry args={[0.9, 2.2, 6, 14]} />
          <meshStandardMaterial color="#ffffff" roughness={0.15} metalness={0.25} />
        </mesh>
        <mesh position={[-0.9, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.3, 2.4, 4, 10]} />
          <meshStandardMaterial color={decal} emissive={glow ?? "#4fd8e8"} emissiveIntensity={2} toneMapped={false} />
        </mesh>
        <mesh position={[0.9, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.3, 2.4, 4, 10]} />
          <meshStandardMaterial color={decal} emissive={glow ?? "#4fd8e8"} emissiveIntensity={2} toneMapped={false} />
        </mesh>
        {/* bow wave fin */}
        <mesh position={[0, 0.25, 1.35]} rotation={[0.5, 0, 0]}>
          <coneGeometry args={[0.32, 0.7, 4]} />
          <meshStandardMaterial color="#ffffff" roughness={0.2} />
        </mesh>
      </group>}

      {/* plane wings + propeller */}
      {(vehicle.plane ?? "wing") === "wing" && <group ref={wingRef} visible={false}>
        <mesh position={[0, 0.78, -0.25]} castShadow>
          <boxGeometry args={[3.6, 0.1, 0.8]} />
          <Paint color={decal} rough={0.15} metal={0.55} finish={finish} />
        </mesh>
        <mesh position={[-1.75, 1.05, -0.25]}>
          <boxGeometry args={[0.1, 0.62, 0.5]} />
          <meshStandardMaterial color={body} emissive={glow ?? "#ffd166"} emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
        <mesh position={[1.75, 1.05, -0.25]}>
          <boxGeometry args={[0.1, 0.62, 0.5]} />
          <meshStandardMaterial color={body} emissive={glow ?? "#ffd166"} emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.95, -1.2]}>
          <boxGeometry args={[0.14, 1.05, 0.4]} />
          <Paint color={body} rough={0.25} metal={0.4} finish={finish} />
        </mesh>
        <mesh ref={propRef} position={[0, 0.72, 1.45]}>
          <boxGeometry args={[1.8, 0.08, 0.12]} />
          <meshStandardMaterial color="#eaf6ff" transparent opacity={0.6} toneMapped={false} />
        </mesh>
      </group>}

      {wheels && <group ref={wheelRef} dispose={null}>
        {([-0.72, 0.72, -0.72, 0.72] as const).map((x, i) => (
          <group key={i} position={[x, 0.46, i < 2 ? 0.85 : -0.85]}>
            <group>
              <mesh geometry={wheels.tireGeometry} material={wheels.tireMaterial} rotation={[0, 0, Math.PI / 2]} castShadow />
              <mesh geometry={wheels.rimGeometry} material={wheels.rimMaterial} rotation={[0, 0, Math.PI / 2]} />
            </group>
          </group>
        ))}
      </group>}
    </group>
  );
}

export default function Vehicle({ character, partner, vehicle, stateRef, scale = 1, isPlayer, glow }: Props) {
  const body = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Mesh>(null);
  const shield = useRef<THREE.Mesh>(null);
  const pad = useRef<THREE.Mesh>(null);
  const hullRef = useRef<THREE.Group>(null);
  const wingRef = useRef<THREE.Group>(null);
  const wheelRef = useRef<THREE.Group>(null);
  const boatAltRef = useRef<THREE.Group>(null);
  const planeAltRef = useRef<THREE.Group>(null);
  const subRef = useRef<THREE.Group>(null);
  const hoverRef = useRef<THREE.Group>(null);
  const chassisRef = useRef<THREE.Group>(null);
  const mainPilot = useRef<THREE.Group>(null);
  const altPilot = useRef<THREE.Group>(null);
  const gunnerMain = useRef<THREE.Group>(null);
  const gunnerAlt = useRef<THREE.Group>(null);
  const turret = useRef<THREE.Group>(null);
  const gunBarrel = useRef<THREE.Group>(null);
  const t = useRef(Math.random() * 10);
  const spin = useRef(0);
  const motion = useRef(new VehicleMotion());
  const effects = useRef<VehicleEffects | null>(null);
  const magnetRing = useRef<THREE.Mesh>(null);

  const altChar = useMemo(() => partner ?? null, [partner]);
  useLayoutEffect(() => {
    if (!body.current) return;
    const current = new VehicleEffects(body.current);
    effects.current = current;
    return () => {
      current.restore();
      effects.current = null;
    };
  }, [vehicle, character, altChar, glow]);

  useFrame((_, delta) => {
    t.current += delta;
    const st = stateRef?.current;
    const mode = st?.mode ?? "land";
    const speedFrac = st?.speedFrac ?? 0;
    const speed = st?.speed ?? speedFrac * 30;
    const pose = motion.current;
    pose.update(delta, speed, st?.steer ?? 0, !!st?.airborne, st?.vy ?? 0, st?.activeIsPartner && altChar ? altChar.weight : character.weight);
    spin.current += Math.min(delta, 0.1) * speed / 0.48;
    if (wheelRef.current?.visible) wheelRef.current.children.forEach((wheel, i) => {
      wheel.rotation.y = i < 2 ? (st?.steer ?? 0) * 0.4 : 0;
      wheel.children[0].rotation.x = spin.current;
    });

    const boatKind = vehicle.boat ?? "cat";
    const planeKind = vehicle.plane ?? "wing";
    if (hullRef.current) hullRef.current.visible = mode === "boat" && boatKind === "cat";
    if (wingRef.current) wingRef.current.visible = mode === "plane" && planeKind === "wing";
    if (boatAltRef.current)
      boatAltRef.current.visible =
        mode === "boat" && boatKind !== "cat" && boatKind !== "yacht";
    if (planeAltRef.current)
      planeAltRef.current.visible =
        mode === "plane" && planeKind !== "wing" && planeKind !== "stealth";
    if (subRef.current)
      subRef.current.visible = mode === "sub" && vehicle.sub !== "diver";
    // the land chassis is hidden while submerged (the sub hull replaces it)
    if (chassisRef.current) chassisRef.current.visible = mode !== "sub";
    if (hoverRef.current) hoverRef.current.visible = mode === "hover";
    if (wheelRef.current)
      wheelRef.current.visible =
        mode === "land" && hasRoadWheels(vehicle.shape);

    const usePartner = !!(st?.activeIsPartner && altChar);
    const fused = !!(st?.fused && altChar);
    if (mainPilot.current) mainPilot.current.visible = !usePartner;
    if (altPilot.current) altPilot.current.visible = usePartner;
    if (mainPilot.current) { mainPilot.current.rotation.z = pose.lean; mainPilot.current.rotation.x = pose.pitch * 0.6; }
    if (altPilot.current) { altPilot.current.rotation.z = pose.lean; altPilot.current.rotation.x = pose.pitch * 0.6; }
    if (gunBarrel.current) gunBarrel.current.visible = !!st?.gunning;
    if (turret.current) {
      turret.current.visible = fused;
      turret.current.rotation.y = st?.turretAim ?? 0;
    }
    if (gunnerMain.current) gunnerMain.current.visible = fused && usePartner;
    if (gunnerAlt.current) gunnerAlt.current.visible = fused && !usePartner;

    if (body.current) {
      const bobAmp = mode === "boat" ? 0.08 : mode === "plane" ? 0.06 : 0.02;
      body.current.position.y = Math.sin(t.current * (mode === "boat" ? 3.2 : 6)) * bobAmp + pose.suspension.value;
      const squash = THREE.MathUtils.clamp(1 + pose.suspension.value * 0.45 + (st?.airborne ? 0.025 : 0), 0.94, 1.04);
      body.current.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      // lean INTO the turn (steer > 0 = turning right on screen)
      const tilt = (st?.steer ?? 0) * (mode === "plane" ? 0.55 : 0.17) * -1;
      body.current.rotation.z = THREE.MathUtils.lerp(body.current.rotation.z, tilt, frameBlend(0.16, Math.min(delta, 0.1)));
      const pitch = mode === "plane" ? -0.14 - speedFrac * 0.1 : (mode === "boat" ? 0.07 : -speedFrac * 0.05) + pose.pitch;
      body.current.rotation.x = THREE.MathUtils.lerp(body.current.rotation.x, pitch, frameBlend(0.12, Math.min(delta, 0.1)));
      if (st?.stunned) body.current.rotation.y = Math.sin(t.current * 34) * 0.4;
      else body.current.rotation.y = THREE.MathUtils.lerp(body.current.rotation.y, 0, frameBlend(0.2, Math.min(delta, 0.1)));
    }
    if (flame.current) {
      const on = !!st?.boosting;
      const s = on ? 1 + Math.sin(t.current * 45) * 0.3 : 0.001;
      flame.current.scale.set(s, s * 1.7, s);
      (flame.current.material as THREE.MeshStandardMaterial).opacity = on ? 0.95 : 0;
    }
    if (shield.current) {
      const on = !!st?.shielded;
      shield.current.visible = on;
      shield.current.rotation.y += delta * 2.4;
      shield.current.rotation.x += delta;
      (shield.current.material as THREE.MeshStandardMaterial).opacity = 0.3 + Math.sin(t.current * 7) * 0.12;
    }
    effects.current?.update(!!st?.ghost, !!st?.exploding, t.current);
    if (magnetRing.current) {
      const on = !!st?.magnet;
      magnetRing.current.visible = on;
      magnetRing.current.rotation.z += delta * 3;
      magnetRing.current.scale.setScalar(1 + Math.sin(t.current * 6) * 0.12);
    }
    if (pad.current) {
      pad.current.visible = !!isPlayer;
      pad.current.rotation.z += delta * 1.8;
      (pad.current.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(t.current * 4) * 0.18;
    }
  });

  return (
    <group scale={scale}>
      {isPlayer && (
        <mesh userData={{ previewIgnore: true }} ref={pad} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[1.4, 1.85, 30]} />
          <meshBasicMaterial color={glow ?? "#ffffff"} transparent opacity={0.45} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      <group ref={body}>
        <group ref={chassisRef}>
          <Chassis vehicle={vehicle} glow={glow} hullRef={hullRef} wingRef={wingRef} wheelRef={wheelRef} />
        </group>
        <group ref={boatAltRef} visible={false}>
          {(NEW_CRAFT.boat as readonly string[]).includes(vehicle.boat ?? "cat") ? (
            <Craft4 kind={vehicle.boat as NewCraftId} body={vehicle.body} decal={vehicle.decal} glow={glow} finish={vehicle.finish} stateRef={stateRef} />
          ) : (<>
          <BoatAlt kind={vehicle.boat ?? "cat"} body={vehicle.body} decal={vehicle.decal} glow={glow} finish={vehicle.finish} />
          <Boat3 kind={vehicle.boat ?? "cat"} body={vehicle.body} decal={vehicle.decal} glow={glow} finish={vehicle.finish} />

          </>)}
        </group>
        <group ref={planeAltRef} visible={false}>
          {(NEW_CRAFT.plane as readonly string[]).includes(vehicle.plane ?? "wing") ? (
            <Craft4 kind={vehicle.plane as NewCraftId} body={vehicle.body} decal={vehicle.decal} glow={glow} finish={vehicle.finish} stateRef={stateRef} />
          ) : (<>
          <PlaneAlt kind={vehicle.plane ?? "wing"} body={vehicle.body} decal={vehicle.decal} glow={glow} finish={vehicle.finish} />
          <Plane3 kind={vehicle.plane ?? "wing"} body={vehicle.body} decal={vehicle.decal} glow={glow} finish={vehicle.finish} />

          </>)}
        </group>
        <group ref={subRef} visible={false}>
          {(NEW_CRAFT.sub as readonly string[]).includes(vehicle.sub ?? "classic") ? (
            <Craft4 kind={vehicle.sub as NewCraftId} body={vehicle.body} decal={vehicle.decal} glow={glow} finish={vehicle.finish} stateRef={stateRef} />
          ) : SUB3.includes(vehicle.sub ?? "classic") ? (
            <Sub3 kind={vehicle.sub ?? "classic"} body={vehicle.body} decal={vehicle.decal} glow={glow} finish={vehicle.finish} />
          ) : (
            <SubModel kind={vehicle.sub ?? "classic"} body={vehicle.body} decal={vehicle.decal} glow={glow} finish={vehicle.finish} />
          )}
        </group>
        <group ref={hoverRef} visible={false}>
          {(NEW_CRAFT.hover as readonly string[]).includes(vehicle.hover ?? "maglev") ? (
            <Craft4 kind={vehicle.hover as NewCraftId} body={vehicle.body} decal={vehicle.decal} glow={glow} finish={vehicle.finish} stateRef={stateRef} />
          ) : <Hover3 kind={vehicle.hover ?? "maglev"} body={vehicle.body} decal={vehicle.decal} glow={glow} finish={vehicle.finish} />}
        </group>
        <ModeModels vehicle={vehicle} stateRef={stateRef} glow={glow} />
        <VehicleDetails stateRef={stateRef} decal={vehicle.decal} narrow={vehicle.shape === "moto" || vehicle.shape === "board"} />
        <group ref={mainPilot}>
          <Pilot char={character} glow={glow} stateRef={stateRef} />
        </group>
        {altChar && (
          <group ref={altPilot} visible={false}>
            <Pilot char={altChar} glow={glow} stateRef={stateRef} />
          </group>
        )}
        {/* riding on another kart as its gunner: this kart is the turret, and this is its barrel */}
        <group ref={gunBarrel} visible={false} position={[0, 1.2, 0.1]}>
          <mesh>
            <cylinderGeometry args={[0.55, 0.7, 0.4, 12]} />
            <meshStandardMaterial color="#2b2f3a" metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.15, 1.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.17, 0.24, 2.2, 10]} />
            <meshStandardMaterial color="#3a4052" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.15, 2.25]}>
            <sphereGeometry args={[0.26, 10, 10]} />
            <meshStandardMaterial color={character.primary} emissive={character.primary} emissiveIntensity={2.2} toneMapped={false} />
          </mesh>
        </group>
        {/* FUSION turret (Crash Tag Team style): one drives, the other shoots */}
        {altChar && (
          <group ref={turret} visible={false} position={[0, 0.9, -1.0]}>
            <mesh>
              <cylinderGeometry args={[0.4, 0.5, 0.3, 10]} />
              <meshStandardMaterial color="#2b2f3a" metalness={0.6} roughness={0.35} />
            </mesh>
            <mesh position={[0, 0.18, 0.4]} rotation={[Math.PI / 2 - 0.3, 0, 0]}>
              <cylinderGeometry args={[0.1, 0.13, 0.9, 8]} />
              <meshStandardMaterial color={glow ?? "#7de1ff"} emissive={glow ?? "#7de1ff"} emissiveIntensity={1.8} toneMapped={false} />
            </mesh>
            <group ref={gunnerAlt} visible={false}>
              <Pilot char={altChar} glow={glow} stateRef={stateRef} gunner />
            </group>
            <group ref={gunnerMain} visible={false}>
              <Pilot char={character} glow={glow} stateRef={stateRef} gunner />
            </group>
          </group>
        )}
        <mesh userData={{ previewIgnore: true }} ref={flame} position={[0, 0.5, -1.6]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.36, 1.3, 8]} />
          <meshStandardMaterial color={glow ?? "#7de1ff"} emissive={glow ?? "#7de1ff"} emissiveIntensity={4} transparent opacity={0} toneMapped={false} />
        </mesh>
        <mesh userData={{ previewIgnore: true }} ref={magnetRing} position={[0, 0.35, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <torusGeometry args={[2.4, 0.09, 8, 36]} />
          <meshBasicMaterial color="#fb923c" transparent opacity={0.55} toneMapped={false} />
        </mesh>
        <mesh userData={{ previewIgnore: true }} ref={shield} position={[0, 0.8, 0]} visible={false}>
          <icosahedronGeometry args={[1.8, 1]} />
          <meshStandardMaterial color="#8be9ff" transparent opacity={0.3} emissive="#8be9ff" emissiveIntensity={1.6} wireframe toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
