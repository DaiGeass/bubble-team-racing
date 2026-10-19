/** Standard Web Gamepad mapping: OS/WebView owns the device driver. */
export interface PadInput {steer:number;throttle:number;item:boolean;drift:boolean;turbo:boolean;swap:boolean;fuse:boolean;pause:boolean}
export const emptyPad=():PadInput=>({steer:0,throttle:0,item:false,drift:false,turbo:false,swap:false,fuse:false,pause:false});
export function deadzone(value:number,zone=0.18){return Number.isFinite(value)?Math.sign(value)*Math.max(0,(Math.min(1,Math.abs(value))-zone)/(1-zone)):0;}
export class PadReader {
  get connected(){return this.index>=0;}
  private index=-1;private blocked=true;private pause=false;
  suspend(){this.blocked=true;this.pause=false;}
  read(pads:readonly (Gamepad|null)[]):PadInput {
    const out=emptyPad(),pad=pads.find(p=>p?.connected&&p.mapping==="standard");
    if(!pad){this.index=-1;this.suspend();return out;}
    if(this.index!==pad.index){this.index=pad.index;this.suspend();}
    const button=(i:number)=>{const b=pad.buttons[i];return b?Math.min(1,Math.max(0,Number.isFinite(b.value)?b.value:0)):0;};
    const held=(i:number)=>button(i)>0.5;
    const neutral=!pad.buttons.some(b=>b.pressed||b.value>0.2)&&pad.axes.every(a=>Math.abs(a)<0.2);
    if(this.blocked){if(neutral)this.blocked=false;return out;}
    out.steer=deadzone(pad.axes[0]??0)||Number(held(15))-Number(held(14));
    out.throttle=button(7)-button(6)||-deadzone(pad.axes[1]??0)||Number(held(12))-Number(held(13));
    out.item=held(0);out.drift=held(1);out.turbo=held(2);out.swap=held(4);out.fuse=held(5);
    out.pause=held(9)&&!this.pause;this.pause=held(9);return out;
  }
}
