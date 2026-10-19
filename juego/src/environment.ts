import {getPaths,getActiveTrack,F_SOLID,type PathRT} from "./trackCurve";
import {modeOnPath} from "./trackModes";
import {characterPhase} from "./modelDetail";
import type {VehicleMode} from "./data";
export interface EnvironmentEvent {id:number;path:number;idx:number;x:number;y:number;z:number;tx:number;tz:number;half:number;side:number;kind:"vent"|"current"|"piston"|"sweeper"|"sprout";mode:VehicleMode;phase:number;period:number}
export interface EventPose {x:number;y:number;z:number;heading:number;active:boolean;lift:number;radius:number}
export function ambientHazardCount(base:number,lap:number,perLap=2):number {
  return base<=0?0:base+Math.min(3,Math.max(0,Math.floor(lap)-1))*perLap;
}
let loaded:PathRT[]|null=null;let events:EnvironmentEvent[]=[];
/** Anchors are built once, clear of launch lips, junction mouths and steep road. */
export function environmentEvents():readonly EnvironmentEvent[] {
  const paths=getPaths();if(paths===loaded)return events;loaded=paths;events=[];
  const track=getActiveTrack();const seed=characterPhase(track.id);
  for(const path of [paths[0],paths[paths.length-1]]){
    if(path.id===0&&events.length)continue;
    const targets=path.main?[0.22,0.48,0.76]:[0.52];
    for(const fraction of targets){
      const mid=Math.round(fraction*(path.n-1));let found=-1;
      for(let offset=0;offset<Math.min(path.n/8,80)&&found<0;offset++){
        const i=(mid+offset)%path.n;if(i*path.ds<85||path.length-i*path.ds<80)continue;
        let safe=true;const kind=modeOnPath(path.id,path.prog[i]);
        for(let d=-Math.ceil(26/path.ds);d<=Math.ceil(40/path.ds);d++){
          const j=path.closed?(i+d+path.n)%path.n:Math.max(0,Math.min(path.n-1,i+d));
          if(!(path.flags[j]&F_SOLID)||Math.abs(path.slope[j])>0.18||modeOnPath(path.id,path.prog[j])!==kind)safe=false;
        }
        if(path.main&&paths.slice(1).some(p=>Math.abs(p.t0-path.prog[i])*path.length<85||Math.abs(((p.t0+p.span)%1)-path.prog[i])*path.length<85))safe=false;
        if(safe)found=i;
      }
      if(found<0)continue;
      const i=found,mode=modeOnPath(path.id,path.prog[i]);
      const theme=track.theme;
      const kind=mode==="boat"||mode==="sub"?"current":track.indoor?"piston":theme==="sunset"||theme==="slime"?"vent":mode==="hover"||mode==="plane"||["techno","y2k","cyberpunk","webcore","win98"].includes(theme)?"sweeper":"sprout";
      events.push({id:events.length,path:path.id,idx:i,x:path.px[i],y:path.py[i]+(mode==="plane"?2.6:mode==="sub"?1.3:0),z:path.pz[i],tx:path.tx[i],tz:path.tz[i],half:path.half[i],side:events.length%2?-1:1,kind,mode,phase:(seed*7+events.length*1.73)%7.2,period:7.2+seed});
    }
  }
  return events;
}
export function eventPose(event:EnvironmentEvent,ms:number,out:EventPose):EventPose {
  const t=((ms*0.001+event.phase)%event.period+event.period)%event.period;
  out.active=t>=5.8&&t<7.1;
  const lateral=event.side*event.half*(0.54+(event.kind==="sweeper"?Math.sin(t*2)*0.12:0));
  out.x=event.x-event.tz*lateral;out.y=event.y;out.z=event.z+event.tx*lateral;out.heading=Math.atan2(event.tx,event.tz);
  out.lift=out.active?Math.min(1,(t-5.8)*20,(7.1-t)*10):0;
  out.radius=Math.min(1.25,event.half*0.2);return out;
}
/** Swept horizontal contact: a fast kart cannot step over a narrow obstacle. */
export function eventContact(event:EnvironmentEvent,pose:EventPose,path:number,fromX:number,fromY:number,fromZ:number,x:number,y:number,z:number):"hit"|"near"|null {
  if(!pose.active||pose.lift<0.18||path!==event.path)return null;
  const dx=x-fromX,dz=z-fromZ;const len=dx*dx+dz*dz;
  const u=len>1e-8?Math.max(0,Math.min(1,((pose.x-fromX)*dx+(pose.z-fromZ)*dz)/len)):0;
  if(Math.abs(fromY+(y-fromY)*u-pose.y)>2.2)return null;
  const distance=Math.hypot(fromX+dx*u-pose.x,fromZ+dz*u-pose.z);
  return distance<pose.radius+0.9?"hit":distance<pose.radius+2.6?"near":null;
}
export class NearMissLedger {
  private readonly laps=new Map<number,number>();
  claim(id:number,lap:number,speed:number,forward:number):boolean {
    if(speed<12||forward<0.9||(this.laps.get(id)??-Infinity)>=lap)return false;
    this.laps.set(id,lap);return true;
  }
}
