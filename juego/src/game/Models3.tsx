import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BoatId, FinishId, PlaneId, ShapeId, SubId } from "../data";
import { Glass, Neon, Paint } from "./Models";

interface C {
  body: string;
  decal: string;
  glow?: string;
  finish?: FinishId;
}

const DARK = "#2b2f3a";
const Metal = ({ color = DARK }: { color?: string }) => <meshStandardMaterial color={color} metalness={0.75} roughness={0.3} />;

/** The models in this file, so the callers know which ids are theirs. */
export const LAND3: ShapeId[] = ["shell", "board", "winglet", "pod"];
export const BOAT3: BoatId[] = ["airboat", "viking", "duck"];
export const PLANE3: PlaneId[] = ["heli", "blimp", "saucer"];
export const SUB3: SubId[] = ["manta", "squid", "bathy", "torpedo"];

// ---------------------------------------------------------------------------
// LAND: turtle shell, hoverboard, winglet racer, twin-engine pod
// ---------------------------------------------------------------------------
export function Land3({ shape, body, decal, glow, finish }: C & { shape: ShapeId }) {
  const g = glow ?? "#7de1ff";
  if (shape === "shell")
    return (
      <group>
        {/* the shell: a dome of plates over a pale belly */}
        <mesh position={[0, 0.5, -0.05]} scale={[1, 0.62, 1.25]} castShadow>
          <sphereGeometry args={[1.0, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={body} roughness={0.25} metalness={0.4} flatShading />
        </mesh>
        <mesh position={[0, 0.44, -0.05]} scale={[1.08, 0.2, 1.33]}>
          <cylinderGeometry args={[1, 0.9, 1, 10]} />
          <meshStandardMaterial color="#fff3d6" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.5, -0.05]} scale={[1.02, 0.63, 1.27]}>
          <sphereGeometry args={[1.0, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshBasicMaterial color={decal} wireframe toneMapped={false} />
        </mesh>
        {/* head and stubby tail */}
        <mesh position={[0, 0.5, 1.45]} scale={[1, 0.85, 1.2]}>
          <sphereGeometry args={[0.36, 12, 10]} />
          <Paint color={decal} rough={0.4} metal={0.2} finish={finish} />
        </mesh>
        {[-0.16, 0.16].map((x) => (
          <mesh key={x} position={[x, 0.62, 1.74]}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshBasicMaterial color="#111827" />
          </mesh>
        ))}
        <mesh position={[0, 0.42, -1.4]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.16, 0.5, 6]} />
          <Paint color={decal} finish={finish} />
        </mesh>
        <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.25, 24]} />
          <meshBasicMaterial color={g} transparent opacity={0.35} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    );
  if (shape === "board")
    return (
      <group>
        {/* a long hoverboard with a handlebar post: no wheels, two glowing pads */}
        <mesh position={[0, 0.34, 0]} scale={[1, 1, 1]} castShadow>
          <boxGeometry args={[1.1, 0.14, 2.9]} />
          <Paint color={body} finish={finish} />
        </mesh>
        <mesh position={[0, 0.4, 1.55]} rotation={[-0.5, 0, 0]}>
          <boxGeometry args={[1.1, 0.14, 0.6]} />
          <Paint color={body} finish={finish} />
        </mesh>
        <mesh position={[0, 0.4, -1.55]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[1.1, 0.14, 0.6]} />
          <Paint color={body} finish={finish} />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <boxGeometry args={[0.22, 0.02, 2.9]} />
          <Neon color={decal} i={2.2} />
        </mesh>
        {[-0.95, 0.95].map((z) => (
          <group key={z} position={[0, 0.2, z]}>
            <mesh>
              <cylinderGeometry args={[0.42, 0.34, 0.16, 16]} />
              <Metal />
            </mesh>
            <mesh position={[0, -0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.36, 16]} />
              <meshBasicMaterial color={g} toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.85, 1.05]} rotation={[-0.2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 1.0, 8]} />
          <Metal />
        </mesh>
        <mesh position={[0, 1.33, 0.95]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.06, 0.06, 0.9, 8]} />
          <Neon color={decal} i={1.6} />
        </mesh>
      </group>
    );
  if (shape === "winglet")
    return (
      <group>
        {/* a low dart with a wing at each corner */}
        <mesh position={[0, 0.42, 0.1]} scale={[1, 0.5, 1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[0.72, 3.1, 5]} />
          <Paint color={body} finish={finish} />
        </mesh>
        <mesh position={[0, 0.62, -0.55]} scale={[0.75, 0.55, 1.1]}>
          <sphereGeometry args={[0.62, 14, 10]} />
          <Glass opacity={0.34} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[s * 0.95, 0.5, 0.95]} rotation={[0, s * -0.3, s * 0.12]}>
              <boxGeometry args={[0.9, 0.06, 0.42]} />
              <Paint color={decal} finish={finish} />
            </mesh>
            <mesh position={[s * 1.05, 0.72, -1.05]} rotation={[0, s * 0.25, s * 0.5]}>
              <boxGeometry args={[1.0, 0.06, 0.5]} />
              <Paint color={decal} finish={finish} />
            </mesh>
            <mesh position={[s * 1.45, 0.98, -1.1]}>
              <boxGeometry args={[0.06, 0.4, 0.5]} />
              <Neon color={g} i={2.2} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.5, -1.4]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.38, 0.4, 12]} />
          <Metal />
        </mesh>
      </group>
    );
  if (shape === "pod")
    return (
      <group>
        {/* two engines out in front on cables, the cockpit trailing behind */}
        {[-0.8, 0.8].map((x) => (
          <group key={x} position={[x, 0.62, 1.35]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.3, 0.36, 1.6, 12]} />
              <Paint color={body} finish={finish} />
            </mesh>
            <mesh position={[0, 0, 0.82]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.2, 0.3, 0.14, 12]} />
              <Metal />
            </mesh>
            <mesh position={[0, 0, -0.84]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.26, 0.2, 0.1, 12]} />
              <Neon color={g} i={3} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.36, 0.05, 6, 16]} />
              <Neon color={decal} i={2} />
            </mesh>
            <mesh position={[-x * 0.5, -0.05, -1.1]} rotation={[Math.PI / 2 - 0.1, 0, x > 0 ? 0.42 : -0.42]}>
              <cylinderGeometry args={[0.025, 0.025, 1.5, 5]} />
              <Metal />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.62, 1.35]}>
          <boxGeometry args={[1.3, 0.04, 0.08]} />
          <Neon color={g} i={3.2} />
        </mesh>
        <mesh position={[0, 0.45, -0.55]} scale={[1, 0.7, 1.3]} castShadow>
          <sphereGeometry args={[0.72, 14, 10]} />
          <Paint color={body} finish={finish} />
        </mesh>
        <mesh position={[0, 0.5, -0.55]} scale={[1.02, 0.2, 1.32]}>
          <sphereGeometry args={[0.72, 14, 10]} />
          <Paint color={decal} finish={finish} />
        </mesh>
        <mesh position={[0, 0.32, -1.5]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[1.5, 0.06, 0.4]} />
          <Paint color={decal} finish={finish} />
        </mesh>
      </group>
    );
  return null;
}

