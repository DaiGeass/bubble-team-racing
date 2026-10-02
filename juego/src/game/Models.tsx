import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BoatId, PlaneId, ShapeId, SubId } from "../data";

interface C {
  body: string;
  decal: string;
  glow?: string;
}

/** Clear liquid-glass material used for canopies, windows and bubbles. */
function Glass({ color = "#dff6ff", opacity = 0.38 }: { color?: string; opacity?: number }) {
  return (
    <meshPhysicalMaterial
      color={color}
      transparent
      opacity={opacity}
      roughness={0.03}
      metalness={0.1}
      clearcoat={1}
      clearcoatRoughness={0.04}
      iridescence={0.6}
      depthWrite={false}
    />
  );
}

function Paint({ color, metal = 0.55, rough = 0.14 }: { color: string; metal?: number; rough?: number }) {
  return <meshStandardMaterial color={color} roughness={rough} metalness={metal} />;
}

function Neon({ color, i = 2.4 }: { color: string; i?: number }) {
  return <meshStandardMaterial color={color} emissive={color} emissiveIntensity={i} toneMapped={false} />;
}

/** Underglow plane gives every vehicle a soft aero light puddle. */
function Underglow({ color, w = 1.2, l = 2.3, y = 0.2 }: { color: string; w?: number; l?: number; y?: number }) {
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, l]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// NEW LAND CHASSIS: coupe, glass van, formula, bubble car
// ---------------------------------------------------------------------------
export function ExtraShapes({ shape, body, decal, glow }: C & { shape: ShapeId }) {
  const g = glow ?? "#7de1ff";
  if (shape === "coupe")
    return (
      <>
        <mesh position={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[1.25, 0.3, 2.5]} />
          <Paint color={body} metal={0.7} rough={0.1} />
        </mesh>
        <mesh position={[0, 0.42, 1.45]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.62, 0.95, 4]} />
          <Paint color={body} metal={0.7} rough={0.1} />
        </mesh>
        <mesh position={[0, 0.82, -0.15]} scale={[0.62, 0.34, 0.95]}>
          <sphereGeometry args={[1, 18, 14]} />
          <Glass />
        </mesh>
        <mesh position={[0, 0.6, -1.25]}>
          <boxGeometry args={[1.15, 0.09, 0.5]} />
          <Paint color={decal} />
        </mesh>
        <mesh position={[0, 0.55, 0.1]}>
          <boxGeometry args={[0.18, 0.04, 2.3]} />
          <Neon color={g} i={1.8} />
        </mesh>
        <Underglow color={g} w={1.1} l={2.4} />
      </>
    );
  if (shape === "van")
    return (
      <>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[1.5, 0.5, 2.4]} />
          <Paint color={body} metal={0.35} rough={0.25} />
        </mesh>
        {/* glass greenhouse so the pilot is visible */}
        <mesh position={[0, 1.05, -0.05]}>
          <boxGeometry args={[1.38, 0.65, 1.6]} />
          <Glass opacity={0.3} />
        </mesh>
        <mesh position={[0, 1.4, -0.05]}>
          <boxGeometry args={[1.5, 0.08, 1.75]} />
          <Paint color={decal} />
        </mesh>
        {[-0.68, 0.68].map((x) =>
          [-0.75, 0.75].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 1.05, z - 0.05]}>
              <boxGeometry args={[0.07, 0.65, 0.07]} />
              <Paint color={decal} />
            </mesh>
          ))
        )}
        <mesh position={[0, 0.55, 1.22]}>
          <boxGeometry args={[1.2, 0.18, 0.1]} />
          <Neon color={g} i={2} />
        </mesh>
        <Underglow color={g} w={1.3} l={2.5} />
      </>
    );
  if (shape === "formula")
    return (
      <>
        <mesh position={[0, 0.52, 0.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <capsuleGeometry args={[0.38, 2.1, 6, 12]} />
          <Paint color={body} metal={0.65} rough={0.1} />
        </mesh>
        {[-0.62, 0.62].map((x) => (
          <mesh key={x} position={[x, 0.5, 0]}>
            <boxGeometry args={[0.34, 0.26, 1.2]} />
            <Paint color={decal} />
          </mesh>
        ))}
        <mesh position={[0, 0.4, 1.7]}>
          <boxGeometry args={[2.0, 0.06, 0.42]} />
          <Paint color={decal} metal={0.7} />
        </mesh>
        <mesh position={[0, 0.98, -1.1]}>
          <boxGeometry args={[1.5, 0.08, 0.4]} />
          <Neon color={g} i={1.6} />
        </mesh>
        <mesh position={[0, 1.05, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.32, 0.04, 6, 16, Math.PI]} />
          <Paint color={decal} />
        </mesh>
      </>
    );
  if (shape === "mono") {
    return (
      <>
        <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <capsuleGeometry args={[0.5, 2.1, 8, 16]} />
          <Paint color={body} metal={0.75} rough={0.08} />
        </mesh>
        <mesh position={[0, 0.88, -0.3]}>
          <sphereGeometry args={[0.52, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
          <Glass opacity={0.3} />
        </mesh>
        <mesh position={[0, 0.4, 1.55]}>
          <boxGeometry args={[1.6, 0.07, 0.5]} />
          <Paint color={decal} metal={0.7} />
        </mesh>
        <mesh position={[0, 1.0, -1.15]}>
          <boxGeometry args={[1.8, 0.09, 0.5]} />
          <Neon color={g} i={2} />
        </mesh>
        <Underglow color={g} w={1.2} l={2.6} y={0.15} />
      </>
    );
  }
  if (shape === "bubble")
    return (
      <>
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[1.05, 1.15, 0.34, 24]} />
          <Paint color={body} metal={0.5} rough={0.12} />
        </mesh>
        <mesh position={[0, 0.9, 0]}>
          <sphereGeometry args={[1.12, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <Glass opacity={0.3} />
        </mesh>
        <mesh position={[0, 0.58, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.08, 0.07, 8, 28]} />
          <Neon color={decal} i={1.8} />
        </mesh>
        <mesh position={[-0.35, 1.5, 0.45]} scale={[1, 0.5, 0.5]}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.85} toneMapped={false} />
        </mesh>
        <Underglow color={g} w={2.1} l={2.1} />
      </>
    );
  if (shape === "tank") {
    // tracked crawler: two tread blocks, sloped hull, rotating turret
    const rot = useRef<THREE.Group>(null);
    useFrame((_, dt) => {
      if (rot.current) rot.current.rotation.y += dt * 0.7;
    });
    return (
      <>
        {[-0.86, 0.86].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.42, 0]} castShadow>
              <boxGeometry args={[0.52, 0.72, 2.7]} />
              <meshStandardMaterial color="#2b2f3a" roughness={0.75} metalness={0.35} />
            </mesh>
            {[-1.05, -0.35, 0.35, 1.05].map((z) => (
              <mesh key={z} position={[x, 0.1, z]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.2, 0.2, 0.6, 8]} />
                <meshStandardMaterial color="#3b4250" roughness={0.6} metalness={0.5} />
              </mesh>
            ))}
          </group>
        ))}
        <mesh position={[0, 0.62, -0.1]} rotation={[0.12, 0, 0]} castShadow>
          <boxGeometry args={[1.5, 0.5, 2.5]} />
          <Paint color={body} metal={0.5} rough={0.32} />
        </mesh>
        <mesh position={[0, 0.98, 0.55]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[1.32, 0.06, 0.9]} />
          <Paint color={decal} metal={0.6} />
        </mesh>
        <group ref={rot} position={[0, 1.05, -0.35]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.46, 0.56, 0.42, 12]} />
            <Paint color={decal} metal={0.7} rough={0.18} />
          </mesh>
          <mesh position={[0, 0.02, 1.05]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.11, 0.13, 1.7, 10]} />
            <meshStandardMaterial color="#2b2f3a" roughness={0.4} metalness={0.8} />
          </mesh>
          <mesh position={[0, 0.34, -0.1]}>
            <boxGeometry args={[0.9, 0.16, 0.5]} />
            <Neon color={g} i={1.4} />
          </mesh>
        </group>
        <Underglow color={g} w={1.6} l={2.6} y={0.05} />
      </>
    );
  }
  if (shape === "wedge") {
    // wide flat delta: maximum grip, minimum drag
    return (
      <>
        <mesh position={[0, 0.32, 0]} rotation={[0, 0, 0]} castShadow>
          <boxGeometry args={[2.7, 0.16, 2.5]} />
          <Paint color={body} metal={0.68} rough={0.1} />
        </mesh>
        <mesh position={[0, 0.44, 0.75]} rotation={[0.22, 0, 0]}>
          <boxGeometry args={[1.5, 0.1, 1.3]} />
          <Paint color={decal} metal={0.5} />
        </mesh>
        <mesh position={[0, 0.62, -0.25]} scale={[1, 0.42, 1.05]}>
          <sphereGeometry args={[0.78, 18, 12]} />
          <Glass opacity={0.3} />
        </mesh>
        {[-1.28, 1.28].map((x) => (
          <mesh key={x} position={[x, 0.42, 0.1]} rotation={[0, 0, x > 0 ? -0.32 : 0.32]}>
            <boxGeometry args={[0.09, 0.09, 2.2]} />
            <Neon color={g} i={2.8} />
          </mesh>
        ))}
        <mesh position={[0, 0.26, -1.32]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[2.2, 0.08, 0.5]} />
          <Paint color={decal} metal={0.72} />
        </mesh>
        <Underglow color={g} w={2.4} l={2.4} y={0.12} />
      </>
    );
  }
  if (shape === "sled") {
    // ice sled: long body, twin skis, exposed engine block
    return (
      <>
        <mesh position={[0, 0.44, -0.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <capsuleGeometry args={[0.42, 2.3, 6, 14]} />
          <Paint color={body} metal={0.72} rough={0.12} />
        </mesh>
        {[-0.62, 0.62].map((x) => (
          <mesh key={x} position={[x, 0.16, 1.15]} rotation={[0.06, 0, 0]}>
            <boxGeometry args={[0.22, 0.14, 1.5]} />
            <meshStandardMaterial color="#e8f4ff" roughness={0.25} metalness={0.5} />
          </mesh>
        ))}
        <mesh position={[0, 0.86, -0.72]} rotation={[0.28, 0, 0]}>
          <boxGeometry args={[0.86, 0.62, 0.7]} />
          <meshStandardMaterial color="#2b2f3a" roughness={0.45} metalness={0.7} />
        </mesh>
        {[-0.24, 0.24].map((x) => (
          <mesh key={x} position={[x, 1.02, -0.86]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.1, 0.12, 0.34, 8]} />
            <Neon color={g} i={3} />
          </mesh>
        ))}
        <mesh position={[0, 0.62, 0.55]} scale={[0.7, 0.5, 1]}>
          <sphereGeometry args={[0.6, 16, 12]} />
          <Glass opacity={0.42} />
        </mesh>
        <Underglow color={g} w={1.3} l={2.7} y={0.1} />
      </>
    );
  }
  if (shape === "orbit") {
    // orbital module: sphere core plus two counter-rotating rings
    const ring1 = useRef<THREE.Mesh>(null);
    const ring2 = useRef<THREE.Mesh>(null);
    useFrame((_, dt) => {
      if (ring1.current) ring1.current.rotation.z += dt * 1.1;
      if (ring2.current) ring2.current.rotation.x -= dt * 0.8;
    });
    return (
      <>
        <mesh position={[0, 0.72, 0]} castShadow>
          <sphereGeometry args={[0.82, 22, 16]} />
          <meshStandardMaterial color={body} roughness={0.18} metalness={0.6} />
        </mesh>
        <mesh ref={ring1} position={[0, 0.72, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.28, 0.09, 10, 28]} />
          <Paint color={decal} metal={0.8} rough={0.1} />
        </mesh>
        <mesh ref={ring2} position={[0, 0.72, 0]} rotation={[0, 0, 0.5]}>
          <torusGeometry args={[1.02, 0.06, 8, 24]} />
          <Neon color={g} i={3.2} />
        </mesh>
        <mesh position={[0, 0.72, 0.72]} scale={[1, 0.6, 0.5]}>
          <sphereGeometry args={[0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <Glass opacity={0.4} />
        </mesh>
        <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.5, 0.6, 12, 1, true]} />
          <Neon color={g} i={2} />
        </mesh>
        <Underglow color={g} w={2.2} l={2.2} y={0.14} />
      </>
    );
  }
  if (shape === "dune") {
    // desert buggy: open tube cage and a very long rear wing
    return (
      <>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[1.5, 0.42, 2.9]} />
          <Paint color={body} metal={0.35} rough={0.45} />
        </mesh>
        {[-0.66, 0.66].map((x) => (
          <group key={x}>
            <mesh position={[x, 1.02, 0.35]} rotation={[0.42, 0, 0]}>
              <boxGeometry args={[0.09, 1.05, 0.09]} />
              <meshStandardMaterial color="#2b2f3a" roughness={0.5} metalness={0.6} />
            </mesh>
            <mesh position={[x, 1.28, -0.5]}>
              <boxGeometry args={[0.09, 0.62, 0.09]} />
              <meshStandardMaterial color="#2b2f3a" roughness={0.5} metalness={0.6} />
            </mesh>
            <mesh position={[x, 1.5, -0.16]} rotation={[0, 0, 0]}>
              <boxGeometry args={[0.09, 0.09, 1.4]} />
              <Paint color={decal} metal={0.6} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 1.28, 0.05]} rotation={[0.42, 0, 0]}>
          <boxGeometry args={[1.2, 0.06, 1.3]} />
          <Glass opacity={0.24} />
        </mesh>
        <mesh position={[0, 1.05, -1.6]} rotation={[0.22, 0, 0]}>
          <boxGeometry args={[2.4, 0.1, 0.62]} />
          <Paint color={decal} metal={0.55} />
        </mesh>
        {[-1.1, 1.1].map((x) => (
          <mesh key={x} position={[x, 0.86, -1.5]}>
            <boxGeometry args={[0.1, 0.42, 0.5]} />
            <Neon color={g} i={2.2} />
          </mesh>
        ))}
        <mesh position={[0, 0.72, 1.35]}>
          <boxGeometry args={[0.9, 0.24, 0.24]} />
          <Neon color={g} i={3} />
        </mesh>
        <Underglow color={g} w={1.9} l={3} y={0.08} />
      </>
    );
  }
  if (shape === "phantom") {
    // hover shell: translucent body floating over two light rings
    return (
      <>
        <mesh position={[0, 0.68, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <capsuleGeometry args={[0.6, 1.7, 8, 18]} />
          <Glass color="#e8fbff" opacity={0.32} />
        </mesh>
        <mesh position={[0, 0.68, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.82, 0.82, 1.1]}>
          <capsuleGeometry args={[0.6, 1.7, 6, 14]} />
          <Paint color={body} metal={0.3} rough={0.5} />
        </mesh>
        {[-0.9, 0.9].map((x) => (
          <mesh key={x} position={[x, 0.36, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.44, 0.08, 8, 20]} />
            <Neon color={g} i={3.4} />
          </mesh>
        ))}
        <mesh position={[0, 1.24, -0.2]} scale={[0.9, 0.45, 1]}>
          <sphereGeometry args={[0.6, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <Glass opacity={0.36} />
        </mesh>
        <mesh position={[0, 0.68, 1.02]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[1.3, 0.07, 0.4]} />
          <Neon color={decal} i={2.4} />
        </mesh>
        <Underglow color={g} w={2.3} l={2.1} y={0.24} />
      </>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// BOATS (the default "cat" catamaran lives in Vehicle.tsx)
// ---------------------------------------------------------------------------
export function BoatAlt({ kind, body, decal, glow }: C & { kind: BoatId }) {
  const g = glow ?? "#4fd8e8";
  if (kind === "speed")
    return (
      <group>
        <mesh position={[0, 0.0, 0.25]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.4, 0.5]} castShadow>
          <capsuleGeometry args={[0.8, 2.2, 6, 14]} />
          <meshStandardMaterial color="#ffffff" roughness={0.12} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.2, 0.2]} rotation={[Math.PI / 2, 0, 0]} scale={[0.62, 1.38, 0.3]}>
          <capsuleGeometry args={[0.8, 2.2, 6, 14]} />
          <Paint color={body} metal={0.4} />
        </mesh>
        <mesh position={[0, 0.7, 1.0]} rotation={[-0.7, 0, 0]}>
          <boxGeometry args={[0.95, 0.55, 0.05]} />
          <Glass />
        </mesh>
        <mesh position={[0, 0.5, -1.85]}>
          <boxGeometry args={[0.5, 0.6, 0.5]} />
          <meshStandardMaterial color="#2b2f3a" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.2, -2.1]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.28, 0.3, 10]} />
          <Neon color={g} i={2.6} />
        </mesh>
        <mesh position={[0, 0.25, 1.95]} rotation={[0.9, 0, 0]}>
          <coneGeometry args={[0.3, 0.7, 4]} />
          <meshStandardMaterial color="#ffffff" roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.42, 0.2]}>
          <boxGeometry args={[0.1, 0.04, 2.4]} />
          <Neon color={decal} i={1.6} />
        </mesh>
      </group>
    );
  if (kind === "ski")
    return (
      <group>
        <mesh position={[0, 0.1, 0.1]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.55]} castShadow>
          <capsuleGeometry args={[0.55, 1.8, 6, 12]} />
          <Paint color={body} metal={0.4} rough={0.1} />
        </mesh>
        <mesh position={[0, 0.5, -0.45]}>
          <boxGeometry args={[0.55, 0.25, 1.1]} />
          <Paint color={decal} metal={0.2} rough={0.5} />
        </mesh>
        <mesh position={[0, 0.9, 0.75]} rotation={[0.3, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.06, 0.7, 6]} />
          <meshStandardMaterial color="#2b2f3a" />
        </mesh>
        <mesh position={[0, 1.22, 0.85]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 0.9, 6]} />
          <meshStandardMaterial color="#2b2f3a" />
        </mesh>
        {[-0.62, 0.62].map((x) => (
          <mesh key={x} position={[x, 0.18, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.16, 1.6, 4, 8]} />
            <Neon color={g} i={2} />
          </mesh>
        ))}
        <mesh position={[0, 0.2, -1.35]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.24, 0.3, 0.3, 10]} />
          <Neon color="#ffffff" i={1.6} />
        </mesh>
      </group>
    );
  return null;
}

