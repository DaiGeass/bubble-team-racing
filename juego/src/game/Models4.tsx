import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { craftParts, type NewCraftId, type PartFinish, type PartShape } from "../craftModels";
import { paintOptions } from "./paint";
import type { FinishId } from "../data";
import type { KartVisualState } from "./Vehicle";

/** Only selected craft mount. Each owns five geometries and five shared materials. */
export default function Craft4({kind,body,decal,glow,finish,stateRef}: {kind: NewCraftId; body:string;decal:string;glow?:string;finish?:FinishId;stateRef?:React.MutableRefObject<KartVisualState>}) {
  const root=useRef<THREE.Group>(null);
  const meshes=useRef<(THREE.Mesh|null)[]>([]);
  const parts=useMemo(()=>craftParts(kind),[kind]);
  const geometry=useMemo<Record<PartShape,THREE.BufferGeometry>>(()=>({
    box:new THREE.BoxGeometry(1,1,1),orb:new THREE.SphereGeometry(1,16,10),tube:new THREE.CylinderGeometry(1,1,1,14),
    ring:new THREE.TorusGeometry(1,0.07,6,24),cone:new THREE.ConeGeometry(0.5,1,3),
  }),[]);
  const materials=useMemo<Record<PartFinish,THREE.Material>>(()=>{
    const make=(color:string)=>finish==="glass"||finish==="holo" ? new THREE.MeshPhysicalMaterial(paintOptions(color,finish)) : new THREE.MeshStandardMaterial(paintOptions(color,finish));
    return {body:make(body),trim:make(decal),dark:new THREE.MeshStandardMaterial({color:"#263346",metalness:0.65,roughness:0.3}),
      glass:new THREE.MeshPhysicalMaterial({color:"#c5f5ff",transparent:true,opacity:0.35,roughness:0.04,clearcoat:1,depthWrite:false}),
      glow:new THREE.MeshBasicMaterial({color:glow??decal,toneMapped:false})};
  },[body,decal,glow,finish]);
  useEffect(()=>()=>Object.values(geometry).forEach(g=>g.dispose()),[geometry]);
  useEffect(()=>()=>Object.values(materials).forEach(m=>m.dispose()),[materials]);
  useFrame(({clock})=>{
    // All mode ancestors participate: an invisible parked transformation does no animation work.
    for(let p:THREE.Object3D|null=root.current;p;p=p.parent) if(!p.visible)return;
    const time=clock.elapsedTime;
    parts.forEach((part,i)=>{
      const mesh=meshes.current[i]; if(!mesh||!part.motion)return;
      if(part.motion==="prop")mesh.rotation.z=part.rotation[2]+time*18;
      if(part.motion==="field")mesh.rotation.y=part.rotation[1]+time*(kind==="vtol"?28:2.2);
      if(part.motion==="fin")mesh.rotation.x=part.rotation[0]+(stateRef?.current.steer??0)*0.18;
    });
  });
  return <group ref={root} dispose={null}>{parts.map((p,i)=><mesh key={`${kind}-${i}`} ref={m=>{meshes.current[i]=m;}} geometry={geometry[p.shape]} material={materials[p.finish]}
    position={p.at} scale={p.size} rotation={p.rotation} castShadow={p.finish!=="glass"&&p.finish!=="glow"}/>)}</group>;
}
