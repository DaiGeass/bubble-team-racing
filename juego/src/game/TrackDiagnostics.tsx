import {useEffect,useMemo,useRef,useState} from "react";
import {useFrame} from "@react-three/fiber";
import {Html} from "@react-three/drei";
import * as THREE from "three";
import {getPaths,groundAt,makeGround,F_SOLID,F_TUNNEL,F_WALL_POS,F_WALL_NEG} from "../trackCurve";
import {hasSurface} from "../surfaceEvents";
import {modeOnPath} from "../trackModes";
import {environmentEvents,eventPose,type EventPose} from "../environment";
import {aimAhead,type Body} from "../physics";
import {raceSnapshot} from "../data";
import {useGame} from "../store";

/** Developer overlay is dynamically imported only by Vite's development branch. */
export default function TrackDiagnostics({bodies}:{bodies:readonly (Body&{aiRoute?:number;aiLat?:number})[]}){
  const [open,setOpen]=useState(false);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.code==="F8"&&!e.repeat&&useGame.getState().screen==="race"){e.preventDefault();setOpen(v=>!v);}};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);},[]);
  return open?<MapOverlay bodies={bodies}/>:null;
}
function MapOverlay({bodies}:{bodies:readonly (Body&{aiRoute?:number;aiLat?:number})[]}){
  const resources=useMemo(()=>{
    const vertices:number[]=[],colors:number[]=[],color=new THREE.Color();
    const segment=(a:number[],b:number[],tint:string)=>{vertices.push(...a,...b);color.set(tint);colors.push(color.r,color.g,color.b,color.r,color.g,color.b);};
    const palette={land:"#00ff99",boat:"#00ccff",sub:"#3366ff",plane:"#ffaa00",hover:"#dd55ff"};
    for(const p of getPaths())for(let i=0;i<p.n-1;i+=2){
      const j=Math.min(p.n-1,i+2),mode=modeOnPath(p.id,p.prog[i]);
      const at=(k:number,lat:number,up=0.3)=>[p.px[k]-p.tz[k]*lat,p.py[k]+up,p.pz[k]+p.tx[k]*lat];
      segment(at(i,0),at(j,0),p.flags[i]&F_SOLID?palette[mode]:"#ff2233");
      for(const side of [-1,1]){
        segment(at(i,side*p.half[i]),at(j,side*p.half[j]),"#ffffff");
        if(p.flags[i]&(side===1?F_WALL_POS:F_WALL_NEG))segment(at(i,side*p.half[i]),at(i,side*p.half[i],1.3),"#ffff55");
      }
      if(p.flags[i]&F_TUNNEL)segment(at(i,-p.half[i],7.2),at(i,p.half[i],7.2),"#7777ff");
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
    const material=new THREE.LineBasicMaterial({vertexColors:true,depthTest:false,transparent:true,opacity:0.65});
    const liveGeometry=new THREE.BufferGeometry();const count=bodies.length*4+environmentEvents().length+getPaths().length*500;
    liveGeometry.setAttribute("position",new THREE.BufferAttribute(new Float32Array(count*6),3).setUsage(THREE.DynamicDrawUsage));liveGeometry.setAttribute("color",new THREE.BufferAttribute(new Float32Array(count*6),3).setUsage(THREE.DynamicDrawUsage));
    const liveMaterial=new THREE.LineBasicMaterial({vertexColors:true,depthTest:false});
    const lines=new THREE.LineSegments(geometry,material),live=new THREE.LineSegments(liveGeometry,liveMaterial);lines.renderOrder=1000;live.renderOrder=1001;live.frustumCulled=false;
    return {geometry,material,liveGeometry,liveMaterial,lines,live,probe:makeGround(),aim:new THREE.Vector3(),color:new THREE.Color(),pose:{x:0,y:0,z:0,heading:0,active:false,lift:0,radius:0} as EventPose};
  },[bodies]);
  const frame=useRef(1);
  useEffect(()=>()=>{resources.geometry.dispose();resources.material.dispose();resources.liveGeometry.dispose();resources.liveMaterial.dispose();},[resources]);
  useFrame(({camera},dt)=>{
    frame.current+=dt;if(frame.current<0.1)return;frame.current=0;
    const {liveGeometry,probe,aim,color,pose}=resources;
    const positions=liveGeometry.getAttribute("position") as THREE.BufferAttribute,colors=liveGeometry.getAttribute("color") as THREE.BufferAttribute;let n=0;
    const segment=(ax:number,ay:number,az:number,bx:number,by:number,bz:number,tint:string)=>{
      if(n+2>positions.count)return;color.set(tint);positions.setXYZ(n,ax,ay,az);positions.setXYZ(n+1,bx,by,bz);colors.setXYZ(n,color.r,color.g,color.b);colors.setXYZ(n+1,color.r,color.g,color.b);n+=2;
    };
    for(const b of bodies){
      const supported=groundAt(b.pos.x,b.pos.z,b.y+1,probe,0.8);
      segment(b.pos.x,b.y+2,b.pos.z,b.pos.x,supported?probe.y:b.y-5,b.pos.z,supported?"#00ff99":"#ff2233");
      const p=getPaths()[b.path];aimAhead(b,b.aiRoute??b.path,15+Math.abs(b.speed)*0.35,(b.aiLat??0)/Math.max(1,p.half[b.idx]),aim);
      segment(b.pos.x,b.y+0.8,b.pos.z,aim.x,aim.y+0.8,aim.z,"#ffaa00");
    }
    const me=bodies[0];if(me){const clear=!groundAt(camera.position.x,camera.position.z,camera.position.y+1,probe,0)||camera.position.y>probe.y+1;segment(camera.position.x,camera.position.y,camera.position.z,me.pos.x,me.y+1.2,me.pos.z,clear?"#ffffff":"#ff2233");}
    for(const event of environmentEvents()){
      eventPose(event,raceSnapshot.clockMs,pose);const radius=pose.radius+0.9;
      segment(pose.x-radius,pose.y,pose.z,pose.x+radius,pose.y,pose.z,pose.active?"#ff2233":"#888888");
    }
    // Sample actual support, including the missing half of a collapsed bridge.
    for(const p of getPaths())for(let i=0;i<p.n;i+=Math.max(1,Math.ceil(p.n/240))){
      for(const side of [-0.5,0.5]){
        const lat=side*p.half[i],x=p.px[i]-p.tz[i]*lat,z=p.pz[i]+p.tx[i]*lat;
        if((x-camera.position.x)**2+(z-camera.position.z)**2>180**2)continue;
        const solid=!!(p.flags[i]&F_SOLID)&&hasSurface(p.id,i,0,lat);
        segment(x,p.py[i]+0.1,z,x,p.py[i]+(solid?0.45:1.4),z,solid?"#00ff99":"#ff2233");
      }
    }
    liveGeometry.setDrawRange(0,n);positions.needsUpdate=true;colors.needsUpdate=true;
  });
  return <group dispose={null}><primitive object={resources.lines}/><primitive object={resources.live}/><Html fullscreen calculatePosition={(_object,_camera,size)=>[size.width/2,size.height/2]} style={{pointerEvents:"none"}}><div style={{position:"absolute",left:16,top:145,maxWidth:300,padding:10,background:"#071324dd",color:"white",fontSize:12,borderRadius:10}}>F8 · Diagnóstico de pista<br/>Verde: soporte · rojo: hueco/trampa activa<br/>Blanco: ancho/cámara · amarillo: barrera/ruta IA<br/>Azul: techo · naranja: aire · violeta: magnético</div></Html></group>;
}
