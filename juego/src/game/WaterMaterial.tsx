import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { waterNormal } from "./waterNormal";
export default function WaterMaterial({ color, sea = false, indoor = false }: { color: string; sea?: boolean; indoor?: boolean }) {
  const normal = useMemo(() => waterNormal(), []);
  useEffect(() => { normal.repeat.setScalar(sea ? 70 : 1); }, [normal, sea]);
  useEffect(() => () => normal.dispose(), [normal]);
  useFrame(({ clock }) => normal.offset.set(clock.elapsedTime * 0.009, clock.elapsedTime * 0.005));
  return <meshStandardMaterial color={color} transparent opacity={sea ? 0.72 : 0.9} roughness={0.09} metalness={0.4}
    side={THREE.DoubleSide} depthWrite={false} normalMap={normal} normalScale={indoor ? [0.10, 0.10] : [0.22, 0.22]} />;
}
