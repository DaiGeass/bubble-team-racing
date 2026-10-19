import type {VehicleMode} from "./data";
export interface SurfaceSound {mode:VehicleMode;speed:number;grounded:boolean;rough:boolean;wet:boolean}
/** Shared profile keeps surface sound bounded even at boost speeds. */
export function surfaceSoundProfile(s:SurfaceSound){
  const speed=Number.isFinite(s.speed)?Math.min(1.5,Math.max(0,s.speed)/45):0;
  const water=s.wet||s.mode==="boat"||s.mode==="sub";
  const active=s.grounded||s.mode!=="land";
  return {frequency:s.mode==="sub"?180:water?650:s.mode==="plane"?1600:s.mode==="hover"?420:s.rough?1100:1900,
    gain:active?Math.min(0.055,speed*(water?0.04:s.rough?0.033:0.016)):0,q:s.mode==="hover"?3:0.7};
}
export function landingSound(impact:number,water:boolean){const hit=Number.isFinite(impact)?Math.min(24,Math.max(0,impact)):0;return {freq:water?190:95,duration:0.06+hit*0.007,volume:Math.min(0.19,hit*0.009)};}

/** The chase camera faces along the road: its right is the vehicle’s local -X. */
export function passPan(dx:number,dz:number,heading:number){return Math.max(-1,Math.min(1,-dx*Math.cos(heading)+dz*Math.sin(heading)));}
