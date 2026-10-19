import test from "node:test";
import assert from "node:assert/strict";
import {TRACKS} from "../src/data";
import {getPaths,setActiveTrack,F_SOLID} from "../src/trackCurve";
import {modeOnPath} from "../src/trackModes";
import {challengeSites,challengeState,resetChallenges,challengeStage,challengePose,makeChallengePose,challengeMotion,makeChallengeMotion,RiskRouteRun,type ChallengeSite,type ChallengeBody} from "../src/trackChallenges";
import {auditNewRoutes} from "./routeAudit";

const site:ChallengeSite={id:0,path:1,idx:10,u:0.5,x:0,y:0,z:0,tx:0,tz:1,half:6,risk:true,kind:"gate",mode:"land",phase:0};
const body=(x=0,y=0,z=-10):ChallengeBody=>({path:1,mode:"land",x,y,z,tx:0,tz:1,flow:0,grip:1});
test("all 41 circuits have a risk-route challenge and two evolving main-road sites covering all modes",()=>{
  const kinds=new Set<string>(),modes=new Set<string>();let count=0;
  for(const track of TRACKS){
    setActiveTrack(track.id);const sites=challengeSites();assert.equal(sites.length,3,track.id);assert.equal(challengeSites(),sites);
    assert.equal(sites.filter(s=>s.risk).length,1);assert.equal(sites.filter(s=>s.path===0).length,2);
    resetChallenges();assert.deepEqual([...challengeState.stages],[1,1,1]);
    for(const s of sites){count++;kinds.add(s.kind);modes.add(s.mode);const p=getPaths()[s.path];assert.ok(p.flags[s.idx]&F_SOLID);assert.equal(modeOnPath(s.path,p.prog[s.idx]),s.mode);assert.ok(s.idx*p.ds>=28&&p.length-s.idx*p.ds>=28);}
  }
  assert.equal(count,123);assert.equal(kinds.size,4);assert.equal(modes.size,5);
});
test("anchors preserve solid support and one mode throughout the moving obstacle footprint",()=>{
  for(const track of TRACKS){setActiveTrack(track.id);for(const s of challengeSites()){
    const p=getPaths()[s.path];
    for(let d=-Math.ceil(16/p.ds);d<=Math.ceil(16/p.ds);d++){
      const i=s.idx+d;assert.ok(p.flags[i]&F_SOLID,track.id);assert.ok(Math.abs(p.slope[i])<=0.26,track.id);assert.equal(modeOnPath(p.id,p.prog[i]),s.mode);
    }
  }}
});
test("all moving openings retain kart clearance inside the lane at every stage",()=>{
  for(const track of TRACKS){setActiveTrack(track.id);for(const s of challengeSites())for(const stage of [1,2,3])for(let ms=0;ms<12000;ms+=200){
    const p=challengePose(s,ms,stage,makeChallengePose());
    assert.ok(p.gapHalf>=2.5);assert.ok(Math.abs(p.gap)+p.gapHalf+0.79<=s.half);assert.equal(p.active,s.risk||stage>1);
  }}
});
test("risk shutters sometimes require leaving the centre line rather than driving straight through",()=>{
  for(const track of TRACKS){setActiveTrack(track.id);for(const s of challengeSites().filter(s=>s.risk&&s.kind==="gate")){
    let blocked=0,open=0;
    for(let ms=0;ms<20000;ms+=200){
      const out=challengeMotion({path:s.path,mode:s.mode,x:s.x-s.tx*10,y:s.y,z:s.z-s.tz*10,tx:s.tx,tz:s.tz,flow:0,grip:1},s.tx*20,s.tz*20,0.1,ms,[3,3,3],makeChallengeMotion(),[s]);
      if(out.hit)blocked++;else open++;
    }
    assert.ok(blocked>0&&open>0,track.id);
  }}
});
test("evolution waits until a site is unoccupied, never reverses and caps at the last stage",()=>{
  assert.equal(challengeStage(1,2,true),1);assert.equal(challengeStage(1,3,true),1);
  assert.equal(challengeStage(1,2,false),2);assert.equal(challengeStage(2,3,false),3);
  assert.equal(challengeStage(3,1,false),3);assert.equal(challengeStage(1,99,false),3);assert.equal(challengeStage(1,NaN,false),1);
});
test("fast forward and reverse motion cannot tunnel through a closed shutter",()=>{
  const pose=challengePose(site,0,3,makeChallengePose()),x=-(pose.gap+pose.gapHalf+1);
  for(const sign of [-1,1]) {
    const out=challengeMotion(body(x,0,-20*sign),0,40*sign,0.1,0,[3],makeChallengeMotion(),[site]);
    assert.equal(out.hit,true);assert.ok(Math.abs(out.dz)<20);assert.equal(out.cleared,0);
  }
});
test("the physical gap and a clean jump over a shutter remain passable",()=>{
  const pose=challengePose(site,0,3,makeChallengePose());
  const through=challengeMotion(body(-pose.gap),0,20,0.1,0,[3],makeChallengeMotion(),[site]);
  assert.equal(through.hit,false);assert.equal(through.dz,20);assert.equal(through.cleared,1);
  const jump=challengeMotion(body(-5,5),0,20,0.1,0,[3],makeChallengeMotion(),[site]);
  assert.equal(jump.hit,false);assert.equal(jump.cleared,1);
});
test("a driver blocked by a shutter retains lateral movement to reach its opening",()=>{
  const pose=challengePose(site,0,3,makeChallengePose());
  const out=challengeMotion(body(-(pose.gap+pose.gapHalf+1),0,-1.5),0.15,1,1/60,0,[3],makeChallengeMotion(),[site]);
  assert.equal(out.hit,true);assert.ok(Math.abs(out.dx-0.15)<1e-8);
});
test("shutters respect ghost power, alternate floors, paths and vehicle mode",()=>{
  for(const sample of [{...body(-5),ghost:true},{...body(-5),path:2},{...body(-5),mode:"boat" as const},body(-5,-10)]){
    const out=challengeMotion(sample,0,20,0.1,0,[3],makeChallengeMotion(),[site]);assert.equal(out.hit,false);assert.equal(out.cleared,0);
  }
});
test("water, air and magnetic fields exert bounded drift only outside their calm channel",()=>{
  for(const [kind,mode] of [["current","boat"],["gust","plane"],["magnet","hover"]] as const){
    const field={...site,kind,mode};const pose=challengePose(field,0,3,makeChallengePose());
    const calm=challengeMotion({...body(-pose.gap),mode},0,20,0.1,0,[3],makeChallengeMotion(),[field]);assert.equal(calm.field,false);assert.equal(calm.flow,0);
    const rough=challengeMotion({...body(-5),mode},0,20,0.1,0,[3],makeChallengeMotion(),[field]);assert.equal(rough.field,true);assert.ok(Math.abs(rough.flow)>0&&Math.abs(rough.flow)<=3.5);assert.equal(rough.hit,false);
  }
});
test("field integration is close at 20/30/60/144 Hz and residual drift decays",()=>{
  const ends:number[]=[];const field={...site,kind:"current" as const,mode:"boat" as const};
  for(const hz of [20,30,60,144]){
    const b={...body(-5,0,-20),mode:"boat" as const};
    for(let i=0;i<hz*3;i++){
      const out=challengeMotion(b,0,20/hz,1/hz,i*1000/hz,[3],makeChallengeMotion(),[field]);b.x+=out.dx;b.z+=out.dz;b.flow=out.flow;assert.ok(Math.abs(b.flow)<=3.5);
    }
    assert.ok(Math.abs(b.flow)<0.15);ends.push(b.x);
  }
  assert.ok(Math.max(...ends)-Math.min(...ends)<0.2,JSON.stringify(ends));
});
test("a paused race clock freezes obstacle poses and cannot apply drift or impacts",()=>{
  const b={...body(-5),flow:1.2};const expected=challengePose(site,4200,2,makeChallengePose());
  for(let i=0;i<100;i++)assert.deepEqual(challengePose(site,4200,2,makeChallengePose()),expected);
  const out=challengeMotion(b,0,0,0,4200,[2],makeChallengeMotion(),[site]);assert.equal(out.hit,false);assert.equal(out.field,false);assert.equal(out.flow,1.2);assert.equal(out.dx,0);assert.equal(out.dz,0);
});
function run(route:RiskRouteRun,lap=1,broken=false,clears=true){
  for(let i=0;i<23;i++){
    const u=0.08+i*0.04;
    route.step(1,u,lap,lap-1+0.2+u*0.2,35,!broken,clears&&i===12);
  }
  return route.step(0,0.4,lap,lap-1+0.402,35,true,false);
}
test("risk-route reward requires a full clean route and can be claimed once per lap",()=>{
  const route=new RiskRouteRun(1,0.4,1000);
  assert.equal(run(route),true);assert.equal(route.score,180);assert.equal(run(route),false);
  assert.equal(run(route,2),true);assert.equal(route.score,360);assert.equal(run(route,1),false);
});
test("dirty runs, missing the opening and entering halfway never award a route bonus",()=>{
  assert.equal(run(new RiskRouteRun(1,0.4,1000),1,true),false);
  assert.equal(run(new RiskRouteRun(1,0.4,1000),1,false,false),false);
  const route=new RiskRouteRun(1,0.4,1000);route.step(1,0.6,1,0.32,35,true,true);assert.equal(route.step(0,0.4,1,0.402,35,true,false),false);
});
test("reversing, teleports and falls invalidate risk-route completion",()=>{
  for(const reason of ["reverse","teleport","fall"]){
    const route=new RiskRouteRun(1,0.4,1000);route.step(1,0.1,1,0.22,35,true,false);
    if(reason==="reverse")route.step(1,0.08,1,0.216,-5,true,false);
    if(reason==="teleport")route.step(1,0.9,1,0.38,35,true,true);
    if(reason==="fall")route.reset();
    for(let i=0;i<22;i++){const u=0.12+i*0.04;route.step(1,u,1,0.2+u*0.2,35,true,i===10);}
    assert.equal(route.step(0,0.4,1,0.402,35,true,false),false,reason);
  }
});
test("every alternate route remains enterable and traversable in stages two and three at 30/60 Hz",()=>{
  for(const hz of [30,60])for(const stage of [2,3])for(const row of auditNewRoutes(hz,stage,stage*1700)){
    assert.equal(row.used,true,`${row.id}: enter at ${hz}/${stage}`);assert.equal(row.finished,true,`${row.id}: finish at ${hz}/${stage}`);assert.equal(row.falls,0,`${row.id}: fall at ${hz}/${stage}`);assert.equal(row.cleared,true,`${row.id}: challenge at ${hz}/${stage}`);
  }
});

test("invalid obstacle time cannot poison position or current inertia",()=>{
  const site=challengeSites()[0],b={path:site.path,mode:site.mode,x:site.x,y:site.y,z:site.z,tx:site.tx,tz:site.tz,flow:1.2,grip:1};
  const out=challengeMotion(b,0.5,0.7,NaN,0,[3],makeChallengeMotion(),[site]);
  assert.equal(out.dx,0.5);assert.equal(out.dz,0.7);assert.equal(out.flow,1.2);assert.equal(out.hit,false);
});
