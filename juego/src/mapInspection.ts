import {getPaths,F_SOLID,F_TUNNEL,type PathRT} from "./trackCurve";
import {modeOnPath} from "./trackModes";
import type {VehicleMode} from "./data";
export function inspectPath(path:PathRT){
  const modes=new Set<VehicleMode>();let holes=0,tunnels=0,minHalf=Infinity,maxSlope=0;
  const issues:string[]=[];
  for(let i=0;i<path.n;i++){
    if(![path.px[i],path.py[i],path.pz[i],path.tx[i],path.tz[i],path.half[i],path.slope[i]].every(Number.isFinite))issues.push(`non-finite sample ${i}`);
    if(path.half[i]<=0)issues.push(`invalid width ${i}`);
    minHalf=Math.min(minHalf,path.half[i]);maxSlope=Math.max(maxSlope,Math.abs(path.slope[i]));
    if(!(path.flags[i]&F_SOLID))holes++;
    if(path.flags[i]&F_TUNNEL)tunnels++;
    modes.add(modeOnPath(path.id,path.prog[i]));
  }
  return {id:path.id,main:path.main,length:Math.round(path.length),samples:path.n,minWidth:+(minHalf*2).toFixed(2),maxSlope:+maxSlope.toFixed(3),holes,tunnels,modes:[...modes],issues};
}
export const inspectMap=()=>getPaths().map(inspectPath);
