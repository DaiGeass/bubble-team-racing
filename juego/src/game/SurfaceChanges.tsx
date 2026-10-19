import {useMemo,useRef,useEffect} from "react";
import {useFrame} from "@react-three/fiber";
import * as THREE from "three";
import {getPaths} from "../trackCurve";
import {surfaceSites,bridgeDrop,floodDepth} from "../surfaceEvents";
import {raceSnapshot,type ThemeDef} from "../data";
/** Replaces only the moving deck; the rest of the track stays batched. */
export default function SurfaceChanges({theme}:{theme:ThemeDef}){
  const meshes=useRef<(THREE.Mesh|null)[]>([]);
  const assets=useMemo(()=>surfaceSites.map(site=>{
    const p=getPaths()[site.path];
    const geometries=(site.kind==="bridge"?[-1,1]:[0]).map(side=>{
      const vertices:number[]=[],indices:number[]=[];
      for(let i=site.first;i<=site.last;i++){
        const limits=side===0?[-p.half[i],p.half[i]]:side<0?[-p.half[i],0]:[0,p.half[i]];
        for(const lat of limits)vertices.push(p.px[i]-p.tz[i]*lat,p.py[i]+0.055,p.pz[i]+p.tx[i]*lat);
        const k=(i-site.first)*2;if(i<site.last)indices.push(k,k+1,k+2,k+1,k+3,k+2);
      }
      const topCount=indices.length;
      const at=(i:number,lat:number,up:number)=>[p.px[i]-p.tz[i]*lat,p.py[i]+up,p.pz[i]+p.tx[i]*lat];
      const quad=(a:number[],b:number[],c:number[],d:number[])=>{const n=vertices.length/3;vertices.push(...a,...b,...c,...d);indices.push(n,n+1,n+2,n+1,n+3,n+2);};
      if(side!==0)for(let i=site.first;i<site.last;i++){
        const j=i+1,edge=side*p.half[i],nextEdge=side*p.half[j];
        quad(at(i,edge,0.05),at(j,nextEdge,0.05),at(i,edge,-0.85),at(j,nextEdge,-0.85));
        quad(at(i,0,0.05),at(i,0,-0.85),at(j,0,0.05),at(j,0,-0.85));
        quad(at(i,0,-0.85),at(i,edge,-0.85),at(j,0,-0.85),at(j,nextEdge,-0.85));
        const bit=side>0?2:4;
        if((p.flags[i]&bit)&&(p.flags[j]&bit)){
          quad(at(i,edge+side*0.15,0.05),at(j,nextEdge+side*0.15,0.05),at(i,edge+side*0.15,1.05),at(j,nextEdge+side*0.15,1.05));
          quad(at(i,edge+side*0.15,1.05),at(j,nextEdge+side*0.15,1.05),at(i,edge+side*0.75,1.05),at(j,nextEdge+side*0.75,1.05));
          quad(at(i,edge+side*0.75,1.05),at(j,nextEdge+side*0.75,1.05),at(i,edge+side*0.75,-0.85),at(j,nextEdge+side*0.75,-0.85));
        }
      }
      if(side!==0)for(const i of [site.first,site.last])quad(at(i,0,0.05),at(i,side*p.half[i],0.05),at(i,0,-0.85),at(i,side*p.half[i],-0.85));
      const g=new THREE.BufferGeometry();
      if(side!==0){g.addGroup(0,topCount,0);g.addGroup(topCount,indices.length-topCount,1);}
g.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();return g;
    });
    return {site,geometries};
  }),[]);
  const materials=useMemo(()=>({deck:new THREE.MeshStandardMaterial({color:theme.road,roughness:0.6,metalness:0.2,side:THREE.DoubleSide}),edge:new THREE.MeshStandardMaterial({color:theme.barrierA,roughness:0.45,metalness:0.35,side:THREE.DoubleSide}),water:new THREE.MeshStandardMaterial({color:theme.water,roughness:0.22,metalness:0.3,transparent:true,opacity:0.78,side:THREE.DoubleSide,depthWrite:false})}),[theme.road,theme.water,theme.barrierA]);
  useEffect(()=>()=>assets.forEach(a=>a.geometries.forEach(g=>g.dispose())),[assets]);
  useEffect(()=>()=>Object.values(materials).forEach(m=>m.dispose()),[materials]);
  useFrame(({camera})=>assets.forEach(({site,geometries},i)=>{
    const nearby=(camera.position.x-site.x)**2+(camera.position.z-site.z)**2<380*380;
    geometries.forEach((g,k)=>{
      const mesh=meshes.current[i*2+k];if(!mesh)return;
      mesh.visible=nearby&&(site.kind==="bridge"||site.stage>1);if(!mesh.visible)return;
      if(site.kind==="bridge")mesh.position.y=(k===0?-1:1)===site.side?-bridgeDrop(site,raceSnapshot.clockMs):0;
      else {
        // Sampled water follows the road gradient, tapering to zero at both ends.
        const p=getPaths()[site.path],attr=g.getAttribute("position") as THREE.BufferAttribute;
        for(let j=site.first;j<=site.last;j++)for(let side=0;side<2;side++)attr.setY((j-site.first)*2+side,p.py[j]+0.06+floodDepth(site,j));
        attr.needsUpdate=true;
      }
    });
  }));
  return <group dispose={null}>{assets.flatMap(({site,geometries},i)=>geometries.map((g,k)=><mesh key={`${site.id}-${k}`} ref={m=>{meshes.current[i*2+k]=m;}} geometry={g} material={site.kind==="bridge"?[materials.deck,materials.edge]:materials.water} receiveShadow />))}</group>;
}
