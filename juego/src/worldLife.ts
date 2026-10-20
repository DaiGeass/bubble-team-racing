import type {LifeSpot} from "./trackLife";
export interface LifeVisitor {x:number;y:number;z:number;speed:number}
/** Height-aware response: a racer on an overhead road cannot stir the water below. */
export function lifeReaction(spot:LifeSpot,visitor:LifeVisitor|undefined):number {
  if(!visitor||!Number.isFinite(visitor.x)||!Number.isFinite(visitor.y)||!Number.isFinite(visitor.z)||!Number.isFinite(visitor.speed))return 0;
  const vertical=spot.kind==="vent"?8:spot.kind==="drone"?10:5;
  if(Math.abs(visitor.y-spot.y)>vertical)return 0;
  const distance=Math.hypot(visitor.x-spot.x,visitor.z-spot.z);
  const reach=spot.kind==="vent"?23:31;
  return Math.max(0,1-distance/reach)*Math.min(1,Math.abs(visitor.speed)/28);
}
export function easeReaction(current:number,target:number,dt:number){
  if(!Number.isFinite(dt)||dt<=0)return current;
  return current+(target-current)*(1-Math.exp(-(target>current?12:2.4)*Math.min(dt,0.1)));
}