// ---------------------------------------------------------------------------
// PLANES (default "wing" lives in Vehicle.tsx)
// ---------------------------------------------------------------------------
export function PlaneAlt({ kind, body, decal, glow }: C & { kind: PlaneId }) {
  const prop = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (prop.current) prop.current.rotation.z += dt * 34;
  });
  const g = glow ?? "#ffd166";
  const delta = (() => {
    const s = new THREE.Shape();
    s.moveTo(0, 1.7);
    s.lineTo(-2.0, -0.8);
    s.lineTo(0, -0.4);
    s.lineTo(2.0, -0.8);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: false });
  })();

  if (kind === "bi")
    return (
      <group>
        <mesh position={[0, 0.65, -0.1]} castShadow>
          <boxGeometry args={[3.4, 0.08, 0.7]} />
          <Paint color={decal} metal={0.3} rough={0.25} />
        </mesh>
        <mesh position={[0, 1.7, -0.1]} castShadow>
          <boxGeometry args={[3.4, 0.08, 0.7]} />
          <Paint color={body} metal={0.3} rough={0.25} />
        </mesh>
        {[-1.2, 1.2].map((x) => (
          <mesh key={x} position={[x, 1.18, -0.1]}>
            <cylinderGeometry args={[0.04, 0.04, 1.08, 6]} />
            <meshStandardMaterial color="#2b2f3a" />
          </mesh>
        ))}
        {[-1.7, 1.7].map((x) => (
          <mesh key={x} position={[x, 1.7, -0.1]}>
            <boxGeometry args={[0.08, 0.1, 0.72]} />
            <Neon color={g} i={2} />
          </mesh>
        ))}
        <mesh position={[0, 0.95, -1.3]}>
          <boxGeometry args={[0.12, 0.9, 0.4]} />
          <Paint color={body} />
        </mesh>
        <mesh position={[0, 0.55, -1.3]}>
          <boxGeometry args={[1.2, 0.07, 0.34]} />
          <Paint color={decal} />
        </mesh>
        <mesh ref={prop} position={[0, 0.7, 1.5]}>
          <boxGeometry args={[1.9, 0.09, 0.12]} />
          <meshStandardMaterial color="#eaf6ff" transparent opacity={0.55} toneMapped={false} />
        </mesh>
      </group>
    );
  if (kind === "delta")
    return (
      <group>
        <mesh geometry={delta} position={[0, 0.7, -0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <Paint color={body} metal={0.7} rough={0.1} />
        </mesh>
        <mesh geometry={delta} position={[0, 0.76, -0.2]} rotation={[Math.PI / 2, 0, 0]} scale={[0.82, 0.82, 0.3]}>
          <Neon color={decal} i={1.4} />
        </mesh>
        {[-1.55, 1.55].map((x) => (
          <mesh key={x} position={[x, 1.0, -0.95]} rotation={[0, 0, x > 0 ? -0.2 : 0.2]}>
            <boxGeometry args={[0.08, 0.7, 0.5]} />
            <Neon color={g} i={2.2} />
          </mesh>
        ))}
        <mesh position={[0, 0.7, -1.0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.38, 0.4, 12]} />
          <Neon color="#ffffff" i={2.6} />
        </mesh>
      </group>
    );
  return null;
}

// ---------------------------------------------------------------------------
// SUBMARINES: classic, glass pod, shark
// ---------------------------------------------------------------------------
export function SubModel({ kind, body, decal, glow }: C & { kind: SubId }) {
  const rot = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  useFrame((s, dt) => {
    if (rot.current) rot.current.rotation.z += dt * 18;
    if (tail.current) tail.current.rotation.y = Math.sin(s.clock.elapsedTime * 5) * 0.35;
  });
  const g = glow ?? "#7de1ff";

  if (kind === "pod")
    return (
      <group>
        <mesh position={[0, 0.62, 0]}>
          <sphereGeometry args={[1.12, 24, 18]} />
          <Glass color="#bff4ff" opacity={0.28} />
        </mesh>
        <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.08, 0.13, 10, 28]} />
          <Paint color={body} />
        </mesh>
        <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.08, 0.05, 8, 28]} />
          <Neon color={decal} i={2.4} />
        </mesh>
        {[-1.2, 1.2].map((x) => (
          <group key={x} position={[x, 0.3, -0.2]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.18, 0.22, 0.6, 10]} />
              <meshStandardMaterial color="#2b2f3a" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0, -0.34]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.13, 0.13, 0.08, 8]} />
              <Neon color={g} i={3} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 1.75, 0]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <Neon color={g} i={3} />
        </mesh>
      </group>
    );
  if (kind === "shark")
    return (
      <group>
        <mesh position={[0, 0.08, 0.1]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.8]} castShadow>
          <capsuleGeometry args={[0.8, 2.5, 8, 16]} />
          <Paint color={body} metal={0.45} rough={0.14} />
        </mesh>
        <mesh position={[0, -0.18, 0.3]} rotation={[Math.PI / 2, 0, 0]} scale={[0.85, 0.9, 0.5]}>
          <capsuleGeometry args={[0.8, 2.3, 8, 16]} />
          <meshStandardMaterial color="#ffffff" roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.9, -0.5]} rotation={[-0.35, 0, 0]}>
          <coneGeometry args={[0.38, 1.0, 4]} />
          <Paint color={body} />
        </mesh>
        <group ref={tail} position={[0, 0.1, -1.9]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.55, 1.0, 4]} />
            <Paint color={decal} />
          </mesh>
        </group>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[s * 0.62, 0.22, 1.35]}>
              <sphereGeometry args={[0.13, 10, 10]} />
              <meshBasicMaterial color="#ffffff" toneMapped={false} />
            </mesh>
            <mesh position={[s * 0.64, 0.22, 1.45]}>
              <sphereGeometry args={[0.07, 8, 8]} />
              <meshBasicMaterial color="#111827" />
            </mesh>
            <mesh position={[s * 0.95, -0.1, 0.4]} rotation={[0.2, 0, s * 0.9]}>
              <coneGeometry args={[0.28, 0.8, 4]} />
              <Paint color={decal} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 1.0, 0.1]} scale={[0.85, 0.7, 0.95]}>
          <sphereGeometry args={[0.8, 16, 12]} />
          <Glass opacity={0.28} />
        </mesh>
      </group>
    );
  // classic
  return (
    <group>
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <capsuleGeometry args={[0.85, 2.3, 8, 18]} />
        <Paint color={body} metal={0.55} rough={0.14} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.02, 0.35, 1.02]}>
        <capsuleGeometry args={[0.85, 2.3, 8, 18]} />
        <Paint color={decal} />
      </mesh>
      <mesh position={[0, 0.95, -1.0]}>
        <cylinderGeometry args={[0.36, 0.42, 0.55, 12]} />
        <Paint color={decal} />
      </mesh>
      <mesh position={[0.14, 1.5, -1.0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.7, 6]} />
        <meshStandardMaterial color="#2b2f3a" metalness={0.8} />
      </mesh>
      <mesh position={[0.14, 1.85, -0.9]}>
        <boxGeometry args={[0.08, 0.08, 0.3]} />
        <meshStandardMaterial color="#2b2f3a" metalness={0.8} />
      </mesh>
      <mesh position={[0, 1.0, 0.1]} scale={[0.82, 0.7, 0.95]}>
        <sphereGeometry args={[0.8, 18, 14]} />
        <Glass opacity={0.3} />
      </mesh>
      {[-0.78, 0.78].map((x) =>
        [-0.5, 0.5, 1.2].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.2, z]}>
            <sphereGeometry args={[0.13, 8, 8]} />
            <Neon color={g} i={2.4} />
          </mesh>
        ))
      )}
      <group ref={rot} position={[0, 0.05, -1.95]}>
        {[0, 1, 2].map((k) => (
          <mesh key={k} rotation={[0, 0, (k * Math.PI * 2) / 3]} position={[0, 0, 0]}>
            <boxGeometry args={[0.12, 0.8, 0.05]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0.35, -1.8]}>
        <boxGeometry args={[0.1, 0.9, 0.5]} />
        <Paint color={decal} />
      </mesh>
      <mesh position={[0, 0.05, -1.8]}>
        <boxGeometry args={[1.6, 0.08, 0.5]} />
        <Paint color={decal} />
      </mesh>
    </group>
  );
}
