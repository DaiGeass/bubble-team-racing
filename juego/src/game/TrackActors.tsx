import {useMemo,useEffect,useRef} from "react";
import {useFrame} from "@react-three/fiber";
import * as THREE from "three";
import {trackActors,actorPose,type ActorPose} from "../trackActors";
import type {LifeSpot} from "../trackLife";
/** Two instanced draws, no separate React/frame callbacks per animal. */
export default function TrackActors({spots,indoor}:{spots:readonly LifeSpot[];indoor:boolean}) {
  const actors=useMemo(()=>trackActors(spots,indoor),[spots,indoor]);
  const body=useRef<THREE.InstancedMesh>(null);const wings=useRef<THREE.InstancedMesh>(null);
  const assets=useMemo(()=>({body:new THREE.SphereGeometry(1,10,6),wing:new THREE.BoxGeometry(1,1,1),material:new THREE.MeshStandardMaterial({roughness:0.4,metalness:0.25})}),[]);
  const scratch=useMemo(()=>({d:new THREE.Object3D(),matrix:new THREE.Matrix4(),frustum:new THREE.Frustum(),sphere:new THREE.Sphere(new THREE.Vector3(),5),pose:{x:0,y:0,z:0,heading:0,bank:0,wing:0} as ActorPose,color:new THREE.Color()}),[]);
  const elapsed=useRef(1);
  useEffect(()=>{const b=body.current,w=wings.current;return()=>{b?.dispose();w?.dispose();Object.values(assets).forEach(a=>a.dispose());};},[assets]);
  useEffect(()=>{
    const b=body.current,w=wings.current;if(!b||!w)return;
    actors.forEach((a,i)=>{b.setColorAt(i,scratch.color.set(a.anchor.glow));w.setColorAt(i*2,scratch.color.set(a.anchor.color));w.setColorAt(i*2+1,scratch.color.set(a.anchor.glow));});
    if(b.instanceColor)b.instanceColor.needsUpdate=true;if(w.instanceColor)w.instanceColor.needsUpdate=true;
    b.instanceMatrix.setUsage(THREE.DynamicDrawUsage);w.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  },[actors,scratch]);
  useFrame(({clock,camera},dt)=>{
    elapsed.current+=dt;if(elapsed.current<1/30)return;elapsed.current%=1/30;
    const b=body.current,w=wings.current;if(!b||!w)return;
    scratch.frustum.setFromProjectionMatrix(scratch.matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    let count=0;const d=scratch.d;
    for(let i=0;i<actors.length;i++) {
      const a=actors[i];actorPose(a,clock.elapsedTime,scratch.pose);const p=scratch.pose;
      scratch.sphere.center.set(p.x,p.y,p.z);if(!scratch.frustum.intersectsSphere(scratch.sphere))continue;
      const fish=a.kind==="fish",insect=a.kind==="butterfly";
      d.position.set(p.x,p.y,p.z);d.rotation.set(0,p.heading,p.bank);d.scale.set(insect?0.12:0.32,insect?0.15:0.2,fish?0.7:0.34);d.updateMatrix();b.setMatrixAt(count,d.matrix);b.setColorAt(count,scratch.color.set(a.anchor.glow));
      for(let side=-1;side<=1;side+=2) {
        d.position.set(p.x+Math.cos(p.heading)*side*0.33,p.y,p.z-Math.sin(p.heading)*side*0.33);
        d.rotation.set(0,p.heading+(fish?p.wing:!insect?p.wing:0),insect?side*p.wing:p.bank);
        d.scale.set(insect?0.65:fish?0.32:0.75,insect?0.035:0.07,insect?0.48:0.16);d.updateMatrix();w.setMatrixAt(count*2+(side+1)/2,d.matrix);w.setColorAt(count*2+(side+1)/2,scratch.color.set(side<0?a.anchor.color:a.anchor.glow));
      }
      count++;
    }
    b.count=count;w.count=count*2;b.instanceMatrix.needsUpdate=true;w.instanceMatrix.needsUpdate=true;
    if(b.instanceColor)b.instanceColor.needsUpdate=true;if(w.instanceColor)w.instanceColor.needsUpdate=true;
  });
  return <group dispose={null}><instancedMesh ref={body} args={[assets.body,assets.material,Math.max(1,actors.length)]} frustumCulled={false}/><instancedMesh ref={wings} args={[assets.wing,assets.material,Math.max(2,actors.length*2)]} frustumCulled={false}/></group>;
}
