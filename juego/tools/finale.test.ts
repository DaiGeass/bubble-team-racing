import {test} from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {Maneuver} from "../src/maneuvers";
import {PadReader,deadzone} from "../src/gamepad";
import {RIVAL_STYLES,rivalStyle,rivalTurboThreshold} from "../src/rivalStyle";
import {passPan,surfaceSoundProfile,landingSound} from "../src/foley";
import {TRACKS,CHARACTERS,type VehicleMode} from "../src/data";
import {setActiveTrack,getPaths,groundAt,makeGround} from "../src/trackCurve";
import {surfaceSites,resetSurfaces,evolveSurfaces,setSurfaceClock,hasSurface,replacedDeck,bridgeLane,surfaceWater,bridgeDrop} from "../src/surfaceEvents";
import {placeBody,moveBody,makeResult,type Body} from "../src/physics";
const input=(mode:VehicleMode,held=true)=>({mode,held,steer:0.5,speed:36,airborne:false,clean:true,distance:0});
for(const fps of [30,60,144])for(const mode of ["plane","sub","hover"] as const)test(`${mode} maneuver completes once at ${fps} fps`,()=>{
  const move=new Maneuver();let rewards=0,starts=0,maxRoll=0;
  for(let i=0;i<fps*5;i++){const result=move.step(1/fps,{...input(mode),distance:i/fps*36});rewards+=Number(result.reward);starts+=Number(!!result.start);maxRoll=Math.max(maxRoll,Math.abs(move.roll));}
  assert.equal(rewards,1);assert.equal(starts,1);assert.equal(move.roll,0);if(mode==="plane")assert.ok(maxRoll>5);
});
test("air trick only pays after a clean landing",()=>{
  const m=new Maneuver();let reward=false;for(let i=0;i<40;i++)reward ||=m.step(1/60,{...input("land"),airborne:true,distance:i*0.6}).reward;
  assert.equal(reward,false);assert.equal(m.step(1/60,{...input("land",false),airborne:false,distance:25}).reward,true);
});
test("early touchdown cancels trick and no stationary farming",()=>{
  const m=new Maneuver();m.step(1/60,{...input("land"),airborne:true});assert.equal(m.step(1/60,{...input("land"),airborne:false}).reward,false);
  for(let i=0;i<300;i++)assert.equal(m.step(1/60,{...input("plane",i%80===0),distance:0}).reward,false);
});
test("boat hop keeps steering drift available and has one physical lift",()=>{
  const m=new Maneuver();assert.equal(m.step(1/60,input("boat")).start,null);m.step(1/60,input("boat",false));
  assert.equal(m.step(1/60,{...input("boat"),steer:0}).lift,6.5);assert.equal(m.step(1/60,{...input("boat"),steer:0,airborne:true}).lift,0);
});
test("hits, mode reset and pause cannot complete moves",()=>{
  const m=new Maneuver();m.step(1/60,input("plane"));const age=m.age;m.step(0,input("plane"));assert.equal(m.age,age);
  m.step(1/60,{...input("plane"),clean:false});assert.equal(m.kind,null);assert.equal(m.roll,0);m.reset();assert.equal(m.step(1/60,input("plane")).start,null);
});
const pad=()=>({index:0,connected:true,mapping:"standard",axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0}))}) as unknown as Gamepad;
function button(p:Gamepad,i:number,value:number){(p.buttons as GamepadButton[])[i]={value,pressed:value>0.5,touched:value>0};}
test("controller deadzone rescales axes without losing full steering",()=>{assert.equal(deadzone(0.1),0);assert.equal(deadzone(-1),-1);assert.equal(deadzone(1),1);assert.equal(deadzone(NaN),0);assert.ok(deadzone(0.5)>0.3);});
test("held button on connect/focus requires release, Start is edge-triggered",()=>{
  const r=new PadReader(),p=pad();button(p,0,1);assert.equal(r.read([p]).item,false);button(p,0,0);r.read([p]);button(p,0,1);assert.equal(r.read([p]).item,true);
  button(p,9,1);assert.equal(r.read([p]).pause,true);assert.equal(r.read([p]).pause,false);r.suspend();assert.equal(r.read([p]).item,false);
});
test("disconnect and nonstandard pads cannot leave throttle or item stuck",()=>{
  const r=new PadReader(),p=pad();r.read([p]);button(p,7,0.75);assert.equal(r.read([p]).throttle,0.75);assert.equal(r.read([]).throttle,0);assert.equal(r.read([{...p,mapping:""} as Gamepad]).item,false);
});
test("all existing roles get strategy without stat mutation",()=>{
  const roles=new Set(CHARACTERS.map(c=>rivalStyle(c)));assert.equal(roles.size,4);
  assert.ok(RIVAL_STYLES.explorer.routes>RIVAL_STYLES.attacker.routes);
  assert.ok(rivalTurboThreshold(0.6,"finisher",0.2,false,false)>rivalTurboThreshold(0.6,"finisher",0.9,true,false));
  assert.ok(rivalTurboThreshold(0.6,"finisher",0.2,false,true)<0.6);
});
test("surface and landing sound profiles are finite, bounded and distinguish water/air",()=>{
  for(const mode of ["land","boat","plane","sub","hover"] as const)for(const speed of [0,25,1000,NaN]){const p=surfaceSoundProfile({mode,speed,grounded:true,rough:false,wet:false});assert.ok(Number.isFinite(p.gain)&&p.gain<=0.055);}
  assert.equal(surfaceSoundProfile({mode:"land",speed:40,grounded:false,rough:false,wet:false}).gain,0);
  assert.notEqual(landingSound(12,true).freq,landingSound(12,false).freq);assert.equal(landingSound(NaN,false).volume,0);
});
test("every generated surface event sits on solid isolated road and leaves a wide lane",()=>{
  let bridges=0,floods=0;
  for(const t of TRACKS){setActiveTrack(t.id);const paths=getPaths();for(const s of surfaceSites){
    const p=paths[s.path];assert.ok(s.first>0&&s.last<p.n-1);assert.ok(s.half>=5.5||s.kind==="flood");
    for(let i=s.first;i<=s.last;i++)assert.ok(p.flags[i]&1);
    if(s.kind==="bridge"){bridges++;assert.equal(p.main,false);assert.ok(replacedDeck(p.id,s.first));}else floods++;
  }}assert.ok(bridges>=25,`only ${bridges} bridges`);assert.ok(floods>=25,`only ${floods} floods`);
});
test("evolution waits for bodies, progresses once, and resets between races",()=>{
  setActiveTrack(TRACKS[0].id);evolveSurfaces(3,1000,()=>true);assert.ok(surfaceSites.every(s=>s.stage===1));
  evolveSurfaces(2,2000,()=>false);assert.ok(surfaceSites.every(s=>s.stage===2));evolveSurfaces(1,3000,()=>false);assert.ok(surfaceSites.every(s=>s.stage===2));resetSurfaces();assert.ok(surfaceSites.every(s=>s.stage===1));
});
test("collapse removes actual support on the fallen half while the intact lane supports real bodies",()=>{
  let checked=0;
  for(const t of TRACKS){setActiveTrack(t.id);evolveSurfaces(3,0,()=>false);setSurfaceClock(2000);
    for(const s of surfaceSites)if(s.kind==="bridge"){
      const p=getPaths()[s.path],i=Math.floor((s.first+s.last)/2),g=makeGround(),lat=s.side*s.half*0.5;
      assert.equal(hasSurface(p.id,i,0,lat),false);assert.equal(hasSurface(p.id,i,0,-lat),true);
      assert.equal(groundAt(p.px[i]-p.tz[i]*lat,p.pz[i]+p.tx[i]*lat,p.py[i],g,0.5),false,`${t.id}: invisible support`);
      const body:Body={pos:new THREE.Vector3(),y:0,vy:0,airborne:false,heading:0,course:0,speed:18,path:0,idx:0,prog:0,total:0,safePath:0,safeIdx:0,touching:false,groundY:0,slopeAlong:0,lat:0,half:10};
      placeBody(body,p.id,s.first-4,-lat);const result=makeResult();
      for(let j=s.first-4;j<=s.last+4;j++){
        const x=p.px[j]+p.tz[j]*lat,z=p.pz[j]-p.tx[j]*lat;
        moveBody(body,x-body.pos.x,z-body.pos.z,p.ds/18,{rideOffset:0,bobbing:false,fly:false,flyAlt:0,flyMargin:0,ghost:false},result);
        assert.equal(result.fell,false,`${t.id}: passable half falls`);assert.ok(groundAt(x,z,p.py[j],g,0.5)&&Math.abs(g.y-p.py[j])<0.5,`${t.id}: passable half unsupported`);
      }
      assert.ok(bridgeLane(p.id,i,35)!*s.side<0);checked++;
    }
  }assert.ok(checked>=25);
});
test("floodwater rises by stage, tapers at edges, does not delete road",()=>{
  for(const t of TRACKS){setActiveTrack(t.id);for(const s of surfaceSites)if(s.kind==="flood"){
    const i=Math.floor((s.first+s.last)/2);assert.equal(surfaceWater(s.path,i),0);evolveSurfaces(2,0,()=>false);const first=surfaceWater(s.path,i);assert.ok(first>0.1);
    evolveSurfaces(3,1000,()=>false);assert.ok(surfaceWater(s.path,i)>first);assert.equal(surfaceWater(s.path,s.first),0);assert.ok(hasSurface(s.path,i,0,0));
  }}
});

