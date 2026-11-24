/** Standard Web Gamepad mapping: OS/WebView owns the device driver. */
export interface PadInput {steer:number;throttle:number;item:boolean;drift:boolean;turbo:boolean;swap:boolean;fuse:boolean;pause:boolean;lookBack:boolean;ability:boolean}
export const emptyPad=():PadInput=>({steer:0,throttle:0,item:false,drift:false,turbo:false,swap:false,fuse:false,pause:false,lookBack:false,ability:false});
export function deadzone(value:number,zone=0.18){return Number.isFinite(value)?Math.sign(value)*Math.max(0,(Math.min(1,Math.abs(value))-zone)/(1-zone)):0;}
/** Pad buttons that can be given to another action; triggers and the cross stay as they are. */
export type PadAction="item"|"drift"|"turbo"|"ability"|"swap"|"fuse"|"pause"|"lookBack";
export const PAD_ACTIONS:PadAction[]=["item","drift","turbo","ability","swap","fuse","lookBack","pause"];
export const DEFAULT_PAD_BINDS:Record<PadAction,number>={item:0,drift:1,turbo:2,ability:3,swap:4,fuse:5,pause:9,lookBack:11};
/** Names of the standard buttons, as printed on most pads. */
export const PAD_BUTTON_NAMES=["A","B","X","Y","LB","RB","LT","RT","Back","Start","L3","R3","↑","↓","←","→","Home"];
export interface PadConfig {binds:Record<PadAction,number>;deadzone:number;/** 1 straight, above 1 gentler near the middle */curve:number}
export const DEFAULT_PAD_CONFIG:PadConfig={binds:DEFAULT_PAD_BINDS,deadzone:0.18,curve:1};
/** What the pad looked like on the last read, for the input tester. */
export interface PadSnapshot {id:string;axes:number[];buttons:number[];steer:number;throttle:number}
export class PadReader {
  get connected(){return this.index>=0;}
  config:PadConfig=DEFAULT_PAD_CONFIG;
  snapshot:PadSnapshot|null=null;
  private index=-1;private blocked=true;private pause=false;
  suspend(){this.blocked=true;this.pause=false;}
  read(pads:readonly (Gamepad|null)[]):PadInput {
    const out=emptyPad(),pad=pads.find(p=>p?.connected&&p.mapping==="standard");
    if(!pad){this.index=-1;this.snapshot=null;this.suspend();return out;}
    if(this.index!==pad.index){this.index=pad.index;this.suspend();}
    const button=(i:number)=>{const b=pad.buttons[i];return b?Math.min(1,Math.max(0,Number.isFinite(b.value)?b.value:0)):0;};
    const held=(i:number)=>button(i)>0.5;
    const {binds,deadzone:zone,curve}=this.config;
    const shape=(v:number)=>{const d=deadzone(v,zone);return Math.sign(d)*Math.pow(Math.abs(d),curve);};
    const neutral=!pad.buttons.some(b=>b.pressed||b.value>0.2)&&pad.axes.every(a=>Math.abs(a)<Math.max(0.2,zone));
    this.snapshot={id:pad.id,axes:[...pad.axes],buttons:pad.buttons.map((_,i)=>button(i)),steer:0,throttle:0};
    if(this.blocked){if(neutral)this.blocked=false;return out;}
    out.steer=shape(pad.axes[0]??0)||Number(held(15))-Number(held(14));
    out.throttle=button(7)-button(6)||-shape(pad.axes[1]??0)||Number(held(12))-Number(held(13));
    out.lookBack=held(binds.lookBack);out.ability=held(binds.ability);out.item=held(binds.item);out.drift=held(binds.drift);out.turbo=held(binds.turbo);out.swap=held(binds.swap);out.fuse=held(binds.fuse);
    out.pause=held(binds.pause)&&!this.pause;this.pause=held(binds.pause);
    this.snapshot.steer=out.steer;this.snapshot.throttle=out.throttle;return out;
  }
}
/** The reader the race uses; the options screen looks at it to show what the pad is doing. */
export const sharedPad=new PadReader();
let rumbleLevel=0.7;
export function setRumbleLevel(v:number){rumbleLevel=Math.max(0,Math.min(1,v));}
/** Shake the pad, if it can: strength 0..1 for a number of milliseconds. */
export function rumble(strength:number,ms:number){
  if(rumbleLevel<=0||typeof navigator==="undefined"||typeof navigator.getGamepads!=="function")return;
  try{
    for(const p of navigator.getGamepads()){
      const act=(p as (Gamepad&{vibrationActuator?:{playEffect?:(t:string,o:object)=>Promise<unknown>}})|null)?.vibrationActuator;
      const s=Math.min(1,strength*rumbleLevel);
      act?.playEffect?.("dual-rumble",{duration:ms,strongMagnitude:s,weakMagnitude:Math.min(1,s*1.3)})?.catch(()=>{});
    }
  }catch{/* no pads */}
}
