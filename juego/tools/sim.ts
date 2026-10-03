import * as THREE from "three";
import { TRACKS } from "../src/data";
import { setActiveTrack, getPaths, groundAt, makeGround, trackCurve, F_SOLID, F_WALL_POS, F_WALL_NEG } from "../src/trackCurve";
import { moveBody, makeResult, placeBody, respawnBody, aimAhead, type Body } from "../src/physics";

const arg = process.argv[2] ?? "all";
function body(): Body {
  return { pos: new THREE.Vector3(), y: 0, vy: 0, airborne: false, heading: 0, speed: 0, path: 0, idx: 0, prog: 0, total: 0, safePath: 0, safeIdx: 0, touching: false, groundY: 0, slopeAlong: 0 };
}
const wrap = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

if (arg === "info") {
  setActiveTrack("torre");
  const main = getPaths()[0];
  console.log("len", main.length.toFixed(0), "n", main.n, "routes", getPaths().slice(1).map(p => `${p.length.toFixed(0)}u t0 ${p.t0} span ${p.span.toFixed(3)}`));
  const want: [string, number, number, number][] = [["helixIn", 120, 16, 190], ["helixOut", 120, 42, 190], ["b1", 40, 41, 195], ["b2", -50, 39, 180], ["b3", -130, 34, 140], ["merge", -205, 19, -70], ["over", -200, 13, -200], ["turn1", 270, 1, -175], ["helixTop", 120, 29, 70]];
  for (const [name, x, y, z] of want) {
    let best = 0, bd = 1e9;
    for (let i = 0; i < main.n; i++) { const d = Math.hypot(main.px[i] - x, main.py[i] - y, main.pz[i] - z); if (d < bd) { bd = d; best = i; } }
    console.log(name, "t", (best / main.n).toFixed(4), "y", main.py[best].toFixed(1));
  }
  let maxS = 0; for (let i = 0; i < main.n; i++) maxS = Math.max(maxS, Math.abs(main.slope[i]));
  let at=0; for (let i = 0; i < main.n; i++) if (Math.abs(main.slope[i])>=maxS-1e-6) at=i; console.log("max slope", maxS.toFixed(3), "at t", (at/main.n).toFixed(4), "solid", main.flags[at]&1, "y", main.py[at-1], main.py[at], main.py[at+1]);
  // walls opened at junctions
  for (const p of getPaths()) { let open = 0, solid = 0; for (let i = 0; i < p.n; i++) { if (p.flags[i] & F_SOLID) solid++; if (!(p.flags[i] & F_WALL_POS) || !(p.flags[i] & F_WALL_NEG)) open++; } console.log("path", p.id, "samples", p.n, "solid", solid, "with an open edge", open); }
  const g = makeGround();
  console.log("under bridge  y=1:", groundAt(-200, -200, 1, g), g.path, g.y.toFixed(2), g.prog.toFixed(3));
  console.log("on bridge    y=13:", groundAt(-200, -200, 13.5, g), g.path, g.y.toFixed(2), g.prog.toFixed(3));
  console.log("helix low   y=16:", groundAt(120, 190, 16.5, g), g.y.toFixed(2), g.prog.toFixed(3));
  console.log("helix high  y=42:", groundAt(120, 190, 42.5, g), g.y.toFixed(2), g.prog.toFixed(3));
  process.exit(0);
}

const ids = arg === "all" ? TRACKS.map(t => t.id) : [arg];
for (const id of ids) {
  for (const takeRoutes of [false, true]) {
    setActiveTrack(id);
    const paths = getPaths();
    const b = body(); placeBody(b, 0, 3); b.total = b.prog;
    const res = makeResult(); const aim = new THREE.Vector3();
    const dt = 1 / 60; let time = 0, falls = 0, hits = 0, firstHits = 0, maxImpact = 0, air = 0, lapStart = 0, minSpeed = 99, backwards = 0, jitter = 0, lastLat = 0;
    const laps: number[] = []; let route = 0, seen = -1; const used = new Set<number>(); let lastTotal = b.total; let stuck = 0; const fallAt: string[] = [];
    while (laps.length < 2 && time < 400) {
      time += dt;
      if (takeRoutes && route === 0) for (let k = 1; k < paths.length; k++) { const rel = (((b.prog - paths[k].t0) % 1) + 1.5) % 1 - 0.5; if (rel > -0.02 && rel < 0 && seen !== k) { seen = k; route = k; } }
      if (b.path > 0) used.add(b.path);
      route = aimAhead(b, route, 16 + b.speed * 0.55, 0, aim);
      const desired = Math.atan2(aim.x - b.pos.x, aim.z - b.pos.z);
      const diff = wrap(desired - b.heading);
      const steer = Math.max(-1, Math.min(1, diff * 2.5));
      const maxS = 27; b.speed += (14 - 14 * b.slopeAlong) * dt; b.speed = Math.min(b.speed, maxS * (Math.abs(diff) > 0.55 ? 0.7 : 1));
      const sf = Math.min(1, b.speed / maxS);
      if (!b.airborne) b.heading += steer * 2.6 * (0.4 + sf * 0.6) * (1 - sf * 0.18) * dt;
      moveBody(b, Math.sin(b.heading) * b.speed * dt, Math.cos(b.heading) * b.speed * dt, dt, { rideOffset: 0, bobbing: false, fly: false, flyAlt: 0, ghost: false }, res);
      if (res.fell) { if (process.env.DBG) console.log("FELL t", time.toFixed(1), "pos", b.pos.x.toFixed(0), b.y.toFixed(1), b.pos.z.toFixed(0), "prog", b.prog.toFixed(3), "path", b.path, "groundY", b.groundY.toFixed(1), "air", b.airborne, "vy", b.vy.toFixed(1)); falls++; fallAt.push(`${b.prog.toFixed(3)}@${time.toFixed(0)}s`); respawnBody(b); b.speed = 15; route = 0; }
      if (res.wallImpact > 0) { hits++; maxImpact = Math.max(maxImpact, res.wallImpact); }
      if (res.wallFirst) firstHits++;
      if (b.airborne) air++;
      if (process.env.TRACE && Math.round(time*60) % 30 === 0) console.log(time.toFixed(1), "pos", b.pos.x.toFixed(0), b.y.toFixed(1), b.pos.z.toFixed(0), "prog", b.prog.toFixed(3), "path", b.path, "route", route, "spd", b.speed.toFixed(1), "air", b.airborne, "touch", b.touching, "aim", aim.x.toFixed(0), aim.z.toFixed(0));
      if (time > 6) minSpeed = Math.min(minSpeed, b.speed);
      if (b.total < lastTotal - 1e-6) backwards++; lastTotal = b.total;
      if (b.speed < 2 && time > 5) stuck++;
      if (Math.floor(b.total) > laps.length) { laps.push(time - lapStart); lapStart = time; seen = -1; }
    }
    console.log(`${id.padEnd(9)} ${takeRoutes ? "routes" : "main  "} laps ${laps.map(l => l.toFixed(1)).join("/") || "DNF@" + b.total.toFixed(2)} falls ${falls}${fallAt.length ? " [" + fallAt.slice(0, 4).join(" ") + "]" : ""} wallFrames ${hits} firstHits ${firstHits} maxImpact ${maxImpact.toFixed(2)} airFrames ${air} minSpeed ${minSpeed.toFixed(1)} stuckFrames ${stuck} routesUsed ${[...used].join(",")}`);
  }
}
