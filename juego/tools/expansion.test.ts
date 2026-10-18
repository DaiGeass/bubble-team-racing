import test from "node:test";
import assert from "node:assert/strict";
import {TRACKS,THEMES,SHAPES,BOATS,PLANES,SUBS,HOVERS,craftSpeed,craftHandling,type FinishId} from "../src/data";
import {getPaths,setActiveTrack,F_SOLID,type PathRT} from "../src/trackCurve";
import {buildPace,trackPace,cruisePace,lapTimeBudget} from "../src/trackPace";
import {NEW_CRAFT,craftParts} from "../src/craftModels";
import {lifeSpots} from "../src/trackLife";
import {actorPose,trackActors,type ActorPose} from "../src/trackActors";
import {paintOptions} from "../src/game/paint";
import {MODEL_NAMES} from "../src/i18n9";

function straight():PathRT {
  setActiveTrack(TRACKS[0].id);
  const source=getPaths()[0]; const n=220;
  return {...source,n,closed:false,main:false,length:440,ds:2,
    tx:new Float32Array(n),tz:new Float32Array(n).fill(1),slope:new Float32Array(n),
    half:new Float32Array(n).fill(10),flags:new Uint8Array(n).fill(F_SOLID)};
}
test("all 41 pace profiles are bounded and continuous, including lap seams and circuit switches",()=>{
  let boosted=0;
  for(const track of TRACKS){
    setActiveTrack(track.id);
    assert.equal(trackPace(-1,0),1);assert.equal(trackPace(0,NaN),1);
    for(const path of getPaths())for(let i=0;i<path.n;i++){
      const pace=trackPace(path.id,i);assert.ok(Number.isFinite(pace)&&pace>=1&&pace<=(track.indoor?1.14001:1.26001),track.id);
      if(pace>1.05)boosted++;
      if(!(path.flags[i]&F_SOLID)||Math.abs(path.slope[i])>0.22||path.half[i]<5)assert.equal(pace,1,track.id);
      if(i>0)assert.ok(Math.abs(pace-trackPace(path.id,i-1))<=0.004*path.ds+1e-5,track.id);
      if(i===path.n-1&&path.closed)assert.ok(Math.abs(pace-trackPace(path.id,0))<=0.004*path.ds+1e-5,track.id);
    }
  }
  assert.ok(boosted>1000);
});
test("safe straight roads have a higher cruise limit, with a lower indoor ceiling",()=>{
  const p=straight();const outside=buildPace(p,false),inside=buildPace(p,true);
  assert.ok(Math.abs(outside[100]-1.26)<1e-6);assert.ok(Math.abs(inside[100]-1.14)<1e-6);
  assert.equal(outside[0],1);assert.equal(outside[p.n-1],1);
});
test("cruise backs off before holes, steep ramps, tight bends, junctions and jump pads",()=>{
  const p=straight();p.flags[130]=0;
  assert.equal(buildPace(p,false)[100],1);
  p.flags[130]=F_SOLID;p.slope[130]=0.5;assert.equal(buildPace(p,false)[100],1);
  p.slope[130]=0;p.tx[130]=1;p.tz[130]=0;assert.equal(buildPace(p,false)[100],1);
  p.tx[130]=0;p.tz[130]=1;
  assert.equal(buildPace(p,false,[220])[100],1);assert.equal(buildPace(p,false,[],[250])[100],1);
});
test("braking, drifting, damage, airborne travel and facing away cannot gain cruise speed",()=>{
  assert.equal(cruisePace(1.26,25,0,false,false,false),1.26);
  assert.equal(cruisePace(1.26,-10,0,false,false,false),1);
  for(const flags of [[true,false,false],[false,true,false],[false,false,true]] as const)assert.equal(cruisePace(1.26,25,0,...flags),1);
  assert.equal(cruisePace(1.26,25,1,false,false,false),1);
  assert.equal(cruisePace(1.26,25,0,false,false,false,0.5),1);
  assert.ok(cruisePace(1.26,25,0.3,false,false,false)<1.26);
});
test("a narrow gap between coarse lookahead probes still disables cruise before takeoff",()=>{
  const p=straight();
  // 58 metres ahead, between the old 12-metre probes.
  p.flags[129]=0;
  assert.equal(buildPace(p,false)[100],1);
  p.flags[129]=F_SOLID;p.slope[129]=0.5;
  assert.equal(buildPace(p,false)[100],1);
});
test("time bonus reference follows circuit distance instead of a fixed 55 seconds",()=>{
  const samples=TRACKS.map(t=>{setActiveTrack(t.id);return {length:getPaths()[0].length,budget:lapTimeBudget()};});
  assert.ok(samples.every(x=>Number.isFinite(x.budget)&&x.budget>=40000));
  samples.sort((a,b)=>a.length-b.length);
  assert.ok(samples[samples.length-1].budget>samples[0].budget*1.5);
  assert.ok(samples[samples.length-1].budget>150000);
});
test("ten new selectable craft have unique ids and usable speed/handling rows",()=>{
  const groups={land:SHAPES.map(s=>s.id),boat:BOATS,plane:PLANES,sub:SUBS,hover:HOVERS};
  const ids=Object.values(NEW_CRAFT).flat();assert.equal(new Set(ids).size,10);
  for(const [mode,list] of Object.entries(NEW_CRAFT))for(const id of list){
    assert.ok((groups[mode as keyof typeof groups] as readonly string[]).includes(id));
    if(mode!=="land"){assert.ok(craftSpeed(id,0)>0.8&&craftSpeed(id,0)<1.4);assert.ok(craftHandling(id,0)>0.7);}
  }
  for(const list of Object.values(groups))assert.equal(new Set(list).size,list.length);
});
test("new silhouettes use a bounded, finite mesh budget and distinct shapes",()=>{
  const silhouettes=new Set<string>();
  for(const id of Object.values(NEW_CRAFT).flat()){
    const parts=craftParts(id);assert.ok(parts.length>=7&&parts.length<=24,id);
    assert.ok(new Set(parts.map(p=>p.shape)).size>=2,id);
    for(const p of parts){assert.ok([...p.at,...p.size,...p.rotation].every(Number.isFinite));assert.ok(p.size.every(s=>s>0));}
    silhouettes.add(JSON.stringify(parts));
  }
  assert.equal(silhouettes.size,10);
});
test("new model names exist in all eight interface languages",()=>{
  for(const dictionary of Object.values(MODEL_NAMES))for(const [mode,ids] of Object.entries(NEW_CRAFT))for(const id of ids){
    const key=`${mode==="land"?"shape":mode}_${id}`;assert.ok(dictionary[key]?.length>1,key);
  }
  assert.equal(Object.keys(MODEL_NAMES).length,8);
});
test("shared paint policy preserves glass, holographic and matte properties",()=>{
  const glass=paintOptions("#ffffff","glass");assert.equal(glass.transmission,0.72);assert.equal(glass.opacity,0.86);assert.equal(glass.transparent,true);
  const holo=paintOptions("#ffffff","holo");assert.equal(holo.iridescence,1);assert.equal(holo.sheen,1);
  const matte=paintOptions("#ffffff","matte");assert.equal(matte.roughness,0.92);assert.equal(matte.metalness,0.05);
  assert.equal(paintOptions("#ffffff","solid",0.4,0.3,true).flatShading,true);
  for(const finish of ["solid","gloss","matte","chrome","glass","holo"] as FinishId[])assert.equal(paintOptions("#123456",finish).color,"#123456");
});
test("every circuit gains animated local actors with bounded populations and finite poses",()=>{
  const kinds=new Set<string>();const pose:ActorPose={x:0,y:0,z:0,heading:0,bank:0,wing:0};
  for(const track of TRACKS){
    setActiveTrack(track.id);const themes=(track.sectors??[{t0:0,theme:track.theme}]).map(s=>THEMES[s.theme]);
    const spots=lifeSpots(themes),actors=trackActors(spots,!!track.indoor);
    assert.ok(actors.length>0&&actors.length<=(track.indoor?12:24),track.id);
    assert.deepEqual(actors,trackActors(spots,!!track.indoor));
    for(const a of actors){kinds.add(a.kind);for(const t of [0,0.2,10,10000]){assert.equal(actorPose(a,t,pose),pose);assert.ok(Object.values(pose).every(Number.isFinite));assert.ok(Math.hypot(pose.x-a.anchor.x,pose.z-a.anchor.z)<=a.radius+1e-6);}}
  }
  assert.deepEqual([...kinds].sort(),["butterfly","drone","fish"]);
});
