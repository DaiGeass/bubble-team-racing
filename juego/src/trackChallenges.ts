import {surfaceSites} from "./surfaceEvents";
import {getPaths,getActiveTrack,F_SOLID,type PathRT} from "./trackCurve";
import {modeOnPath} from "./trackModes";
import {environmentEvents} from "./environment";
import {characterPhase} from "./modelDetail";
import type {VehicleMode} from "./data";

export interface ChallengeSite {
  id:number;path:number;idx:number;u:number;x:number;y:number;z:number;tx:number;tz:number;half:number;
  risk:boolean;kind:"gate"|"current"|"gust"|"magnet";mode:VehicleMode;phase:number;
}
export interface ChallengePose {active:boolean;gap:number;gapHalf:number;force:number;height:number;depth:number}
export const makeChallengePose=():ChallengePose=>({active:false,gap:0,gapHalf:0,force:0,height:0,depth:0});
let loaded:PathRT[]|null=null,sites:ChallengeSite[]=[];
/** At most three cached sites. All anchors stay off holes, mode boundaries and junctions. */
export function challengeSites():readonly ChallengeSite[] {
  const paths=getPaths();if(loaded===paths)return sites;loaded=paths;sites=[];
  const seed=characterPhase(getActiveTrack().id),existing=environmentEvents();
  for(const path of [paths[paths.length-1],paths[0]]) {
    if(path.main&&sites.some(s=>s.path===0))continue;
    const risk=!path.main;
    for(const target of (risk?[0.48]:[0.34,0.66])) {
      let index=-1;
      const mid=Math.round(target*(path.n-1)),edge=Math.ceil((risk?28:100)/path.ds);
      for(let attempt=0;attempt<path.n;attempt++) {
        const i=mid+Math.ceil(attempt/2)*(attempt%2?1:-1);if(i<edge||i>=path.n-edge)continue;
        const mode=modeOnPath(path.id,path.prog[i]);let safe=true;
        for(let d=-Math.ceil(16/path.ds);d<=Math.ceil(16/path.ds);d++) {
          const j=Math.max(0,Math.min(path.n-1,i+d));
          if(!(path.flags[j]&F_SOLID)||Math.abs(path.slope[j])>0.26||modeOnPath(path.id,path.prog[j])!==mode||path.tx[i]*path.tx[j]+path.tz[i]*path.tz[j]<(mode==="land"?0.91:0.65)){safe=false;break;}
        }
        if(!safe)continue;
        // Leave room to straighten up between a missing half-deck and a moving shutter.
        if(surfaceSites.some(s=>s.kind==="bridge"&&s.path===path.id&&Math.hypot(s.x-path.px[i],s.z-path.pz[i])<48))continue;
        if(path.main&&paths.slice(1).some(p=>Math.abs(p.t0-path.prog[i])*path.length<75||Math.abs(((p.t0+p.span)%1)-path.prog[i])*path.length<75))continue;
        if(existing.some(s=>s.path===path.id&&Math.hypot(s.x-path.px[i],s.z-path.pz[i])<30)||sites.some(s=>s.path===path.id&&Math.hypot(s.x-path.px[i],s.z-path.pz[i])<65))continue;
        // A physical shutter must not protrude into an adjacent road at the same height.
        let overlaps=false;
        for(const p of paths)if(mode==="land"&&p!==path)for(let j=0;j<p.n;j++) {
          if(Math.abs(p.py[j]-path.py[i])>=4)continue;
          const dx=p.px[j]-path.px[i],dz=p.pz[j]-path.pz[i],margin=path.half[i]+p.half[j]+1;
          if(dx*dx+dz*dz<margin*margin){overlaps=true;break;}
        }
        if(overlaps)continue;
        index=i;break;
      }
      if(index<0)continue;
      const i=index,mode=modeOnPath(path.id,path.prog[i]);
      const kind=mode==="boat"||mode==="sub"?"current":mode==="plane"?"gust":mode==="hover"?"magnet":"gate";
      sites.push({id:sites.length,path:path.id,idx:i,u:i/(path.n-1),x:path.px[i],y:path.py[i]+(mode==="plane"?2.6:mode==="sub"?1.3:mode==="hover"?0.55:0),z:path.pz[i],tx:path.tx[i],tz:path.tz[i],half:path.half[i],risk,kind,mode,phase:seed*6.28+sites.length*2.1});
    }
  }
  challengeState.stages=new Uint8Array(sites.length).fill(1);return sites;
}