// ---------------------------------------------------------------------------
// BOATS: swamp airboat, longship, rubber duck
// ---------------------------------------------------------------------------
export function Boat3({ kind, body, decal, glow, finish }: C & { kind: BoatId }) {
  const fan = useRef<THREE.Group>(null);
  const oars = useRef<THREE.Group>(null);
  useFrame((s, dt) => {
    if (fan.current) fan.current.rotation.z += dt * 30;
    if (oars.current) oars.current.rotation.x = Math.sin(s.clock.elapsedTime * 6) * 0.35;
  });
  const g = glow ?? "#4fd8e8";
  if (kind === "airboat")
    return (
      <group>
        <mesh position={[0, 0.02, 0.15]} castShadow>
          <boxGeometry args={[2.3, 0.3, 3.3]} />
          <Paint color={body} finish={finish} />
        </mesh>
        <mesh position={[0, 0.12, 1.95]} rotation={[-0.5, 0, 0]}>
          <boxGeometry args={[2.3, 0.3, 0.9]} />
          <Paint color={body} finish={finish} />
        </mesh>
        <mesh position={[0, 0.19, 0.15]}>
          <boxGeometry args={[2.34, 0.06, 3.34]} />
          <Neon color={decal} i={1.4} />
        </mesh>
        {/* the fan in its cage */}
        <group position={[0, 1.55, -1.55]}>
          <mesh>
            <torusGeometry args={[0.95, 0.07, 8, 24]} />
            <Metal />
          </mesh>
          {[0, 1, 2].map((k) => (
            <mesh key={k} rotation={[0, 0, (k * Math.PI) / 3]}>
              <boxGeometry args={[1.9, 0.03, 0.03]} />
              <Metal />
            </mesh>
          ))}
          <group ref={fan} position={[0, 0, 0.05]}>
            {[0, 1].map((k) => (
              <mesh key={k} rotation={[0, 0, (k * Math.PI) / 2]}>
                <boxGeometry args={[1.7, 0.2, 0.04]} />
                <meshStandardMaterial color="#eaf6ff" transparent opacity={0.7} />
              </mesh>
            ))}
          </group>
          <mesh position={[0, 0, 0.12]}>
            <sphereGeometry args={[0.16, 10, 8]} />
            <Neon color={g} i={2.6} />
          </mesh>
        </group>
        {[-0.6, 0.6].map((x) => (
          <mesh key={x} position={[x, 0.75, -1.5]} rotation={[0, 0, x > 0 ? 0.3 : -0.3]}>
            <cylinderGeometry args={[0.05, 0.05, 1.3, 6]} />
            <Metal />
          </mesh>
        ))}
        {[-0.5, 0.5].map((x) => (
          <mesh key={x} position={[x, 1.5, -2.05]}>
            <boxGeometry args={[0.06, 1.3, 0.5]} />
            <Paint color={decal} finish={finish} />
          </mesh>
        ))}
      </group>
    );
  if (kind === "viking")
    return (
      <group>
        <mesh position={[0, 0.05, 0.1]} rotation={[Math.PI / 2, 0, 0]} scale={[1.15, 1, 0.55]} castShadow>
          <capsuleGeometry args={[0.95, 2.6, 6, 14]} />
          <Paint color={body} rough={0.5} metal={0.15} finish={finish} />
        </mesh>
        <mesh position={[0, 0.3, 0.1]} rotation={[Math.PI / 2, 0, 0]} scale={[1.17, 1, 0.12]}>
          <capsuleGeometry args={[0.95, 2.6, 6, 14]} />
          <Paint color={decal} finish={finish} />
        </mesh>
        {/* the prow curls up into a dragon's head, the stern into its tail */}
        <mesh position={[0, 0.9, 2.2]} rotation={[0.35, 0, 0]}>
          <cylinderGeometry args={[0.13, 0.22, 1.5, 8]} />
          <Paint color={body} rough={0.5} finish={finish} />
        </mesh>
        <mesh position={[0, 1.7, 2.55]} scale={[0.9, 0.9, 1.4]}>
          <sphereGeometry args={[0.28, 10, 8]} />
          <Paint color={decal} finish={finish} />
        </mesh>
        {[-0.14, 0.14].map((x) => (
          <mesh key={x} position={[x, 1.8, 2.75]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <Neon color={g} i={3} />
          </mesh>
        ))}
        <mesh position={[0, 0.85, -2.05]} rotation={[-0.5, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.2, 1.3, 8]} />
          <Paint color={body} rough={0.5} finish={finish} />
        </mesh>
        {/* shields along the rail, and the oars pulling */}
        {[-1, 1].map((s) =>
          [-0.9, -0.1, 0.7].map((z, k) => (
            <mesh key={`${s}${z}`} position={[s * 1.12, 0.38, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.3, 0.3, 0.07, 14]} />
              <meshStandardMaterial color={k % 2 ? decal : "#f8fafc"} roughness={0.4} metalness={0.3} />
            </mesh>
          ))
        )}
        <group ref={oars}>
          {[-1, 1].map((s) =>
            [-0.5, 0.3].map((z) => (
              <mesh key={`${s}${z}`} position={[s * 1.75, 0.05, z]} rotation={[0, 0, s * 1.15]}>
                <cylinderGeometry args={[0.035, 0.07, 1.5, 6]} />
                <meshStandardMaterial color="#c8a877" roughness={0.7} />
              </mesh>
            ))
          )}
        </group>
      </group>
    );
  if (kind === "duck")
    return (
      <group>
        {/* a bath duck big enough to sit in */}
        <mesh position={[0, 0.15, -0.1]} scale={[1.15, 0.62, 1.55]} castShadow>
          <sphereGeometry args={[1.05, 18, 14]} />
          <Paint color={body} rough={0.25} metal={0.1} finish={finish} />
        </mesh>
        <mesh position={[0, 0.5, -1.65]} rotation={[0.9, 0, 0]} scale={[1, 1, 0.6]}>
          <coneGeometry args={[0.5, 0.9, 10]} />
          <Paint color={body} rough={0.25} metal={0.1} finish={finish} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 1.12, 0.3, -0.3]} rotation={[0, 0, s * -0.25]} scale={[0.3, 0.55, 1]}>
            <sphereGeometry args={[0.75, 12, 10]} />
            <Paint color={decal} rough={0.3} metal={0.1} finish={finish} />
          </mesh>
        ))}
        <mesh position={[0, 0.95, 1.5]} castShadow>
          <sphereGeometry args={[0.55, 16, 12]} />
          <Paint color={body} rough={0.25} metal={0.1} finish={finish} />
        </mesh>
        <mesh position={[0, 0.85, 2.05]} scale={[1, 0.45, 1]}>
          <sphereGeometry args={[0.32, 12, 8]} />
          <meshStandardMaterial color="#ff8a1f" roughness={0.4} />
        </mesh>
        {[-0.24, 0.24].map((x) => (
          <mesh key={x} position={[x, 1.12, 1.92]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshBasicMaterial color="#111827" />
          </mesh>
        ))}
        <mesh position={[0, -0.12, -0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.3, 1.75, 26]} />
          <meshBasicMaterial color={g} transparent opacity={0.3} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    );
  return null;
}

