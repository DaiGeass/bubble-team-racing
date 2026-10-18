import type { LifeSpot } from "./trackLife";
import { groundAt, makeGround } from "./trackCurve";
export interface TrackActor { anchor: LifeSpot; kind:"fish"|"butterfly"|"drone"; radius:number }
export function trackActors(spots: readonly LifeSpot[], indoor: boolean): TrackActor[] {
  const actors:TrackActor[]=[]; const probe=makeGround(); const limit=indoor?12:24;
  for(let i=0;i<spots.length&&actors.length<limit;i+=2) {
    const anchor=spots[i]; let radius=indoor?0.25:1.6;
    if(!indoor) {
      let clear=true;
      for(let j=0;j<12;j++) if(groundAt(anchor.x+Math.cos(j*Math.PI/6)*(radius+1),anchor.z+Math.sin(j*Math.PI/6)*(radius+1),1e6,probe,0)){clear=false;break;}
      if(!clear)radius=0;
    }
    const kind=anchor.kind==="buoy"?"fish":anchor.kind==="flower"?"butterfly":"drone";
    actors.push({anchor,kind,radius});
  }
  return actors;
}
export interface ActorPose {x:number;y:number;z:number;heading:number;bank:number;wing:number}
/** Absolute time: distant actors resume without integrating missed frames. */
export function actorPose(actor:TrackActor,time:number,out:ActorPose):ActorPose {
  const a=actor.anchor; const t=time*(actor.kind==="fish"?0.55:actor.kind==="drone"?0.65:0.9)+a.phase;
  out.x=a.x+Math.cos(t)*actor.radius;out.z=a.z+Math.sin(t)*actor.radius;
  out.y=a.y+(actor.kind==="fish"?-0.7:actor.kind==="butterfly"?2:a.kind==="vent"?-0.7:3.2)+Math.sin(t*1.7)*0.22;
  out.heading=-t;out.bank=Math.sin(t*1.4)*0.18;
  out.wing=actor.kind==="butterfly"?Math.sin(time*11+a.phase)*0.85:actor.kind==="fish"?Math.sin(time*6+a.phase)*0.28:time*18;
  return out;
}
