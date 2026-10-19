import * as THREE from "three";
import {F_SOLID,type PathRT} from "../trackCurve";
import {zoneOnPath} from "../trackModes";
/** Pool/channel surface follows an actual alternate ribbon, including its width. */
export function waterRibbon(path:PathRT,extraHalf:number,height:number):THREE.BufferGeometry|null {
  if(path.main||!path.def?.afloat)return null;
  const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
  for(let i=0;i<path.n;i++){
    const half=Math.max(0.5,path.half[i]+extraHalf);
    for(const side of [-1,1]){
      const x=path.px[i]-path.tz[i]*half*side,z=path.pz[i]+path.tx[i]*half*side;
      positions.push(x,path.py[i]+height,z);uvs.push(x/14,z/14);
    }
    if(i===path.n-1)continue;
    if(!(path.flags[i]&F_SOLID)||!(path.flags[i+1]&F_SOLID)||zoneOnPath(path.id,path.prog[i])?.type!=="water"||zoneOnPath(path.id,path.prog[i+1])?.type!=="water")continue;
    const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);
  }
  if(!indices.length)return null;
  const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));geo.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
