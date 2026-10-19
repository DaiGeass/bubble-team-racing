import {useEffect,useMemo,useRef} from "react";
import {useFrame} from "@react-three/fiber";
import * as THREE from "three";
import {challengeSites,challengeState,challengePose,makeChallengePose} from "../trackChallenges";
import {raceSnapshot,type ThemeDef} from "../data";

/** Three compact machines per circuit, shared geometry, no lights or postprocessing. */
export default function TrackChallenges({theme}:{theme:ThemeDef}) {
  const sites=useMemo(()=>challengeSites(),[]);
  const roots=useRef<(THREE.Group|null)[]>([]),panels=useRef<(THREE.Mesh|null)[]>([]),arrows=useRef<(THREE.Mesh|null)[]>([]),rotors=useRef<(THREE.Mesh|null)[]>([]);
  const pose=useMemo(makeChallengePose,[]);
  const assets=useMemo(()=>({box:new THREE.BoxGeometry(1,1,1),cone:new THREE.ConeGeometry(0.55,1.6,6),hub:new THREE.CylinderGeometry(0.65,0.65,0.3,8),
    metal:new THREE.MeshStandardMaterial({color:theme.barrierB,roughness:0.42,metalness:0.5}),
    edge:new THREE.MeshStandardMaterial({color:theme.barrierA,emissive:theme.glow,emissiveIntensity:0.25,roughness:0.3}),
    flow:new THREE.MeshBasicMaterial({color:theme.glow,toneMapped:false})}),[theme.barrierA,theme.barrierB,theme.glow]);
  useEffect(()=>()=>Object.values(assets).forEach(a=>a.dispose()),[assets]);
  useFrame(({camera})=>sites.forEach((site,i)=>{
    const root=roots.current[i];if(!root)return;
    const dx=camera.position.x-site.x,dz=camera.position.z-site.z;
    root.visible=dx*dx+dz*dz<360*360;if(!root.visible)return;
    challengePose(site,raceSnapshot.clockMs,challengeState.stages[site.id]??1,pose);
    // Local +X is the path's positive lateral direction.
    root.position.set(site.x,site.y,site.z);root.rotation.y=Math.atan2(site.tx,site.tz)+Math.PI;
    for(let side=0;side<2;side++) {
      const panel=panels.current[i*2+side],rotor=rotors.current[i*2+side];
      const sign=side?1:-1;
      if(panel) {
        panel.visible=site.kind==="gate"&&pose.active;
        const edge=pose.gap+sign*pose.gapHalf;
        const outer=sign*(site.half+0.25),width=Math.abs(outer-edge);
        panel.position.set((outer+edge)/2,pose.height/2,0);panel.scale.set(width,pose.height,pose.depth);
      }
      if(rotor) {rotor.visible=site.kind!=="gate";rotor.rotation.z=pose.active?raceSnapshot.clockMs*0.006:0;}
    }
    for(let k=0;k<4;k++) {
      const arrow=arrows.current[i*4+k];if(!arrow)continue;
      arrow.visible=site.kind!=="gate"&&pose.active;
      const sign=k%2?1:-1,lat=pose.gap+sign*(pose.gapHalf+0.8);
      arrow.position.set(lat,0.65+Math.sin(raceSnapshot.clockMs*0.002+k)*0.2,(k<2?-1:1)*5);
      const direction=Math.sin(raceSnapshot.clockMs*0.00045+site.phase+(challengeState.stages[site.id]??1))>=0?1:-1;
      arrow.rotation.z=-direction*Math.PI/2;
    }
  }));
  return <group dispose={null}>{sites.map((site,i)=><group key={site.id} ref={g=>{roots.current[i]=g;}}>
    {[-1,1].map((side,k)=><group key={side} position={[side*(site.half+0.35),0,0]}>
      <mesh geometry={assets.box} material={assets.metal} position={[0,1.6,0]} scale={[0.55,3.2,1.2]} castShadow />
      <mesh geometry={assets.box} material={assets.edge} position={[0,2.4,0.65]} scale={[0.32,0.85,0.12]} />
      <mesh ref={m=>{rotors.current[i*2+k]=m;}} geometry={assets.hub} material={assets.edge} position={[0,1.4,0]} rotation={[Math.PI/2,0,0]} />
    </group>)}
    {[0,1].map(k=><mesh key={k} visible={false} ref={m=>{panels.current[i*2+k]=m;}} geometry={assets.box} material={assets.metal} castShadow />)}
    {[0,1,2,3].map(k=><mesh key={k} visible={false} ref={m=>{arrows.current[i*4+k]=m;}} geometry={assets.cone} material={assets.flow} scale={site.kind==="magnet"?0.8:1} />)}
  </group>)}</group>;
}
