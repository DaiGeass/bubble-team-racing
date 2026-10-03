import * as THREE from "three";
import { TRACKS } from "../src/data";
import { getPads, setActiveTrack, getPaths, groundAt, makeGround, trackCurve, F_SOLID, F_WALL_POS, F_WALL_NEG } from "../src/trackCurve";
import { DESIGN_REPORT } from "../src/trackDesign";
import { moveBody, makeResult, placeBody, respawnBody, aimAhead, type Body } from "../src/physics";

const arg = process.argv[2] ?? "all";
function body(): Body {
  return { pos: new THREE.Vector3(), y: 0, vy: 0, airborne: false, heading: 0, speed: 0, path: 0, idx: 0, prog: 0, total: 0, safePath: 0, safeIdx: 0, touching: false, groundY: 0, slopeAlong: 0, lat: 0, half: 10 };
}
const wrap = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

if (arg === "check" || arg === "dump") {
  const fs = await import("node:fs");
  const dump: Record<string, unknown> = {};
  for (const def of TRACKS) {
    setActiveTrack(def.id);
    const paths = getPaths();
    const rep = DESIGN_REPORT[def.id];
    const issues: string[] = [];
    let lo = 1e9, hi = -1e9;
    for (const p of paths) {
      let minR = 1e9, maxS = 0, at = 0;
      for (let i = 0; i < p.n; i++) {
        lo = Math.min(lo, p.py[i]); hi = Math.max(hi, p.py[i]);
        if (!(p.flags[i] & F_SOLID)) continue;
        const j = p.closed ? (i + 6) % p.n : Math.min(p.n - 1, i + 6);
        const turn = Math.abs(Math.atan2(p.tx[i] * p.tz[j] - p.tz[i] * p.tx[j], p.tx[i] * p.tx[j] + p.tz[i] * p.tz[j]));
        if (turn > 1e-3 && (6 * p.ds) / turn < minR) { minR = (6 * p.ds) / turn; at = i; }
        maxS = Math.max(maxS, Math.abs(p.slope[i]));
      }
      const half = p.half[0];
      if (minR < half * 2.2) issues.push(`path ${p.id}: radius ${minR.toFixed(0)} at prog ${p.prog[at].toFixed(3)} (${p.px[at].toFixed(0)},${p.pz[at].toFixed(0)})`);
      if (maxS > 0.7) issues.push(`path ${p.id}: slope ${(maxS * 100).toFixed(0)}%`);
    }
    // two roads on top of each other with too little room between them
    const clash = new Map<string, number>();
    for (const a of paths) for (const b of paths) {
      if (b.id < a.id) continue;
      for (let i = 0; i < a.n; i += 3) {
        if (!(a.flags[i] & F_SOLID)) continue;
        for (let j = 0; j < b.n; j += 3) {
          if (!(b.flags[j] & F_SOLID)) continue;
          if (a === b) { let d = Math.abs(i - j); if (a.closed) d = Math.min(d, a.n - d); if (d * a.ds < 90 || j < i) continue; }
          const dx = a.px[i] - b.px[j], dz = a.pz[i] - b.pz[j];
          if (dx * dx + dz * dz > (a.half[i] + b.half[j] + 1) ** 2) continue;
          const dy = Math.abs(a.py[i] - b.py[j]);
          if (dy > 1.2 && dy < 7) { const key = `paths ${a.id}/${b.id} near (${Math.round(a.px[i] / 40) * 40},${Math.round(a.pz[i] / 40) * 40})`; clash.set(key, Math.min(clash.get(key) ?? 99, dy)); }
          if (a === b && dy <= 1.2) { const key = `path ${a.id} runs into itself near (${Math.round(a.px[i] / 40) * 40},${Math.round(a.pz[i] / 40) * 40})`; clash.set(key, 0); }
        }
      }
    }
    for (const [k, v] of clash) issues.push(`clearance ${v.toFixed(1)}: ${k}`);
    const main = paths[0];
    console.log(`${def.id.padEnd(11)} len ${main.length.toFixed(0)} routes ${paths.slice(1).map((p) => p.length.toFixed(0)).join("/") || "-"} y ${lo.toFixed(0)}..${hi.toFixed(0)} closeErr ${rep ? rep.closeError.toFixed(0) : "?"} routeErr ${rep ? rep.routeErrors.map((e) => e.toFixed(0)).join("/") : ""} zones ${def.zones.map((z) => `${z.type}:${z.t0.toFixed(2)}-${z.t1.toFixed(2)}`).join(" ")} ${issues.length ? "\n   ! " + issues.join("\n   ! ") : "ok"}`);
    dump[def.id] = { sea: def.sea, floor: def.floor, zones: def.zones, pads: (def.pads ?? []).length, paths: paths.map((p) => ({ x: Array.from(p.px).filter((_, i) => i % 2 === 0).map((v) => +v.toFixed(1)), y: Array.from(p.py).filter((_, i) => i % 2 === 0).map((v) => +v.toFixed(1)), z: Array.from(p.pz).filter((_, i) => i % 2 === 0).map((v) => +v.toFixed(1)), prog: Array.from(p.prog).filter((_, i) => i % 2 === 0).map((v) => +v.toFixed(4)), solid: Array.from(p.flags).filter((_, i) => i % 2 === 0).map((f) => f & 1), half: p.half[0] })) };
  }
  if (arg === "dump") fs.writeFileSync("/tmp/btr-tracks.json", JSON.stringify(dump));
  process.exit(0);
}

const ids = arg === "all" ? TRACKS.map(t => t.id) : arg.split(",");
for (const id of ids) {
  for (const takeRoutes of [false, true]) {
    setActiveTrack(id);
    const paths = getPaths(); const pads = getPads(); let cannons = 0;
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
      moveBody(b, Math.sin(b.heading) * b.speed * dt, Math.cos(b.heading) * b.speed * dt, dt, { rideOffset: 0, bobbing: false, fly: false, flyAlt: 0, flyMargin: 4, ghost: false }, res);
      for (const pad of pads) { if (pad.kind !== 'cannon' || b.airborne) continue; const px = pad.pos.x - b.pos.x, pz = pad.pos.z - b.pos.z; if (Math.abs(pad.pos.y - b.y) < 2 && Math.abs(px * Math.sin(pad.heading) + pz * Math.cos(pad.heading)) < 3.5 && px * px + pz * pz < 200) { placeBody(b, 0, pad.toIdx); cannons++; } }
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
    console.log(`${id.padEnd(9)} ${takeRoutes ? "routes" : "main  "} laps ${laps.map(l => l.toFixed(1)).join("/") || "DNF@" + b.total.toFixed(2)} falls ${falls}${fallAt.length ? " [" + fallAt.slice(0, 4).join(" ") + "]" : ""} wallFrames ${hits} firstHits ${firstHits} maxImpact ${maxImpact.toFixed(2)} airFrames ${air} minSpeed ${minSpeed.toFixed(1)} stuckFrames ${stuck} routesUsed ${[...used].join(",")} cannons ${cannons}`);
  }
}
