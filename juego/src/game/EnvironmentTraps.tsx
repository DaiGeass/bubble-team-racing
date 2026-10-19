import {useMemo,useEffect,useRef} from "react";
import {useFrame} from "@react-three/fiber";
import * as THREE from "three";
import {environmentEvents,eventPose,type EventPose} from "../environment";
import {raceSnapshot,type ThemeDef} from "../data";
/** Shared meshes/materials, a small number of sudden hazards per circuit. */
export default function EnvironmentTraps({theme}:{theme:ThemeDef}) {
  const events=useMemo(()=>environmentEvents(),[]);const roots=useRef<(THREE.Group|null)[]>([]);
  const parts=useRef<(THREE.Mesh|null)[]>([]);const lights=useRef<(THREE.Mesh|null)[]>([]);const beacons=useRef<(THREE.Mesh|null)[]>([]);
  const assets=useMemo(()=>({ring:new THREE.TorusGeometry(1.7,0.08,6,24),base:new THREE.CylinderGeometry(1.5,1.7,0.18,12),
    piston:new THREE.CylinderGeometry(1,1,1,8),jet:new THREE.ConeGeometry(1,1,10),orb:new THREE.IcosahedronGeometry(1,1),
    metal:new THREE.MeshStandardMaterial({color:theme.barrierA,metalness:0.55,roughness:0.3})}),[theme.barrierA]);
  const pose=useMemo<EventPose>(()=>({x:0,y:0,z:0,heading:0,active:false,lift:0,radius:1}),[]);
  const indicators=useMemo(()=>events.map(()=>new THREE.MeshBasicMaterial({color:"#ff4562",toneMapped:false})),[events]);
  useEffect(()=>()=>Object.values(assets).forEach(a=>a.dispose()),[assets]);
  useEffect(()=>()=>indicators.forEach(m=>m.dispose()),[indicators]);
  useFrame(()=>events.forEach((event,i)=>{
    const root=roots.current[i],part=parts.current[i],light=lights.current[i];if(!root||!part||!light)return;
    eventPose(event,raceSnapshot.clockMs,pose);root.position.set(pose.x,pose.y,pose.z);root.rotation.y=pose.heading;
    const height=pose.lift*(event.kind==="piston"?2.2:event.kind==="sprout"?1.8:3.0);
    part.visible=height>0.02;part.scale.set(pose.radius,height*(event.kind==="sprout"?0.5:1),pose.radius);part.position.y=height/2+0.1;
    part.rotation.y=event.kind==="sweeper"?raceSnapshot.clockMs*0.003:0;
    // No idle beacon or countdown: the flash appears with the physical obstacle.
    light.visible=pose.active;light.scale.setScalar(1.1+pose.lift*0.35);
    const beacon=beacons.current[i];if(beacon){beacon.visible=pose.active;beacon.scale.setScalar(0.23+pose.lift*0.12);}
    indicators[i].color.set(pose.lift<0.8?"#fff3df":"#ff4562");
  }));
  return <group dispose={null}>{events.map((event,i)=><group key={event.id} ref={g=>{roots.current[i]=g;}}>
    <mesh geometry={assets.base} material={assets.metal} position={[0,0.08,0]}/>
    <mesh ref={m=>{lights.current[i]=m;}} visible={false} geometry={assets.ring} material={indicators[i]} rotation={[-Math.PI/2,0,0]} position={[0,0.19,0]}/>
    <mesh visible={false} ref={m=>{parts.current[i]=m;}} geometry={event.kind==="piston"||event.kind==="sweeper"?assets.piston:event.kind==="sprout"?assets.orb:assets.jet} material={assets.metal} castShadow/>
    <mesh visible={false} ref={m=>{beacons.current[i]=m;}} geometry={assets.orb} material={indicators[i]} position={[event.side*2.2,1.1,0]} scale={0.23}/>
  </group>)}</group>;
}
