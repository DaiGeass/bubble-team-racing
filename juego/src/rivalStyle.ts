import type {CharacterDef} from "./data";
export type RivalStyle="attacker"|"explorer"|"finisher"|"drifter";
export const RIVAL_STYLES:Record<RivalStyle,{routes:number;cuts:number;mercy:number;delay:number;drift:number;reserve:number;clearance:number}>={
  attacker:{routes:0.9,cuts:0.9,mercy:0.65,delay:0.7,drift:1,reserve:-0.12,clearance:1.9},
  explorer:{routes:1.55,cuts:1.6,mercy:1.1,delay:1.1,drift:1,reserve:0,clearance:2.3},
  finisher:{routes:0.85,cuts:0.8,mercy:1,delay:1,drift:1.1,reserve:0.18,clearance:2.3},
  drifter:{routes:1,cuts:1.1,mercy:1.1,delay:1.1,drift:0.85,reserve:-0.04,clearance:2.3},
};
export function rivalStyle(character:Pick<CharacterDef,"role">):RivalStyle {
  return character.role==="heavy"?"attacker":character.role==="tech"||character.role==="trickster"?"explorer":character.role==="speed"?"finisher":"drifter";
}
/** Reserves energy early, then releases it for a nearby overtake or the last sector. */
export function rivalTurboThreshold(base:number,style:RivalStyle,progress:number,lastLap:boolean,targetAhead:boolean){
  const late=lastLap&&progress>0.65;
  const reserve=style==="finisher"&&(late||targetAhead)?-0.25:RIVAL_STYLES[style].reserve;
  return Math.max(0.35,Math.min(0.99,base+reserve));
}
