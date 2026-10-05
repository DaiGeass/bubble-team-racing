import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BoatId, BoosterId, CharacterDef, PlaneId, ShapeId, SpoilerId, SubId, VehicleMode, WheelStyle } from "../data";
import { BoatAlt, ExtraShapes, PlaneAlt, SubModel } from "./Models";
import { ModeModels } from "./Models2";
import { Boat3, Land3, Plane3, Sub3, SUB3 } from "./Models3";

export interface KartVisualState {
  boosting: boolean;
  shielded: boolean;
  steer: number;
  speedFrac: number;
  stunned: boolean;
  mode: VehicleMode;
  drift: boolean;
  activeIsPartner?: boolean;
  fused?: boolean;
  ghost?: boolean;
  magnet?: boolean;
  /** riding on another kart as its gunner: shows the barrel */
  gunning?: boolean;
  exploding?: boolean;
}

export interface VehicleConfig {
  body: string;
  decal: string;
  wheel: WheelStyle;
  shape: ShapeId;
  spoiler?: SpoilerId;
  booster?: BoosterId;
  boat?: BoatId;
  plane?: PlaneId;
  sub?: SubId;
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

function Wheel({ style, position, spin }: { style: WheelStyle; position: [number, number, number]; spin: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.rotation.x = spin.current;
  });
  const rim =
    style === "sporty" ? "#ff3b6b" : style === "glow" ? "#7dffea" : style === "chrome" ? "#e8f1ff" : style === "spike" ? "#ffb347" : "#3a3f55";
  return (
    <group ref={ref} position={position}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.48, 0.48, style === "spike" ? 0.44 : 0.36, 14]} />
        <meshStandardMaterial color={style === "spike" ? "#242018" : "#15161d"} roughness={style === "spike" ? 0.95 : 0.7} />
      </mesh>
      {style === "spike" ? (
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <icosahedronGeometry args={[0.3, 0]} />
          <meshStandardMaterial color={rim} emissive={rim} emissiveIntensity={0.4} roughness={0.4} metalness={0.5} />
        </mesh>
      ) : (
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.26, 0.26, 0.38, style === "chrome" ? 16 : 10]} />
          <meshStandardMaterial
            color={rim}
            emissive={rim}
            emissiveIntensity={style === "glow" ? 2.4 : style === "sporty" ? 0.6 : style === "chrome" ? 0.15 : 0.1}
            roughness={style === "chrome" ? 0.05 : 0.25}
            metalness={style === "chrome" ? 1 : 0.7}
            toneMapped={style !== "chrome"}
          />
        </mesh>
      )}
    </group>
  );
}

/** Shared kawaii face used by every Frutiger life-form. */
function Face({ char, glow, z = 0.3, y = 0 }: { char: CharacterDef; glow?: string; z?: number; y?: number }) {
  return (
    <group position={[0, y, z]}>
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
function Pilot({ char, glow, gunner }: { char: CharacterDef; glow?: string; gunner?: boolean }) {
  const bob = useRef(Math.random() * 6);
  const root = useRef<THREE.Group>(null);
  const aura = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    bob.current += dt;
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
            <Face char={char} glow={glow} z={0.36} />
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
            <Face char={char} glow={glow} z={0.3} />
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
            <Face char={char} glow={glow} z={0.33} />
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
            <Face char={char} glow={glow} z={0.3} y={0.02} />
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
            <Face char={char} glow={glow} z={0.32} />
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
            <Face char={char} glow={glow} z={0.38} />
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
            <Face char={char} glow={glow} z={0.32} />
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
            <Face char={char} glow={glow} z={0.33} />
          </group>
        )}
      </group>
    </group>
  );
}