/** A single pose/stage per site is shared by render and every local body. */
export const challengeState={stages:new Uint8Array(0)};
export function resetChallenges(){challengeSites();challengeState.stages.fill(1);}
export function challengeStage(current:number,lap:number,occupied:boolean):number {
  if(occupied||!Number.isFinite(lap))return current;
  return Math.max(current,Math.min(3,Math.max(1,Math.floor(lap))));
}
export function challengePose(site:ChallengeSite,ms:number,stage:number,out:ChallengePose):ChallengePose {
  const level=Math.max(1,Math.min(3,stage));const time=Number.isFinite(ms)?ms*0.001:0;
  out.active=site.risk||level>1;
  out.gapHalf=site.risk?2.9-(level-1)*0.2:Math.min(site.half-1,4.2-(level-2)*0.4);
  const room=Math.max(0,Math.min(site.half-out.gapHalf-0.8,site.risk?2.7:4));
  out.gap=room*(0.62*Math.sin(time*(0.5+level*0.08)+site.phase)+0.38*(level%2?1:-1));
  out.force=out.active?(site.risk?5:4)+level*1.5:0;
  out.height=site.kind==="gate"?2.8:site.mode==="plane"?12:site.mode==="sub"?5:2.4;
  out.depth=site.kind==="gate"?1.2:24;
  return out;
}

interface Sweep {enter:number;leave:number;lat:number;endLat:number;y:number;cross:boolean}
const sweepScratch:Sweep={enter:0,leave:0,lat:0,endLat:0,y:0,cross:false};
/** Clip the whole segment against the occupied slab, including motion at low frame rates. */
function sweep(site:ChallengeSite,depth:number,x:number,y:number,z:number,dx:number,dy:number,dz:number):Sweep|null {
  const rx=x-site.x,rz=z-site.z,a=rx*site.tx+rz*site.tz,v=dx*site.tx+dz*site.tz;
  let enter=0,leave=1;
  if(Math.abs(v)<1e-8){if(Math.abs(a)>depth/2+0.85)return null;}
  else {const p=(-depth/2-0.85-a)/v,q=(depth/2+0.85-a)/v;enter=Math.max(0,Math.min(p,q));leave=Math.min(1,Math.max(p,q));if(enter>leave)return null;}
  const mid=(enter+leave)*0.5;
  sweepScratch.enter=enter;sweepScratch.leave=leave;
  sweepScratch.lat=-(rx+dx*enter)*site.tz+(rz+dz*enter)*site.tx;
  sweepScratch.endLat=-(rx+dx*leave)*site.tz+(rz+dz*leave)*site.tx;
  sweepScratch.y=y+dy*mid-site.y;sweepScratch.cross=a<0&&a+v>=0&&v>0;
  return sweepScratch;
}