test("close-pass audio follows camera left/right on both straights",()=>{assert.equal(passPan(-2,0,0),1);assert.equal(passPan(2,0,0),-1);assert.equal(passPan(0,2,Math.PI/2),1);assert.equal(passPan(0,-2,Math.PI/2),-1);});

import {gtkLibrary,gtkProxySource,requiredGlibc} from "./linux-package-support.mjs";
test("Linux packaging compares ABI versions numerically and rejects private library paths",()=>{
  assert.equal(requiredGlibc("GLIBC_2.9 GLIBC_2.39 GLIBC_2.35 GLIBC_2.3.4"),"2.39");
  assert.throws(()=>requiredGlibc("no requirements"));
  assert.equal(gtkLibrary("librsvg-2.so.2.63.2"),true);assert.equal(gtkLibrary("libgio-2.0.so.0"),true);
  assert.equal(gtkLibrary("vmware/lib/librsvg-2.so.2"),false);assert.equal(gtkLibrary("libunrelated.so.0"),false);
});

test("an interrupted air trick cannot pay its pending reward after fusion or cannon travel",()=>{
  const m=new Maneuver();for(let i=0;i<40;i++)m.step(1/60,{...input("land"),airborne:true,distance:i*0.6});
  m.reset();assert.equal(m.step(1/60,{...input("land",false),distance:35}).reward,false);assert.equal(m.roll,0);
});

