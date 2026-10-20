import {fusionShot,type CharacterDef,type FusionShot,type VehicleMode} from "./data";
import type {SkillKind} from "./adrenaline";

/** One signature volley per driver. Swaps, transforms and respawns share its reserve. */
export class AbilityReserve {
  charge=0.35;
  cooldown=0;
  private furthest:number|null=null;
  private lastSkill:SkillKind|null=null;
  step(dt:number,distance:number,speed:number,eligible:boolean){
    if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(distance))return;
    const h=Math.min(dt,0.1);
    this.cooldown=Math.max(0,this.cooldown-h);
    const previous=this.furthest;
    this.furthest=Math.max(previous??distance,distance);
    if(!eligible||!Number.isFinite(speed)||speed<8||previous===null)return;
    // Displacements from a warp/respawn cannot buy energy. Reverse travel never pays twice.
    const delta=distance-previous;
    const advance=delta>Math.max(0,speed)*h*1.25?0:Math.max(0,delta);
    this.charge=Math.min(1,this.charge+advance/1500);
  }
  reward(kind:SkillKind){
    const variety=kind!==this.lastSkill;
    this.lastSkill=kind;
    this.charge=Math.min(1,this.charge+(variety?0.13:0.065));
  }
  get ready(){return this.charge>=1-1e-8&&this.cooldown<=1e-8;}
  use(seconds:number,eligible:boolean){
    if(!eligible||!this.ready||!Number.isFinite(seconds)||seconds<=0)return false;
    this.charge=0;this.cooldown=seconds;return true;
  }
}
export function signatureShot(character:CharacterDef,mode:VehicleMode):FusionShot {
  const base=fusionShot(character.id,mode);
  // A burst is stronger than one auto-turret volley, but has a long shared recharge.
  return {...base,count:Math.min(5,base.count+1),power:Math.min(1.6,base.power*1.15)};
}
export function signatureCooldown(character:CharacterDef):number {
  return character.role==="tech"?10:character.role==="heavy"?16:13;
}
export interface AbilityTarget {id:string;x:number;y:number;z:number;team:number;unavailable:boolean}
/** Aim in world space, respecting vertical separation, teams and the chosen view. */
export function signatureTarget<T extends AbilityTarget>(self:AbilityTarget,heading:number,back:boolean,shot:Pick<FusionShot,"kind">,candidates:readonly T[]):T|null {
  const sign=back?-1:1,fx=Math.sin(heading)*sign,fz=Math.cos(heading)*sign;
  let best:T|null=null,bestDistance=shot.kind==="nova"?15*15:70*70;
  for(const other of candidates){
    if(other.id===self.id||other.unavailable||self.team>=0&&other.team===self.team||Math.abs(other.y-self.y)>5)continue;
    const dx=other.x-self.x,dz=other.z-self.z,d=dx*dx+dz*dz;
    if(d>=bestDistance||shot.kind!=="nova"&&(dx*fx+dz*fz)<Math.sqrt(d)*0.65)continue;
    best=other;bestDistance=d;
  }
  return best;
}
export function signatureNeedsTarget(shot:FusionShot){return shot.kind==="lance"||shot.kind==="mortar"||shot.kind==="homing"||shot.kind==="nova";}