// ---------------------------------------------------------------------------
// AIRCRAFT: helicopter, blimp, flying saucer
// ---------------------------------------------------------------------------
export function Plane3({ kind, body, decal, glow, finish }: C & { kind: PlaneId }) {
  const rotor = useRef<THREE.Group>(null);
  const tailRotor = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (rotor.current) rotor.current.rotation.y += dt * 26;
    if (tailRotor.current) tailRotor.current.rotation.x += dt * 34;
    if (ring.current) ring.current.rotation.y += dt * 2.4;
  });
  const g = glow ?? "#ffd166";
  if (kind === "heli")
    return (
      <group>
        {/* mast and rotor over the kart, skids under it, a boom out the back */}
        <mesh position={[0, 1.75, -0.15]}>
          <cylinderGeometry args={[0.07, 0.1, 0.7, 8]} />
          <Metal />
        </mesh>
        <group ref={rotor} position={[0, 2.12, -0.15]}>
          {[0, 1].map((k) => (
            <mesh key={k} rotation={[0, (k * Math.PI) / 2, 0]}>
              <boxGeometry args={[4.4, 0.04, 0.22]} />
              <meshStandardMaterial color="#eaf6ff" transparent opacity={0.6} />
            </mesh>
          ))}
          <mesh>
            <sphereGeometry args={[0.16, 10, 8]} />
            <Neon color={g} i={2.4} />
          </mesh>
        </group>
        <mesh position={[0, 0.85, -1.9]} rotation={[Math.PI / 2 - 0.08, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.24, 2.2, 8]} />
          <Paint color={body} finish={finish} />
        </mesh>
        <mesh position={[0, 1.25, -2.9]}>
          <boxGeometry args={[0.08, 0.9, 0.5]} />
          <Paint color={decal} finish={finish} />
        </mesh>
        <group ref={tailRotor} position={[0.12, 1.2, -2.9]}>
          <mesh>
            <boxGeometry args={[0.03, 0.9, 0.12]} />
            <meshStandardMaterial color="#eaf6ff" transparent opacity={0.7} />
          </mesh>
        </group>
        {[-0.85, 0.85].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 2.8, 8]} />
              <Metal />
            </mesh>
            {[-0.7, 0.7].map((z) => (
              <mesh key={z} position={[x * 0.85, 0.3, z]} rotation={[0, 0, x > 0 ? -0.5 : 0.5]}>
                <cylinderGeometry args={[0.04, 0.04, 0.55, 6]} />
                <Metal />
              </mesh>
            ))}
          </group>
        ))}
        <mesh position={[0, 1.0, 0.25]} scale={[1.05, 0.85, 1.25]}>
          <sphereGeometry args={[0.95, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <Glass opacity={0.22} />
        </mesh>
      </group>
    );
  if (kind === "blimp")
    return (
      <group>
        {/* the envelope rides above the kart, which hangs from it as the gondola */}
        <mesh position={[0, 2.25, -0.2]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.9]} castShadow>
          <capsuleGeometry args={[0.85, 2.6, 8, 18]} />
          <Paint color={body} rough={0.3} metal={0.3} finish={finish} />
        </mesh>
        {[-0.7, 0.4].map((z) => (
          <mesh key={z} position={[0, 2.25, z]} rotation={[0, 0, 0]} scale={[1, 0.9, 1]}>
            <torusGeometry args={[0.87, 0.045, 6, 24]} />
            <Neon color={decal} i={1.8} />
          </mesh>
        ))}
        {[0, 1, 2, 3].map((k) => (
          <mesh key={k} position={[Math.sin((k * Math.PI) / 2) * 0.75, 2.25 + Math.cos((k * Math.PI) / 2) * 0.68, -2.0]} rotation={[0, 0, (-k * Math.PI) / 2]}>
            <boxGeometry args={[0.06, 0.7, 0.7]} />
            <Paint color={decal} finish={finish} />
          </mesh>
        ))}
        {[-0.5, 0.5].map((x) =>
          [-0.7, 0.6].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 1.45, z]}>
              <cylinderGeometry args={[0.025, 0.025, 0.9, 5]} />
              <Metal />
            </mesh>
          ))
        )}
        {[-1.05, 1.05].map((x) => (
          <group key={x} position={[x, 1.55, -0.6]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.2, 0.2, 0.5, 10]} />
              <Metal />
            </mesh>
            <mesh position={[0, 0, -0.28]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.15, 0.15, 0.06, 10]} />
              <Neon color={g} i={3} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 2.25, 1.75]}>
          <sphereGeometry args={[0.14, 10, 8]} />
          <Neon color={g} i={3} />
        </mesh>
      </group>
    );
  if (kind === "saucer")
    return (
      <group>
        <mesh position={[0, 0.5, 0]} scale={[1, 0.2, 1]} castShadow>
          <sphereGeometry args={[1.75, 24, 12]} />
          <Paint color={body} rough={0.1} metal={0.8} finish={finish} />
        </mesh>
        <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.73, 0.08, 8, 36]} />
          <Neon color={decal} i={2.6} />
        </mesh>
        <group ref={ring} position={[0, 0.3, 0]}>
          {Array.from({ length: 8 }, (_, k) => (
            <mesh key={k} position={[Math.sin((k * Math.PI) / 4) * 1.25, 0, Math.cos((k * Math.PI) / 4) * 1.25]}>
              <sphereGeometry args={[0.14, 8, 8]} />
              <Neon color={k % 2 ? g : "#ffffff"} i={3.2} />
            </mesh>
          ))}
        </group>
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.9, 20]} />
          <meshBasicMaterial color={g} transparent opacity={0.45} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.85, 0]} scale={[1, 0.8, 1]}>
          <sphereGeometry args={[1.05, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Glass opacity={0.2} />
        </mesh>
      </group>
    );
  return null;
}

