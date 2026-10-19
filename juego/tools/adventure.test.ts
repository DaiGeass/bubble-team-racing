import test from "node:test";
import assert from "node:assert/strict";
import {TRACKS,type TrapDef} from "../src/data";
import {getPaths,setActiveTrack,getPads,F_SOLID,trapContact,trapTransform,trapScale} from "../src/trackCurve";
import {EXTRA_ROUTES} from "../src/trackExpansion";
import {auditNewRoutes} from "./routeAudit";
import {CameraFollow,chaseLens} from "../src/camera";
import {environmentEvents,eventPose,eventContact,NearMissLedger,ambientHazardCount,type EventPose} from "../src/environment";
import {waterRibbon} from "../src/game/waterRibbon";
import {activeFrameTime} from "../src/motion";

test("all 41 circuits have one new connected road with two usable impulse pads",()=>{
  assert.equal(Object.keys(EXTRA_ROUTES).length,41);
  for(const track of TRACKS){
    setActiveTrack(track.id);const route=EXTRA_ROUTES[track.id],paths=getPaths(),p=paths.find(p=>p.def===route);
    assert.ok(p,track.id);assert.ok(p.length>80&&p.length<650,track.id);
    assert.ok(route.t1>route.t0&&route.t0>0&&route.t1<1);
    assert.ok(Array.from(p.flags).every(f=>!!(f&F_SOLID)),track.id);
    assert.ok([...p.px,...p.py,...p.pz].every(Number.isFinite));
    const index=(track.routes??[]).indexOf(route);assert.equal((track.pads??[]).filter(pad=>pad.route===index&&pad.kind==="boost").length,2);
    assert.ok(getPads().length>=2);
  }
});
test("every new road can actually be entered, driven and exited at the higher speed",()=>{
  for(const row of auditNewRoutes(60)){
    assert.equal(row.used,true,`${row.id}: entrance`);assert.equal(row.finished,true,`${row.id}: exit`);assert.equal(row.falls,0,`${row.id}: fall`);assert.equal(row.cleared,true,`${row.id}: whole challenge corridor`);
  }
});
test("new roads remain traversable at 30 Hz, including alternate flight/diving corridors",()=>{
  const modes=new Set<string>();
  for(const row of auditNewRoutes(30)){
    assert.equal(row.used,true,`${row.id}: entrance at 30 Hz`);assert.equal(row.finished,true,row.id);assert.equal(row.falls,0,row.id);assert.equal(row.cleared,true,`${row.id}: challenge at 30 Hz`);
    row.modes.forEach(m=>modes.add(m));
  }
  assert.ok(modes.has("sub")&&modes.has("plane")&&modes.has("hover")&&modes.has("boat"));
});
test("carrying the camera with the kart removes speed-dependent trailing at all refresh rates",()=>{
  for(const fps of [30,60,144]){
    const follow=new CameraFollow();let eye=-6.9;follow.update(0,0,0,0,1/fps);
    for(let i=1;i<=fps*3;i++){
      const z=i*36/fps;follow.update(0,0,z,0,1/fps);eye+=follow.dz;eye+=(z-6.9-eye)*(1-Math.exp(-9/fps));
    }
    assert.ok(Math.abs(108-eye-6.9)<1e-8);
  }
});
test("a portal resets camera translation instead of carrying the old trajectory into the cut",()=>{
  const follow=new CameraFollow();follow.update(0,0,0,0,1/60);follow.update(0,2,1,0,1/60);
  assert.equal(follow.dz,1);assert.equal(follow.dy,2);
  assert.equal(follow.update(400,30,400,0,1/60),true);assert.equal(follow.dx,0);assert.equal(follow.dy,0);assert.equal(follow.dz,0);
});
test("the dynamic lens keeps the kart readable, limits indoor opening and preserves Stable",()=>{
  assert.equal(chaseLens(100,1,1,0,false),64);
  for(const speed of [0,20,35,60,100]){
    const lens=chaseLens(speed,1,1,1,false);assert.ok(lens>=64&&lens<=78.5);
    assert.ok(chaseLens(speed,1,1,1,true)<=72.5);
  }
});
test("each circuit has environmental obstacles with an always-open half of the road",()=>{
  const kinds=new Set<string>();
  for(const track of TRACKS){
    setActiveTrack(track.id);const events=environmentEvents();assert.ok(events.length>0&&events.length<=4,track.id);
    assert.equal(environmentEvents(),events);
    for(const event of events){
      kinds.add(event.kind);const p=getPaths()[event.path];assert.ok(p.flags[event.idx]&F_SOLID);assert.ok(event.half>=5);
      for(let ms=0;ms<9000;ms+=50){const pose=eventPose(event,ms,makePose());assert.ok(Math.hypot(pose.x-event.x,pose.z-event.z)+pose.radius<event.half+0.1);}
    }
  }
  assert.ok(kinds.has("piston")&&kinds.has("current")&&kinds.has("sprout"));
});
test("traps have no warning phase and erupt directly with matching collision",()=>{
  setActiveTrack(TRACKS[0].id);const event={...environmentEvents()[0],phase:0,period:8};
  for(const ms of [0,4000,4400,5000,5799,7100,7500,8000]){
    const pose=eventPose(event,ms,makePose());
    assert.equal(pose.active,false);assert.equal(pose.lift,0);assert.equal("warning" in pose,false);
    assert.equal(eventContact(event,pose,event.path,pose.x,pose.y,pose.z,pose.x,pose.y,pose.z),null);
  }
  for(const ms of [5850,6200,6800]){
    const pose=eventPose(event,ms,makePose());assert.equal(pose.active,true);assert.ok(pose.lift>0.99);
    assert.equal(eventContact(event,pose,event.path,pose.x,pose.y,pose.z,pose.x,pose.y,pose.z),"hit");
  }
});
test("fast movement cannot tunnel through an active hazard and crossing roads remain separate",()=>{
  setActiveTrack(TRACKS[0].id);const event={...environmentEvents()[0],phase:0,period:8};const pose=eventPose(event,6200,makePose());
  assert.equal(eventContact(event,pose,event.path,pose.x-8,pose.y,pose.z,pose.x+8,pose.y,pose.z),"hit");
  assert.equal(eventContact(event,pose,event.path+99,pose.x-8,pose.y,pose.z,pose.x+8,pose.y,pose.z),null);
  assert.equal(eventContact(event,pose,event.path,pose.x,pose.y+10,pose.z,pose.x,pose.y+10,pose.z),null);
  assert.equal(eventContact(event,{...pose,active:false},event.path,pose.x,pose.y,pose.z,pose.x,pose.y,pose.z),null);
});
test("close-call turbo cannot be farmed by reversing or circling the same obstacle",()=>{
  const ledger=new NearMissLedger();assert.equal(ledger.claim(1,1,-20,1),false);assert.equal(ledger.claim(1,1,20,-1),false);
  assert.equal(ledger.claim(1,1,20,1),true);assert.equal(ledger.claim(1,1,20,1),false);
  assert.equal(ledger.claim(1,2,20,1),true);assert.equal(ledger.claim(1,1,20,1),false);assert.equal(ledger.claim(2,2,20,1),true);
});
test("an unchanged race clock holds hazard poses exactly still while paused",()=>{
  setActiveTrack(TRACKS[0].id);const event=environmentEvents()[0];const pose=eventPose(event,6123,makePose());
  for(let i=0;i<300;i++)assert.deepEqual(eventPose(event,6123,makePose()),pose);
});
test("pool water is present on actual alternate water ribbons with finite normals and UVs",()=>{
  let count=0;
  for(const track of TRACKS){setActiveTrack(track.id);for(const path of getPaths()){
    const geo=waterRibbon(path,-0.2,0.09);if(!geo)continue;count++;
    for(const name of ["position","normal","uv"])assert.ok(Array.from(geo.getAttribute(name).array).every(Number.isFinite));
    assert.ok(geo.index!.count>0);geo.dispose();
  }}
  assert.ok(count>0);
});
test("legacy traps respect disabling and use their visible footprint rather than lap distance",()=>{
  setActiveTrack(TRACKS[0].id);const tr:TrapDef={t:0.15,phase:0,speed:0,side:0,kind:"bar",active:true};const pose=trapTransform(tr,0);
  assert.equal(trapContact(tr,0,pose.p.x,pose.ground,pose.p.z),true);
  assert.equal(trapContact({...tr,active:false},0,pose.p.x,pose.ground,pose.p.z),false);
  assert.equal(trapContact(tr,0,pose.p.x+Math.sin(pose.heading)*8,pose.ground,pose.p.z+Math.cos(pose.heading)*8),false);
  assert.ok(trapScale("bar",10)<=1.5);
});
function makePose():EventPose{return {x:0,y:0,z:0,heading:0,active:false,lift:0,radius:1};}
test("maps with zero classic hazards stay clear and later laps stay within the allocated budget",()=>{
  for(const lap of [1,2,3,9])assert.equal(ambientHazardCount(0,lap),0);
  assert.equal(ambientHazardCount(3,1),3);assert.equal(ambientHazardCount(3,3),7);assert.equal(ambientHazardCount(3,50),9);
});
test("pickup respawns do not slow at 20 FPS or continue ticking through an offline pause",()=>{
  for(const fps of [20,30,60,144]){
    let remaining=5;
    for(let i=0;i<fps;i++)remaining-=activeFrameTime(1/fps,false);
    assert.ok(Math.abs(remaining-4)<1e-9);
    for(let i=0;i<fps*3;i++)remaining-=activeFrameTime(1/fps,true);
    assert.ok(Math.abs(remaining-4)<1e-9);
  }
  assert.equal(activeFrameTime(20,false),0.1);assert.equal(activeFrameTime(NaN,false),0);
});