export interface ChallengeMotion {dx:number;dz:number;flow:number;hit:boolean;field:boolean;cleared:number}
export const makeChallengeMotion=():ChallengeMotion=>({dx:0,dz:0,flow:0,hit:false,field:false,cleared:0});
export interface ChallengeBody {path:number;mode:VehicleMode;x:number;y:number;z:number;tx:number;tz:number;flow:number;grip:number;ghost?:boolean}
/** Used by both Scene and the driving audit. Floor support remains in moveBody(). */
export function challengeMotion(body:ChallengeBody,dx:number,dz:number,dt:number,ms:number,stages:ArrayLike<number>,out:ChallengeMotion,all:readonly ChallengeSite[]=challengeSites()):ChallengeMotion {
  dt=Number.isFinite(dt)?Math.max(0,dt):0;
  out.flow=body.flow*Math.exp(-3*Math.max(0,dt));out.dx=dx-body.tz*out.flow*Math.max(0,dt);out.dz=dz+body.tx*out.flow*Math.max(0,dt);out.hit=false;out.field=false;out.cleared=0;
  if(!Number.isFinite(dt)||dt<=0)return out;
  const pose=motionPose;
  for(const site of all) {
    if(site.path!==body.path||site.mode!==body.mode||(body.ghost&&site.kind==="gate"))continue;
    challengePose(site,ms,stages[site.id]??1,pose);if(!pose.active)continue;
    const contact=sweep(site,pose.depth,body.x,body.y,body.z,out.dx,0,out.dz);if(!contact)continue;
    if(Math.abs(contact.lat)>site.half+1&&Math.abs(contact.endLat)>site.half+1)continue;
    const fits=Math.max(Math.abs(contact.lat-pose.gap),Math.abs(contact.endLat-pose.gap))<=pose.gapHalf-0.85;
    const above=site.kind==="gate"&&contact.y>pose.height+0.2&&contact.y<pose.height+30;
    const inHeight=site.kind==="gate"?contact.y>=-1.2&&contact.y<=pose.height+0.2:Math.abs(contact.y)<=pose.height;
    if(contact.cross&&(fits||above)&&(inHeight||above))out.cleared|=1<<site.id;
    if(fits||above||!inHeight)continue;
    if(site.kind==="gate") {
      const along=out.dx*site.tx+out.dz*site.tz,side=-out.dx*site.tz+out.dz*site.tx;
      const kept=along*Math.max(0,contact.enter-0.01);
      out.dx=site.tx*kept-site.tz*side;out.dz=site.tz*kept+site.tx*side;out.hit=true;
    } else {
      const direction=Math.sin(ms*0.00045+site.phase+(stages[site.id]??1))>=0?1:-1;
      const kick=direction*pose.force*Math.max(0,dt)*(contact.leave-contact.enter)*Math.max(0.5,Math.min(1.2,body.grip));
      const before=out.flow;out.flow=Math.max(-3.5,Math.min(3.5,out.flow+kick));out.field=true;
      out.dx-=body.tz*(out.flow-before)*Math.max(0,dt);out.dz+=body.tx*(out.flow-before)*Math.max(0,dt);
    }
  }
  return out;
}
const motionPose=makeChallengePose();

/** Completion must include entry, forward travel, the challenge opening and a real exit. */
export class RiskRouteRun {
  private active=false;private clean=true;private cleared=false;private u=0;private total=0;private lap=0;private rewarded=0;private invalid=false;private latestLap=0;
  score=0;
  constructor(readonly path:number,readonly exit:number,readonly mainLength:number){}
  fail(){this.clean=false;}
  reset(){this.active=false;this.clean=false;this.invalid=true;}
  step(path:number,u:number,lap:number,total:number,speed:number,clean:boolean,cleared:boolean):boolean {
    if(![u,lap,total,speed].every(Number.isFinite)){this.reset();return false;}
    if(lap<this.latestLap){this.reset();return false;}this.latestLap=lap;
    if(this.invalid){if(path===this.path)return false;this.invalid=false;}
    if(!this.active) {
      if(path!==this.path||u>0.18||u<0||speed<12||lap<=this.rewarded)return false;
      this.active=true;this.clean=clean;this.cleared=false;this.u=u;this.total=total;this.lap=lap;
    }
    const advance=(total-this.total)*this.mainLength;
    if(!clean||speed<0||advance< -0.15||advance>20||lap!==this.lap)this.clean=false;
    if(path===this.path) {
      if(u<this.u-0.003||u-this.u>0.16)this.clean=false;
      this.u=u;this.total=total;this.cleared||=cleared;return false;
    }
    const progress=((total%1)+1)%1;
    const success=path===0&&this.u>=0.84&&Math.abs(progress-this.exit)<0.025&&this.clean&&this.cleared&&speed>=12&&lap>this.rewarded;
    this.active=false;this.clean=false;this.invalid=false;if(success){this.rewarded=lap;this.score+=180;}return success;
  }
}
