import type {PathRT} from "./trackCurve";
import type {TrackDef} from "./data";
export interface SurfaceSite {id:number;kind:"bridge"|"flood";path:number;first:number;last:number;ds:number;x:number;y:number;z:number;side:number;half:number;stage:number;changed:number}
export let surfaceSites:SurfaceSite[]=[];
export function resetSurfaces(){for(const s of surfaceSites){s.stage=1;s.changed=0;}}
export function clearSurfaces(){surfaceSites=[];}
/** Short, straight, isolated, solid sections. A collapse always preserves half the road. */
export function configureSurfaces(paths:PathRT[],def:TrackDef){
  surfaceSites=[];
  const seed=[...def.id].reduce((v,c)=>v+c.charCodeAt(0),0);
  for(const kind of ["bridge","flood"] as const){
    const candidates=kind==="bridge"?paths.slice(1).reverse():[paths[0]];
    let selected=false;
    for(const p of candidates){
      if(selected)break;if(kind==="bridge"&&(p.def?.afloat||p.half[0]<5.5))continue;
      const span=Math.max(3,Math.ceil(7/p.ds)),edge=Math.ceil((p.main?100:35)/p.ds);
      const mid=Math.round(p.n*(kind==="bridge"?0.24:0.53));
      for(let a=0;a<p.n;a++){
        const i=mid+Math.ceil(a/2)*(a%2?1:-1);if(i-span<edge||i+span>=p.n-edge)continue;
        if(p.main&&def.zones.some(z=>p.prog[i]>=z.t0-0.025&&p.prog[i]<=z.t1+0.025))continue;
        if(p.main&&paths.slice(1).some(q=>Math.min(Math.abs(q.t0-p.prog[i]),Math.abs(q.t0+q.span-p.prog[i]))*p.length<90))continue;
        let safe=true;
        for(let j=i-span-5;j<=i+span+5;j++)if(!(p.flags[j]&1)||(p.flags[j]&8)||Math.abs(p.slope[j])>0.1||p.tx[j]*p.tx[i]+p.tz[j]*p.tz[i]<0.97){safe=false;break;}
        if(!safe)continue;
        // Other ribbons must not cover the missing half or intersect the water patch.
        for(const q of paths)for(let j=0;j<q.n;j++){
          if(q===p&&Math.abs(j-i)*p.ds<55)continue;
          if(Math.abs(q.py[j]-p.py[i])>8)continue;
          if(Math.hypot(q.px[j]-p.px[i],q.pz[j]-p.pz[i])<p.half[i]+q.half[j]+12){safe=false;break;}
        }
        if(!safe)continue;
        surfaceSites.push({id:surfaceSites.length,kind,path:p.id,first:i-span,last:i+span,ds:p.ds,x:p.px[i],y:p.py[i],z:p.pz[i],side:seed%2?1:-1,half:p.half[i],stage:1,changed:0});
        selected=true;break;
      }
    }
  }
}
export function evolveSurfaces(lap:number,ms:number,occupied:(site:SurfaceSite)=>boolean){
  if(!Number.isFinite(lap)||!Number.isFinite(ms))return;
  const stage=Math.max(1,Math.min(3,Math.floor(lap)));
  for(const site of surfaceSites)if(stage>site.stage&&!occupied(site)){if(site.kind!=="bridge"||site.stage===1)site.changed=ms;site.stage=stage;}
}
export function bridgeDrop(site:SurfaceSite,ms:number){return site.stage<2?0:Math.min(22,Math.max(0,(ms-site.changed)/1000)*18);}
let clock=0;
export function setSurfaceClock(ms:number){clock=Number.isFinite(ms)?ms:clock;}
export function hasSurface(path:number,idx:number,along:number,lat:number){
  for(const s of surfaceSites)if(s.kind==="bridge"&&s.path===path&&s.stage>1&&lat*s.side>0&&bridgeDrop(s,clock)>0.5){
    const at=idx*s.ds+along;
    if(at>=s.first*s.ds&&at<s.last*s.ds)return false;
  }
  return true;
}
/** Mesh replacement uses exactly the same sample edges as the support query. */
export function replacedDeck(path:number,idx:number){return surfaceSites.some(s=>s.kind==="bridge"&&s.path===path&&idx>=s.first&&idx<s.last);}
export function floodDepth(site:SurfaceSite,idx:number){
  if(site.kind!=="flood"||site.stage<2||idx<site.first||idx>site.last)return 0;
  return (site.stage===2?0.18:0.32)*Math.sin(Math.PI*(idx-site.first)/(site.last-site.first));
}
export function surfaceWater(path:number,idx:number){let depth=0;for(const s of surfaceSites)if(s.path===path)depth=Math.max(depth,floodDepth(s,idx));return depth;}
export function bridgeLane(path:number,idx:number,lookAhead:number):number|null{
  for(const s of surfaceSites)if(s.kind==="bridge"&&s.path===path&&s.stage>1&&idx>=s.first-Math.ceil(lookAhead/s.ds)&&idx<s.last+Math.ceil(10/s.ds))return -s.side*s.half*0.52;
  return null;
}