// ---------------------------------------------------------------------------
// SUBMARINES: manta ray, squid, bathysphere, torpedo
// ---------------------------------------------------------------------------
export function Sub3({ kind, body, decal, glow, finish }: C & { kind: SubId }) {
  const flapL = useRef<THREE.Group>(null);
  const flapR = useRef<THREE.Group>(null);
  const arms = useRef<THREE.Group>(null);
  const prop = useRef<THREE.Group>(null);
  const prop2 = useRef<THREE.Group>(null);
  useFrame((s, dt) => {
    const w = Math.sin(s.clock.elapsedTime * 3.4);
    if (flapL.current) flapL.current.rotation.z = 0.12 + w * 0.3;
    if (flapR.current) flapR.current.rotation.z = -0.12 - w * 0.3;
    if (arms.current) {
      arms.current.children.forEach((c, k) => {
        c.rotation.x = Math.sin(s.clock.elapsedTime * 4 + k * 0.9) * 0.22;
        c.rotation.y = Math.cos(s.clock.elapsedTime * 3 + k * 1.3) * 0.16;
      });
    }
    if (prop.current) prop.current.rotation.z += dt * 20;
    if (prop2.current) prop2.current.rotation.z -= dt * 20;
  });
  const g = glow ?? "#7de1ff";
  // every hull keeps the pilot's bubble in the same place
  const dome = (
    <mesh position={[0, 1.0, 0.1]} scale={[0.82, 0.7, 0.95]}>
      <sphereGeometry args={[0.8, 18, 14]} />
      <Glass opacity={0.28} />
    </mesh>
  );
  if (kind === "manta")
    return (
      <group>
        <mesh position={[0, 0.25, 0.1]} scale={[1, 0.42, 1.5]} castShadow>
          <sphereGeometry args={[1.0, 18, 12]} />
          <Paint color={body} metal={0.4} rough={0.2} finish={finish} />
        </mesh>
        <mesh position={[0, 0.1, 0.2]} scale={[0.85, 0.3, 1.35]}>
          <sphereGeometry args={[1.0, 14, 10]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.35} />
        </mesh>
        {/* wings that beat */}
        <group ref={flapL} position={[-0.7, 0.28, 0]}>
          <mesh position={[-1.05, 0, -0.1]} rotation={[0, Math.PI / 2 + 0.2, 0]} scale={[0.8, 1, 1.15]}>
            <cylinderGeometry args={[1.2, 1.2, 0.1, 3]} />
            <Paint color={body} metal={0.4} rough={0.2} finish={finish} />
          </mesh>
          <mesh position={[-2.0, 0.02, -0.45]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <Neon color={g} i={3} />
          </mesh>
        </group>
        <group ref={flapR} position={[0.7, 0.28, 0]}>
          <mesh position={[1.05, 0, -0.1]} rotation={[0, -Math.PI / 2 - 0.2, 0]} scale={[0.8, 1, 1.15]}>
            <cylinderGeometry args={[1.2, 1.2, 0.1, 3]} />
            <Paint color={body} metal={0.4} rough={0.2} finish={finish} />
          </mesh>
          <mesh position={[2.0, 0.02, -0.45]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <Neon color={g} i={3} />
          </mesh>
        </group>
        {/* the two horns at the mouth and the whip of a tail */}
        {[-0.45, 0.45].map((x) => (
          <mesh key={x} position={[x, 0.2, 1.7]} rotation={[Math.PI / 2, 0, x > 0 ? -0.25 : 0.25]}>
            <coneGeometry args={[0.14, 0.7, 6]} />
            <Paint color={decal} finish={finish} />
          </mesh>
        ))}
        <mesh position={[0, 0.25, -2.3]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.1, 2.0, 6]} />
          <Paint color={decal} finish={finish} />
        </mesh>
        <mesh position={[0, 0.45, 0.1]} scale={[0.25, 0.05, 1.3]}>
          <sphereGeometry args={[1, 10, 8]} />
          <Neon color={decal} i={2} />
        </mesh>
        {dome}
      </group>
    );
  if (kind === "squid")
    return (
      <group>
        {/* the mantle goes first, the arms trail */}
        <mesh position={[0, 0.25, 0.75]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.95]} castShadow>
          <coneGeometry args={[0.85, 2.6, 14]} />
          <Paint color={body} metal={0.35} rough={0.2} finish={finish} />
        </mesh>
        <mesh position={[0, 0.25, -0.7]} scale={[1, 0.95, 0.7]}>
          <sphereGeometry args={[0.86, 14, 12]} />
          <Paint color={body} metal={0.35} rough={0.2} finish={finish} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[s * 0.75, 0.3, 1.45]} rotation={[0, s * 0.5, 0]} scale={[1, 1, 0.8]}>
              <cylinderGeometry args={[0.6, 0.6, 0.08, 3]} />
              <Paint color={decal} finish={finish} />
            </mesh>
            <mesh position={[s * 0.62, 0.4, -0.55]}>
              <sphereGeometry args={[0.2, 10, 10]} />
              <meshBasicMaterial color="#ffffff" toneMapped={false} />
            </mesh>
            <mesh position={[s * 0.76, 0.4, -0.5]}>
              <sphereGeometry args={[0.1, 8, 8]} />
              <meshBasicMaterial color="#111827" />
            </mesh>
          </group>
        ))}
        <group ref={arms} position={[0, 0.2, -1.2]}>
          {Array.from({ length: 6 }, (_, k) => {
            const a = (k / 6) * Math.PI * 2;
            return (
              <group key={k} position={[Math.cos(a) * 0.4, Math.sin(a) * 0.32, 0]}>
                <mesh position={[0, 0, -0.75]} rotation={[-Math.PI / 2, 0, 0]}>
                  <coneGeometry args={[0.13, 1.6, 6]} />
                  <Paint color={k % 2 ? decal : body} finish={finish} />
                </mesh>
                <mesh position={[0, 0, -1.5]}>
                  <sphereGeometry args={[0.07, 6, 6]} />
                  <Neon color={g} i={3} />
                </mesh>
              </group>
            );
          })}
        </group>
        {[0.2, 0.9, 1.5].map((z, k) => (
          <mesh key={z} position={[0, 0.25, z]} rotation={[0, 0, 0]} scale={[1 - k * 0.27, 1 - k * 0.27, 1]}>
            <torusGeometry args={[0.78, 0.04, 6, 20]} />
            <Neon color={decal} i={1.8} />
          </mesh>
        ))}
        {dome}
      </group>
    );
  if (kind === "bathy")
    return (
      <group>
        {/* a pressure sphere in a frame, with floats above and lamps in front */}
        <mesh position={[0, 0.15, 0.1]} castShadow>
          <sphereGeometry args={[1.05, 20, 16]} />
          <Paint color={body} metal={0.7} rough={0.25} finish={finish} />
        </mesh>
        {[
          [0, 0.15, 1.12, 0, 0],
          [1.03, 0.15, 0.3, 0, Math.PI / 2],
          [-1.03, 0.15, 0.3, 0, Math.PI / 2],
        ].map(([x, y, z, rx, ry], k) => (
          <group key={k} position={[x, y, z]} rotation={[rx, ry, 0]}>
            <mesh>
              <torusGeometry args={[0.36, 0.08, 8, 18]} />
              <Metal color="#cbd5e1" />
            </mesh>
            <mesh>
              <circleGeometry args={[0.34, 16]} />
              <meshBasicMaterial color={g} transparent opacity={0.5} toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
        {[-0.8, 0.8].map((x) => (
          <group key={x}>
            <mesh position={[x * 1.5, 0.75, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
              <capsuleGeometry args={[0.28, 1.5, 6, 10]} />
              <Paint color={decal} finish={finish} />
            </mesh>
            <mesh position={[x * 1.2, -0.85, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.07, 0.07, 2.4, 8]} />
              <Metal />
            </mesh>
            <mesh position={[x * 1.1, -0.4, 0.1]} rotation={[0, 0, x > 0 ? -0.3 : 0.3]}>
              <cylinderGeometry args={[0.05, 0.05, 1.0, 6]} />
              <Metal />
            </mesh>
            <mesh position={[x * 0.75, -0.4, 1.1]}>
              <sphereGeometry args={[0.17, 10, 8]} />
              <Neon color="#fff7c2" i={3.4} />
            </mesh>
          </group>
        ))}
        <group ref={prop} position={[0, 0.15, -1.3]}>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} rotation={[0, 0, (k * Math.PI) / 2]}>
              <boxGeometry args={[0.14, 0.9, 0.05]} />
              <Metal color="#cbd5e1" />
            </mesh>
          ))}
        </group>
        <mesh position={[0, 0.15, -1.3]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.5, 0.05, 6, 18]} />
          <Metal />
        </mesh>
        {dome}
      </group>
    );
  if (kind === "torpedo")
    return (
      <group>
        {/* long, thin and in a hurry: two screws turning against each other */}
        <mesh position={[0, 0.1, 0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <capsuleGeometry args={[0.58, 3.3, 8, 16]} />
          <Paint color={body} metal={0.75} rough={0.12} finish={finish} />
        </mesh>
        <mesh position={[0, 0.1, 2.05]} rotation={[Math.PI / 2, 0, 0]}>
          <sphereGeometry args={[0.5, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Neon color={decal} i={1.6} />
        </mesh>
        {[1.0, 0.0, -1.0].map((z) => (
          <mesh key={z} position={[0, 0.1, z]}>
            <torusGeometry args={[0.6, 0.04, 6, 20]} />
            <Neon color={g} i={2.2} />
          </mesh>
        ))}
        {[0, 1, 2, 3].map((k) => (
          <mesh key={k} position={[Math.sin((k * Math.PI) / 2) * 0.7, 0.1 + Math.cos((k * Math.PI) / 2) * 0.7, -1.55]} rotation={[0, 0, (-k * Math.PI) / 2]}>
            <boxGeometry args={[0.06, 0.6, 0.7]} />
            <Paint color={decal} finish={finish} />
          </mesh>
        ))}
        <group ref={prop} position={[0, 0.1, -2.1]}>
          {[0, 1, 2].map((k) => (
            <mesh key={k} rotation={[0, 0, (k * Math.PI * 2) / 3]}>
              <boxGeometry args={[0.12, 0.85, 0.05]} />
              <Metal color="#cbd5e1" />
            </mesh>
          ))}
        </group>
        <group ref={prop2} position={[0, 0.1, -2.3]}>
          {[0, 1, 2].map((k) => (
            <mesh key={k} rotation={[0, 0, (k * Math.PI * 2) / 3]}>
              <boxGeometry args={[0.1, 0.7, 0.05]} />
              <Metal color="#cbd5e1" />
            </mesh>
          ))}
        </group>
        {dome}
      </group>
    );
  return null;
}
