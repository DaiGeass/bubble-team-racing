import type {VehicleMode} from "./data";
export type ManeuverKind="roll"|"dive"|"pulse"|"hop"|"trick";
export interface ManeuverInput {mode:VehicleMode;held:boolean;steer:number;speed:number;airborne:boolean;clean:boolean;distance:number}
/** Reuses drift: steering on the road still drifts; a new press in flight performs a move. */
export class Maneuver {
  kind:ManeuverKind|null=null;age=0;cooldown=0;roll=0;pitch=0;lateral=0;
  private held=false;private from=0;private sign=1;private pending=false;private last=-Infinity;
  reset(){this.kind=null;this.age=0;this.roll=this.pitch=this.lateral=0;this.pending=false;this.cooldown=0.6;}
  step(dt:number,input:ManeuverInput):{start:ManeuverKind|null;reward:boolean;lift:number;dive:number} {
    const result={start:null as ManeuverKind|null,reward:false,lift:0,dive:0};
    if(!Number.isFinite(dt)||dt<=0)return result;
    dt=Math.min(dt,0.1);this.cooldown=Math.max(0,this.cooldown-dt);
    const press=input.held&&!this.held;this.held=input.held;
    if(!input.clean||input.speed<8){this.reset();return result;}
    if(this.pending&&!input.airborne){
      result.reward=input.distance-this.from>=12&&input.distance-this.last>=18;
      if(result.reward)this.last=input.distance;this.pending=false;
    }
    if(!this.kind&&!this.pending&&press&&this.cooldown===0&&input.speed>=12){
      this.kind=input.mode==="plane"?"roll":input.mode==="sub"?"dive":input.mode==="hover"&&!input.airborne?"pulse":input.mode==="boat"&&!input.airborne&&Math.abs(input.steer)<0.25?"hop":input.mode==="land"&&input.airborne?"trick":null;
      if(this.kind){this.age=0;this.from=input.distance;this.sign=input.steer<0?-1:1;result.start=this.kind;this.cooldown=3;
        if(this.kind==="hop")result.lift=6.5;
      }
    }
    this.roll=this.pitch=this.lateral=0;
    if(!this.kind)return result;
    this.age+=dt;
    const duration=this.kind==="roll"?0.85:this.kind==="trick"?0.5:this.kind==="hop"?0.36:0.65;
    const u=Math.min(1,this.age/duration),wave=Math.sin(u*Math.PI),ease=u*u*(3-2*u);
    if(this.kind==="roll"||this.kind==="trick")this.roll=-this.sign*ease*Math.PI*2;
    if(this.kind==="dive"){this.pitch=wave*0.4;result.dive=-16*(1-0.5*u)*dt;}
    if(this.kind==="pulse"||this.kind==="roll")this.lateral=-this.sign*wave*(this.kind==="pulse"?5:3);
    if((this.kind==="trick"||this.kind==="hop")&&!input.airborne&&this.age>0.08&&u<1){this.reset();return result;}
    if(u===1){
      if(this.kind==="hop"||this.kind==="trick")this.pending=true;
      else {result.reward=input.distance-this.from>=12&&input.distance-this.last>=18;if(result.reward)this.last=input.distance;}
      this.kind=null;this.roll=this.pitch=this.lateral=0;
    }
    return result;
  }
}
