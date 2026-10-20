import {test} from "node:test";
import assert from "node:assert/strict";
import {AbilityReserve,signatureShot,signatureCooldown,signatureTarget,signatureNeedsTarget,type AbilityTarget} from "../src/abilities";
import {RearView,CameraFollow} from "../src/camera";
import {PadReader} from "../src/gamepad";
import {raceRules} from "../src/raceRules";
import {TRACKS,MODES,CHARACTERS,THEMES,themeOnLap,type VehicleMode} from "../src/data";
import {setActiveTrack,getPaths} from "../src/trackCurve";
import {inspectMap} from "../src/mapInspection";
import {lifeSpots} from "../src/trackLife";
import {trackActors,actorPose} from "../src/trackActors";
import {lifeReaction,easeReaction} from "../src/worldLife";
import {ACTIONS,DEFAULT_KEYBINDS,PRESET_KEYBINDS} from "../src/store";
import {MODEL_NAMES} from "../src/i18n9";
const modes:VehicleMode[]=["land","boat","plane","sub","hover"];
for(const fps of [30,60,144])test(`ability reserve uses real forward driving consistently at ${fps} Hz`,()=>{
  const a=new AbilityReserve();a.step(1/fps,0,30,true);
  for(let i=1;i<=fps*20;i++)a.step(1/fps,i*30/fps,30,true);
  assert.ok(Math.abs(a.charge-0.75)<1e-6,String(a.charge));
  const before=a.charge;a.step(0,650,30,true);a.step(NaN,650,30,true);assert.equal(a.charge,before);
});
test("signature gains cannot be farmed by reversing, teleports, stopping or disabling attacks",()=>{
  const a=new AbilityReserve();a.step(.1,0,30,true);a.step(.1,3000,30,true);assert.equal(a.charge,0.35);
  for(let i=0;i<500;i++){a.step(.1,3000-i,30,true);a.step(.1,3000,30,true);}assert.equal(a.charge,0.35);
  a.step(.1,3003,30,false);a.step(.1,3006,0,true);assert.equal(a.charge,0.35);
});
test("skill variety rewards more energy, shared cooldown rejects repeat activation and pause",()=>{
  const a=new AbilityReserve();a.reward("drift");const once=a.charge;a.reward("drift");assert.ok(a.charge-once<0.1);a.reward("landing");assert.ok(a.charge-once>0.18);
  while(!a.ready)a.reward("pass");assert.equal(a.use(13,false),false);assert.equal(a.use(13,true),true);assert.equal(a.charge,0);assert.equal(a.use(13,true),false);
  for(let i=0;i<20;i++)a.reward("pass");assert.equal(a.ready,false);a.step(0,0,0,true);assert.equal(a.cooldown,13);
  for(let i=0;i<131;i++)a.step(.1,0,0,false);assert.equal(a.ready,true);assert.equal(a.use(10,true),true);
});
test("every character keeps its signature effect across all five crafts with capped volley size",()=>{
  for(const c of CHARACTERS)for(const mode of modes){const s=signatureShot(c,mode);assert.ok(s.name&&s.color);assert.ok(s.count>=1&&s.count<=5);assert.ok(s.power>0&&s.power<=1.6);assert.ok(signatureCooldown(c)>=10);}
});
const target=(id:string,x:number,z:number,y=0,team=-1):AbilityTarget=>({id,x,y,z,team,unavailable:false});
test("signature aim switches to pursuers, rejects teammates, overhead roads and spent bodies",()=>{
  const s=signatureShot(CHARACTERS[0],"hover"),me=target("me",0,0),ahead=target("ahead",0,30),back=target("back",0,-20),cross=target("cross",20,0),overhead=target("overhead",0,5,9);
  assert.equal(signatureTarget(me,0,false,s,[ahead,back,cross,overhead])?.id,"ahead");assert.equal(signatureTarget(me,0,true,s,[ahead,back,cross,overhead])?.id,"back");
  assert.equal(signatureTarget({...me,team:1},0,false,s,[{...ahead,team:1}]),null);assert.equal(signatureTarget(me,0,false,s,[{...ahead,unavailable:true}]),null);
  assert.equal(signatureTarget(me,Math.PI/2,false,s,[target("east",30,0)])?.id,"east");assert.equal(signatureNeedsTarget(s),true);
});
test("rear glance cuts once on each edge and leaves chase heading unchanged",()=>{
  const glance=new RearView(),follow=new CameraFollow();follow.update(0,0,0,0,1/60);const angle=follow.angle;
  assert.equal(glance.update(true,true),true);assert.equal(glance.offset,Math.PI);assert.equal(glance.update(true,true),false);assert.equal(follow.angle,angle);
  assert.equal(glance.update(false,true),true);assert.equal(glance.offset,0);assert.equal(glance.update(true,false),false);assert.equal(glance.active,false);
});
test("both keyboard presets offer independent remappable rear view and ability",()=>{
  assert.ok(ACTIONS.includes("lookBack")&&ACTIONS.includes("ability"));for(const p of [DEFAULT_KEYBINDS,...Object.values(PRESET_KEYBINDS)]){assert.deepEqual(p.lookBack,["KeyV"]);assert.deepEqual(p.ability,["KeyC"]);}
});
test("standard controller Y / right-stick click are independent and blocked until neutral",()=>{
  const buttons=Array.from({length:17},()=>({pressed:false,touched:false,value:0}));const p={connected:true,index:0,mapping:"standard",axes:[0,0,0,0],buttons} as unknown as Gamepad;
  const reader=new PadReader();buttons[3]={pressed:true,touched:true,value:1};assert.equal(reader.read([p]).ability,false);buttons[3]={pressed:false,touched:false,value:0};reader.read([p]);buttons[3]={pressed:true,touched:true,value:1};buttons[11]={pressed:true,touched:true,value:1};const result=reader.read([p]);assert.equal(result.ability,true);assert.equal(result.lookBack,true);assert.equal(result.item,false);reader.suspend();assert.equal(reader.read([p]).lookBack,false);
});
test("all 41 maps and seven modes have explicit local/network policies and finite ribbons",()=>{
  assert.equal(TRACKS.length,41);let combinations=0;
  for(const t of TRACKS){setActiveTrack(t.id);const inspected=inspectMap();assert.ok(inspected.length>=2,t.id);for(const path of inspected){assert.deepEqual(path.issues,[],t.id);assert.ok(path.minWidth>0);}
    for(const m of Object.values(MODES))for(const network of [false,true]){const rules=raceRules(t,m,network);assert.equal(rules.abilities,m.id!=="trial");assert.equal(rules.physicalEvolution,!network&&m.id!=="battle");assert.equal(rules.victory,m.id==="battle"?"lives":"laps");assert.ok(rules.vehicleModes.includes("land"));combinations++;}
  }assert.equal(combinations,574);
});
test("every map has deterministic life and creatures anchored outside ribbons",()=>{
  for(const t of TRACKS){setActiveTrack(t.id);const themes=(t.sectors??[{t0:0,theme:t.theme}]).map(s=>themeOnLap(s.theme,0));const spots=lifeSpots(themes),actors=trackActors(spots,!!t.indoor);
    assert.ok(spots.length>0,`${t.id}: no life`);assert.ok(actors.length>0,t.id);assert.ok(spots.length<=(t.indoor?32:64));assert.ok(actors.length<=(t.indoor?12:24));assert.deepEqual(spots,lifeSpots(themes));
    const paths=getPaths();assert.ok(paths.length);for(const a of actors){const out={x:0,y:0,z:0,heading:0,bank:0,wing:0};for(let i=0;i<24;i++){actorPose(a,i/2,out,1);assert.ok(Math.hypot(out.x-a.anchor.x,out.z-a.anchor.z)<=a.radius+1e-6);assert.ok(Object.values(out).every(Number.isFinite));if(a.kind==="fish")assert.ok(out.y<a.anchor.y);}}
  }
});
test("nearby fast visitors stir scenery, parallel roads and pause do not",()=>{
  setActiveTrack(TRACKS[0].id);const spot=lifeSpots([THEMES.frutiger])[0];const visitor={x:spot.x,y:spot.y,z:spot.z,speed:35};
  assert.equal(lifeReaction(spot,visitor),1);assert.equal(lifeReaction(spot,{...visitor,speed:0}),0);assert.equal(lifeReaction(spot,{...visitor,y:visitor.y+20}),0);assert.equal(lifeReaction(spot,{...visitor,x:visitor.x+200}),0);assert.equal(lifeReaction(spot,{...visitor,speed:NaN}),0);
  assert.equal(easeReaction(0.5,1,0),0.5);assert.ok(easeReaction(0,1,.1)>1-easeReaction(1,0,.1));
  assert.ok(Math.abs(easeReaction(0,1,.1)-easeReaction(easeReaction(0,1,.05),1,.05))<1e-8);
});
test("new gameplay labels exist in all eight languages",()=>{
  for(const dictionary of Object.values(MODEL_NAMES))for(const key of ["lookBack","signatureAbility","abilityBlocked","abilityAim","abilityHelp","padAbilityControls"])assert.ok(dictionary[key],key);
});