import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
test("generated GTK proxy executes paths with spaces and forwards non-GTK commands",async()=>{
  const directory=await mkdtemp(join(tmpdir(),"btr-gtk-proxy-test-"));
  try {
    const file=join(directory,"proxy.cjs"),libraryPath=join(directory,"GTK bibliotecas á");
    await writeFile(file,gtkProxySource(libraryPath,process.execPath));
    const direct=spawnSync(process.execPath,[file,"--variable=libdir","librsvg-2.0"],{encoding:"utf8"});
    assert.equal(direct.status,0,direct.stderr);assert.equal(direct.stdout.trim(),libraryPath);
    const forwarded=spawnSync(process.execPath,[file,"--version"],{encoding:"utf8"});
    assert.equal(forwarded.status,0,forwarded.stderr);assert.equal(forwarded.stdout.trim(),process.version);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test("evading follows the steering direction in vehicle coordinates",()=>{
  for(const mode of ["plane","hover"] as const)for(const steer of [-0.7,0.7]){
    const m=new Maneuver();m.step(1/60,{...input(mode),steer});
    // Positive steering turns the heading toward +X; positive road lateral points toward -X.
    assert.ok(-m.lateral*steer>0);assert.ok(mode!=="plane"||m.roll*steer<0);
  }
});
test("an already collapsed bridge never grows back for the third-lap phase",()=>{
  setActiveTrack("bahia");evolveSurfaces(2,1000,()=>false);const s=surfaceSites.find(s=>s.kind==="bridge")!;
  assert.equal(bridgeDrop(s,3000),22);evolveSurfaces(3,5000,()=>false);
  assert.equal(bridgeDrop(s,5000),22);assert.equal(s.changed,1000);
});

test("the submarine maneuver dives faster than the normal eight-units-per-second control",()=>{
  const m=new Maneuver();const step=m.step(1/60,input("sub"));assert.ok(step.dive< -8/60);assert.ok(step.dive>= -16/60);
});
