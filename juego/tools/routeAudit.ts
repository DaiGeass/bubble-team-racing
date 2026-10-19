import {evolveSurfaces,setSurfaceClock,bridgeLane,surfaceWater} from "../src/surfaceEvents";
import {challengeSites,challengePose,makeChallengePose,challengeMotion,makeChallengeMotion} from "../src/trackChallenges";
import * as THREE from "three";
import {TRACKS,craftHandling,type VehicleMode} from "../src/data";
import {getPaths,getPads,setActiveTrack,FLIGHT,mainIndexAt} from "../src/trackCurve";
import {zoneOnPath,modeOnPath} from "../src/trackModes";
import {EXTRA_ROUTES} from "../src/trackExpansion";
import {moveBody,makeResult,placeBody,aimAhead,type Body} from "../src/physics";
import {RACE_SPEED_SCALE,RACE_ACCEL_SCALE} from "../src/raceTuning";
import {trackPace,cruisePace} from "../src/trackPace";
export function auditNewRoutes(fps=60,stage=1,startMs=0) {
  return TRACKS.map(track=>{
    setActiveTrack(track.id);evolveSurfaces(stage,0,()=>false);setSurfaceClock(startMs);const paths=getPaths();const route=EXTRA_ROUTES[track.id];
    const target=paths.find(p=>p.def===route);if(!target)throw Error(`Missing express route: ${track.id}`);
    const b:Body={pos:new THREE.Vector3(),y:0,vy:0,airborne:false,heading:0,course:0,speed:0,path:0,idx:0,prog:0,total:0,safePath:0,safeIdx:0,touching:false,groundY:0,slopeAlong:0,lat:0,half:10};
    placeBody(b,0,mainIndexAt(route.t0-0.018));b.total=b.prog;
    const aim=new THREE.Vector3(),result=makeResult(),dt=1/fps;let time=0,chosen=target.id,falls=0,used=false,boost=0,padCd=0,wall=0;
    const modes=new Set<VehicleMode>();
    const pads=getPads(),sites=challengeSites(),levels=new Uint8Array(sites.length).fill(stage),pose=makeChallengePose(),motion=makeChallengeMotion();
    let flow=0,cleared=false,gateHits=0,fieldFrames=0,lane=0;
    while(time<55&&b.total<route.t1+0.012){
      time+=dt;setSurfaceClock(startMs+time*1000);padCd-=dt;boost=Math.max(0,boost-dt);
      if(b.path===target.id)used=true;
      let opening: (typeof sites)[number]|null=null,near=Infinity,desired=0;
      for(const site of sites){
        if(site.path!==b.path||site.mode!==modeOnPath(b.path,b.prog))continue;
        const planned=paths[chosen],progress=paths[b.path].prog[site.idx];
        if(b.path===0&&planned&&!planned.main&&progress>=planned.t0&&progress<=planned.t0+planned.span)continue;
        const arc=(site.idx-b.idx)*paths[b.path].ds;if(arc<0||arc>90)continue;
        const ahead=(site.x-b.pos.x)*site.tx+(site.z-b.pos.z)*site.tz;
        if(ahead<0||ahead>85||ahead>=near)continue;
        challengePose(site,startMs+time*1000+Math.min(1500,ahead/Math.max(12,b.speed)*1000),stage,pose);
        if(pose.active){desired=pose.gap;opening=site;near=ahead;}
      }
      const remainingLane=bridgeLane(b.path,b.idx,Math.max(35,b.speed*1.2));if(remainingLane!==null)desired=remainingLane;
      lane+=(desired-lane)*Math.min(1,dt*3.5);
      chosen=aimAhead(b,chosen,remainingLane!==null?6+Math.abs(b.speed)*0.18:16+Math.abs(b.speed)*0.55,Math.max(-0.95,Math.min(0.95,lane/Math.max(1,b.half-2.6))),aim);
      if(remainingLane===null&&opening&&near>2&&near<Math.max(18,b.speed*0.65)){
        challengePose(opening,startMs+time*1000+near/Math.max(12,b.speed)*1000,stage,pose);
        aim.set(opening.x-opening.tz*pose.gap,opening.y,opening.z+opening.tx*pose.gap);
      }
      const err=Math.atan2(Math.sin(Math.atan2(aim.x-b.pos.x,aim.z-b.pos.z)-b.heading),Math.cos(Math.atan2(aim.x-b.pos.x,aim.z-b.pos.z)-b.heading));
      const steer=THREE.MathUtils.clamp(err*2.5,-1,1);
      const mode=modeOnPath(b.path,b.prog);modes.add(mode);const zone=zoneOnPath(b.path,b.prog),flying=mode==="plane"||mode==="sub";
      const p=paths[b.path],idx=Math.max(0,Math.min(p.n-1,b.idx));
      const cruise=cruisePace(trackPace(b.path,b.idx),b.speed,steer,b.airborne,false,b.touching,Math.sin(b.course)*p.tx[idx]+Math.cos(b.course)*p.tz[idx]);
      const modeSpeed=mode==="plane"?1.12:mode==="boat"?0.94:mode==="sub"?0.945:mode==="hover"?1.1:1;
      const max=27*RACE_SPEED_SCALE*modeSpeed*cruise*(boost>0?1.4:1);
      b.speed=Math.min(max,b.speed+18*RACE_ACCEL_SCALE*dt);if(mode==="land")b.speed*=Math.exp(-surfaceWater(b.path,b.idx)*0.65*dt);
      const sf=Math.min(1,b.speed/(27*RACE_SPEED_SCALE));
      const turn=mode==="plane"?0.8:mode==="boat"?1.25:mode==="sub"?1.15:mode==="hover"?1.12:1;
      b.heading+=steer*2.6*(0.4+sf*0.6)*(1-sf*0.18)*turn*dt;
      const slip=Math.atan2(Math.sin(b.heading-b.course),Math.cos(b.heading-b.course));b.course+=slip*(1-Math.exp(-(mode==="boat"?3.6:mode==="hover"?5:13)*dt));
      const flight=mode==="sub"?FLIGHT.sub:FLIGHT.sky;
      const u=zone?THREE.MathUtils.clamp((b.prog-zone.t0)/(zone.t1-zone.t0),0,1):0;
      const lift=THREE.MathUtils.smoothstep(u,0,0.1)*(1-THREE.MathUtils.smoothstep(u,0.9,1));
      challengeMotion({path:b.path,mode,x:b.pos.x,y:b.y,z:b.pos.z,tx:p.tx[idx],tz:p.tz[idx],flow,grip:1},Math.sin(b.course)*b.speed*dt,Math.cos(b.course)*b.speed*dt,dt,startMs+time*1000,levels,motion,sites);
      flow=motion.flow;if(motion.hit){gateHits++;b.speed*=0.7;}if(motion.field)fieldFrames++;
      if(sites.some(s=>s.risk&&(motion.cleared&(1<<s.id))))cleared=true;
      moveBody(b,motion.dx,motion.dz,dt,{rideOffset:mode==="hover"?0.55:mode==="boat"?-0.12:mode==="sub"?0.35:0,bobbing:mode==="boat"||mode==="hover"||mode==="sub",fly:flying,flyAlt:flying?flight.base*lift:0,flyMargin:mode==="sub"?-2.6:4,ghost:false,gravityMul:mode==="hover"?0.4:1},result);
      if(result.fell){falls++;break;}if(result.wallFirst)wall++;
      if(padCd<=0)for(const pad of pads){if(pad.kind!=="boost"||Math.abs(pad.pos.y-b.y)>3)continue;if(pad.pos.distanceTo(b.pos)<4.4){boost=1.1;padCd=0.6;break;}}
    }
    return {id:track.id,path:target.id,used,finished:b.total>=route.t1+0.012,falls,wall,cleared,gateHits,fieldFrames,time:+time.toFixed(2),modes:[...modes]};
  });
}