function Spoiler({ kind, decal, glow }: { kind: SpoilerId; decal: string; glow?: string }) {
  if (kind === "none") return null;
  if (kind === "wing")
    return (
      <group position={[0, 0.95, -1.05]}>
        <mesh>
          <boxGeometry args={[1.5, 0.08, 0.4]} />
          <meshStandardMaterial color={decal} roughness={0.2} metalness={0.5} />
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
  spin,
  hullRef,
  wingRef,
  wheelRef,
}: {
  vehicle: VehicleConfig;
  glow?: string;
  spin: React.MutableRefObject<number>;
  hullRef: React.MutableRefObject<THREE.Group | null>;
  wingRef: React.MutableRefObject<THREE.Group | null>;
  wheelRef: React.MutableRefObject<THREE.Group | null>;
}) {
  const { body, decal, shape } = vehicle as any; const finish = (vehicle as any).finish as import("../data").FinishId | undefined;
  const propRef = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (propRef.current && wingRef.current?.visible) propRef.current.rotation.z += dt * 30;
  });

  return (
    <group>
      {shape === "kart" && (
        <>
          <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.2, 0.34, 2.15]} />
            <meshStandardMaterial color={body} roughness={0.22} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0.62, -0.2]}>
            <boxGeometry args={[1.0, 0.16, 1.2]} />
            <meshStandardMaterial color={decal} roughness={0.25} metalness={0.25} />
          </mesh>
          <mesh position={[0, 0.4, 1.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <coneGeometry args={[0.58, 0.85, 4]} />
            <meshStandardMaterial color={body} roughness={0.22} metalness={0.4} />
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
            <meshStandardMaterial color={body} roughness={0.1} metalness={0.65} />
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
            <meshStandardMaterial color={body} roughness={0.45} metalness={0.2} />
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
            <meshStandardMaterial color={body} roughness={0.12} metalness={0.8} />
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
            <meshStandardMaterial color={body} roughness={0.18} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0.78, -0.15]}>
            <boxGeometry args={[1.0, 0.14, 1.5]} />
            <meshStandardMaterial color={decal} roughness={0.3} metalness={0.3} />
          </mesh>
        </>
      )}
      {shape === "moto" && (
        <>
          <mesh position={[0, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <capsuleGeometry args={[0.36, 1.9, 6, 12]} />
            <meshStandardMaterial color={body} roughness={0.15} metalness={0.6} />
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
            <meshStandardMaterial color={body} roughness={0.1} metalness={0.7} />
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
      <Land3 shape={shape} body={body} decal={decal} glow={glow} finish={finish} />
      <Spoiler kind={vehicle.spoiler ?? "none"} decal={decal} glow={glow} />
      <Boosters kind={vehicle.booster ?? "single"} glow={glow} />

      {/* boat hull */}
      <group ref={hullRef} visible={false}>
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
      </group>

      {/* plane wings + propeller */}
      <group ref={wingRef} visible={false}>
        <mesh position={[0, 0.78, -0.25]} castShadow>
          <boxGeometry args={[3.6, 0.1, 0.8]} />
          <meshStandardMaterial color={decal} roughness={0.15} metalness={0.55} />
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
          <meshStandardMaterial color={body} roughness={0.25} metalness={0.4} />
        </mesh>
        <mesh ref={propRef} position={[0, 0.72, 1.45]}>
          <boxGeometry args={[1.8, 0.08, 0.12]} />
          <meshStandardMaterial color="#eaf6ff" transparent opacity={0.6} toneMapped={false} />
        </mesh>
      </group>

      <group ref={wheelRef}>
        <Wheel style={vehicle.wheel} position={[-0.72, 0.46, 0.85]} spin={spin} />
        <Wheel style={vehicle.wheel} position={[0.72, 0.46, 0.85]} spin={spin} />
        <Wheel style={vehicle.wheel} position={[-0.72, 0.46, -0.85]} spin={spin} />
        <Wheel style={vehicle.wheel} position={[0.72, 0.46, -0.85]} spin={spin} />
      </group>
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
  const chassisRef = useRef<THREE.Group>(null);
  const mainPilot = useRef<THREE.Group>(null);
  const altPilot = useRef<THREE.Group>(null);
  const gunnerMain = useRef<THREE.Group>(null);
  const gunnerAlt = useRef<THREE.Group>(null);
  const turret = useRef<THREE.Group>(null);
  const gunBarrel = useRef<THREE.Group>(null);
  const t = useRef(Math.random() * 10);
  const spin = useRef(0);
  const ghostApplied = useRef(false);
  const magnetRing = useRef<THREE.Mesh>(null);

  const altChar = useMemo(() => partner ?? null, [partner]);

  useFrame((_, delta) => {
    t.current += delta;
    const st = stateRef?.current;
    const mode = st?.mode ?? "land";
    const speedFrac = st?.speedFrac ?? 0;
    spin.current += delta * (6 + speedFrac * 45);

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
    if (wheelRef.current)
      wheelRef.current.visible =
        mode === "land" &&
        vehicle.shape !== "hover" &&
        vehicle.shape !== "ufo" &&
        vehicle.shape !== "tank" &&
        vehicle.shape !== "orbit" &&
        vehicle.shape !== "phantom" &&
        vehicle.shape !== "board" &&
        vehicle.shape !== "pod";

    const usePartner = !!(st?.activeIsPartner && altChar);
    const fused = !!(st?.fused && altChar);
    if (mainPilot.current) mainPilot.current.visible = !usePartner;
    if (altPilot.current) altPilot.current.visible = usePartner;
    if (gunBarrel.current) gunBarrel.current.visible = !!st?.gunning;
    if (turret.current) {
      turret.current.visible = fused;
      turret.current.rotation.y = 0;
    }
    if (gunnerMain.current) gunnerMain.current.visible = fused && usePartner;
    if (gunnerAlt.current) gunnerAlt.current.visible = fused && !usePartner;

    if (body.current && st?.exploding) {
      const f = Math.abs(Math.sin(t.current * 40));
      (body.current as any).traverse((ch: any) => { if (ch.isMesh && ch.material) { const m = ch.material; if (Array.isArray(m)) m.forEach((mm:any)=>mm.emissive?.setHex?.(f>0.5?0xff4d6d:0xffffff)); else m.emissive?.setHex?.(f>0.5?0xff4d6d:0xffffff); } });
    }
    if (body.current) {
      const bobAmp = mode === "boat" ? 0.08 : mode === "plane" ? 0.06 : 0.02;
      body.current.position.y = Math.sin(t.current * (mode === "boat" ? 3.2 : 6)) * bobAmp;
      // lean INTO the turn (steer > 0 = turning right on screen)
      const tilt = (st?.steer ?? 0) * (mode === "plane" ? 0.55 : 0.17) * -1;
      body.current.rotation.z = THREE.MathUtils.lerp(body.current.rotation.z, tilt, 0.16);
      const pitch = mode === "plane" ? -0.14 - speedFrac * 0.1 : mode === "boat" ? 0.07 : -speedFrac * 0.05;
      body.current.rotation.x = THREE.MathUtils.lerp(body.current.rotation.x, pitch, 0.12);
      if (st?.stunned) body.current.rotation.y = Math.sin(t.current * 34) * 0.4;
      else body.current.rotation.y = THREE.MathUtils.lerp(body.current.rotation.y, 0, 0.2);
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
    // GHOST: the whole vehicle turns into translucent glass
    if (body.current && st?.exploding) {
      const f = Math.abs(Math.sin(t.current * 40));
      (body.current as any).traverse((ch: any) => { if (ch.isMesh && ch.material) { const m = ch.material; if (Array.isArray(m)) m.forEach((mm:any)=>mm.emissive?.setHex?.(f>0.5?0xff4d6d:0xffffff)); else m.emissive?.setHex?.(f>0.5?0xff4d6d:0xffffff); } });
    }
    if (body.current) {
      const ghost = !!st?.ghost;
      if (ghost !== ghostApplied.current) {
        ghostApplied.current = ghost;
        body.current.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
          if (!m) return;
          const list = Array.isArray(m) ? m : [m];
          for (const mat of list) {
            const anyMat = mat as THREE.Material & { opacity: number; transparent: boolean; userData: Record<string, number> };
            if (ghost) {
              if (anyMat.userData.baseOpacity === undefined) anyMat.userData.baseOpacity = anyMat.opacity;
              anyMat.transparent = true;
              anyMat.opacity = Math.min(anyMat.userData.baseOpacity ?? 1, 0.34);
            } else if (anyMat.userData.baseOpacity !== undefined) {
              anyMat.opacity = anyMat.userData.baseOpacity;
              anyMat.transparent = anyMat.userData.baseOpacity < 1;
            }
          }
        });
      }
    }
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
        <mesh ref={pad} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[1.4, 1.85, 30]} />
          <meshBasicMaterial color={glow ?? "#ffffff"} transparent opacity={0.45} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      <group ref={body}>
        <group ref={chassisRef}>
          <Chassis vehicle={vehicle} glow={glow} spin={spin} hullRef={hullRef} wingRef={wingRef} wheelRef={wheelRef} />
        </group>
        <group ref={boatAltRef} visible={false}>
          <BoatAlt kind={vehicle.boat ?? "cat"} body={vehicle.body} decal={vehicle.decal} glow={glow} finish={(vehicle as any).finish} />
          <Boat3 kind={vehicle.boat ?? "cat"} body={vehicle.body} decal={vehicle.decal} glow={glow} finish={(vehicle as any).finish} />
        </group>
        <group ref={planeAltRef} visible={false}>
          <PlaneAlt kind={vehicle.plane ?? "wing"} body={vehicle.body} decal={vehicle.decal} glow={glow} finish={(vehicle as any).finish} />
          <Plane3 kind={vehicle.plane ?? "wing"} body={vehicle.body} decal={vehicle.decal} glow={glow} finish={(vehicle as any).finish} />
        </group>
        <group ref={subRef} visible={false}>
          {SUB3.includes(vehicle.sub ?? "classic") ? (
            <Sub3 kind={vehicle.sub ?? "classic"} body={vehicle.body} decal={vehicle.decal} glow={glow} finish={(vehicle as any).finish} />
          ) : (
            <SubModel kind={vehicle.sub ?? "classic"} body={vehicle.body} decal={vehicle.decal} glow={glow} finish={(vehicle as any).finish} />
          )}
        </group>
        <ModeModels vehicle={vehicle} stateRef={stateRef} glow={glow} />
        <group ref={mainPilot}>
          <Pilot char={character} glow={glow} />
        </group>
        {altChar && (
          <group ref={altPilot} visible={false}>
            <Pilot char={altChar} glow={glow} />
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
              <Pilot char={altChar} glow={glow} gunner />
            </group>
            <group ref={gunnerMain} visible={false}>
              <Pilot char={character} glow={glow} gunner />
            </group>
          </group>
        )}
        <mesh ref={flame} position={[0, 0.5, -1.6]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.36, 1.3, 8]} />
          <meshStandardMaterial color={glow ?? "#7de1ff"} emissive={glow ?? "#7de1ff"} emissiveIntensity={4} transparent opacity={0} toneMapped={false} />
        </mesh>
        <mesh ref={magnetRing} position={[0, 0.35, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <torusGeometry args={[2.4, 0.09, 8, 36]} />
          <meshBasicMaterial color="#fb923c" transparent opacity={0.55} toneMapped={false} />
        </mesh>
        <mesh ref={shield} position={[0, 0.8, 0]} visible={false}>
          <icosahedronGeometry args={[1.8, 1]} />
          <meshStandardMaterial color="#8be9ff" transparent opacity={0.3} emissive="#8be9ff" emissiveIntensity={1.6} wireframe toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
