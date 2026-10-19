import test from "node:test";
import assert from "node:assert/strict";
import { SkillChain, CleanPasses, DraftCharge, isFinalLap, raceSoundProfile, type SkillKind } from "../src/adrenaline";
import { setRaceSound, bindMuteGetter, bindVolumeGetter } from "../src/sound";

test("mixed driving chains cap turbo, multiplier and score while respecting forward travel",()=>{
  const chain=new SkillChain();const kinds:SkillKind[]=["drift","landing","near","sling","pass"];
  for(let i=0;i<30;i++) {
    const gain=chain.add(kinds[i%kinds.length],i*30,i*1000);
    assert.ok(gain>0&&gain<=0.04);assert.ok(chain.multiplier<=2);assert.ok(chain.count<=8);
    chain.step(1);
  }
  assert.equal(chain.count,8);assert.equal(chain.multiplier,2);assert.ok(chain.score>0);
});
test("waiting, reversing, repeated triggers and crash resets cannot farm skill rewards",()=>{
  const chain=new SkillChain();chain.add("drift",100,1000);const score=chain.score;
  for(const [distance,ms] of [[100,2000],[95,3000],[120,1200],[NaN,4000],[130,NaN]]) assert.equal(chain.add("drift",distance,ms),0);
  assert.equal(chain.score,score);chain.reset();assert.equal(chain.count,0);
  assert.equal(chain.add("near",100,5000),0);assert.ok(chain.add("landing",130,5000)>0);
});
test("skill chain expiry uses race time consistently at 20/30/60/144 Hz and survives a paused clock",()=>{
  for(const hz of [20,30,60,144]) {
    const chain=new SkillChain();chain.add("drift",0,0);chain.add("near",30,1000);
    for(let i=0;i<100;i++)chain.step(0);assert.equal(chain.count,2);
    for(let i=0;i<hz*6;i++)chain.step(1/hz);
    assert.equal(chain.count,0);assert.equal(chain.left,0);assert.equal(chain.kind,null);assert.equal(chain.multiplier,1);
    assert.ok(chain.score>0);
  }
});
test("a clean pass requires approaching and crossing the same nearby rival once per lap",()=>{
  const passes=new CleanPasses();
  assert.equal(passes.observe("bot",1,-3,true,true),false);
  assert.equal(passes.observe("bot",1,6,true,true),false);
  assert.equal(passes.observe("bot",1,1,true,true),false);
  assert.equal(passes.observe("bot",1,-3,true,true),true);
  passes.observe("bot",1,5,true,true);assert.equal(passes.observe("bot",1,-3,true,true),false);
  passes.observe("bot",2,5,true,true);assert.equal(passes.observe("bot",2,-3,true,true),true);
  passes.observe("bot",1,5,true,true);assert.equal(passes.observe("bot",1,-3,true,true),false);
});
test("contact, teleports, opposing paths and losing proximity invalidate a pass",()=>{
  for(const reason of ["contact","far","teleport","reset"]) {
    const passes=new CleanPasses();passes.observe("bot",1,8,true,true);
    if(reason==="reset")passes.resetArmed();
    if(reason==="contact")passes.observe("bot",1,4,true,false);
    if(reason==="far")passes.observe("bot",1,4,false,true);
    assert.equal(passes.observe("bot",1,reason==="teleport"?-15:-3,true,true),false);
  }
});
function charged(hz=60) {const draft=new DraftCharge();for(let i=0;i<Math.ceil(hz*1.3);i++)draft.step(1/hz,{id:"a",wake:true,exit:false},true);return draft;}
test("draft charge releases exactly once on a lateral exit at 20/30/60/144 Hz",()=>{
  for(const hz of [20,30,60,144]) {
    const draft=charged(hz);assert.ok(draft.charge>=0.95);
    assert.equal(draft.step(1/hz,{id:"a",wake:false,exit:true},true),true);
    assert.equal(draft.charge,0);assert.equal(draft.step(1/hz,{id:"a",wake:false,exit:true},true),false);
  }
});
test("draft cannot release from braking, jumping, a lost target or switching opponents",()=>{
  for(const reason of ["invalid","lost","new","straight"]) {
    const draft=charged();
    const observation=reason==="lost"?null:{id:reason==="new"?"b":"a",wake:false,exit:reason!=="straight"};
    assert.equal(draft.step(1/60,observation,reason!=="invalid"),false);
  }
  const draft=charged();const before=draft.charge;assert.equal(draft.step(0,null,false),false);assert.equal(draft.charge,before);
});
test("final-lap presentation excludes battle, single-lap races and completed races",()=>{
  assert.equal(isFinalLap(3,3,false,false),true);
  for(const args of [[1,3,false,false],[1,1,false,false],[3,3,true,false],[3,3,false,true],[4,3,false,false]] as const)assert.equal(isFinalLap(...args),false);
});
test("all five modes have distinct engine voices and final-lap music adds bounded energy",()=>{
  const voices=new Set<number>();
  for(const mode of ["land","boat","plane","sub","hover"] as const) {
    for(const speed of [0,20,65,500,NaN]) {
      const normal=raceSoundProfile({speed,mode,ms:1000,combo:0,final:false,boosting:false});
      const final=raceSoundProfile({speed,mode,ms:1000,combo:8,final:true,boosting:true});
      assert.ok(Object.values(normal).every(Number.isFinite));assert.ok(normal.wind<=0.065);assert.ok(normal.engineGain<0.04);
      assert.ok(final.leadGain>normal.leadGain);assert.ok(final.beat>normal.beat);
      if(speed===20)voices.add(normal.engine);
    }
  }
  assert.equal(voices.size,5);
  assert.ok(Object.values(raceSoundProfile({speed:0,mode:"land",ms:NaN,combo:0,final:false,boosting:false})).every(Number.isFinite));
});
test("race audio reuses a fixed voice pool and silences every layer on pause, mute and zero volume",()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,"window");let oscillators=0,buffers=0,muted=false,volume=1;
  const gains:{value:number}[]=[];
  function param(){return {value:0,cancelScheduledValues(){},setTargetAtTime(v:number){assert.ok(Number.isFinite(v));this.value=v;}};}
  class Context {
    state="running";currentTime=1;sampleRate=100;
    createOscillator(){oscillators++;return {type:"sine",frequency:param(),connect(){},start(){}};}
    createGain(){const gain=param();gains.push(gain);return {gain,connect(){}};}
    createBuffer(){buffers++;return {getChannelData(){return new Float32Array(100);}};}
    createBufferSource(){return {buffer:null,loop:false,connect(){},start(){}};}
    createBiquadFilter(){return {type:"lowpass",frequency:param(),Q:param(),connect(){}};}
    destination={};
  }
  try {
    Object.defineProperty(globalThis,"window",{configurable:true,value:{AudioContext:Context}});
    bindMuteGetter(()=>muted);bindVolumeGetter(()=>volume);
    const state={speed:35,mode:"plane" as const,ms:1000,combo:4,final:true,boosting:true,surface:{mode:"boat" as const,speed:35,grounded:true,rough:false,wet:true}};
    for(let i=0;i<300;i++)setRaceSound({...state,ms:i*16});
    assert.equal(oscillators,4);assert.equal(buffers,1);assert.equal(gains.length,6);
    assert.ok(gains.some(g=>g.value>0));setRaceSound(null);assert.ok(gains.every(g=>g.value===0));
    muted=true;setRaceSound(state);assert.ok(gains.every(g=>g.value===0));
    muted=false;volume=0;setRaceSound(state);assert.ok(gains.every(g=>g.value===0));
    volume=0.5;setRaceSound(state);assert.ok(gains.some(g=>g.value>0));
    setRaceSound(null);assert.ok(gains.every(g=>g.value===0));assert.equal(oscillators,4);
  } finally {
    bindMuteGetter(()=>false);bindVolumeGetter(()=>1);
    if(previous)Object.defineProperty(globalThis,"window",previous);else Reflect.deleteProperty(globalThis,"window");
  }
});
