import * as THREE from "three";
import { groundAt, locate, makeGround, getPaths, mainIndexAt, pathPoint, safeSpot, F_WALL_POS, F_WALL_NEG, type Ground } from "./trackCurve";

// ---------------------------------------------------------------------------
// Vehicle physics, free of rendering so it can be run headless. A body moves
// on the ground plane under its own heading and speed; this module decides what
// it is standing on, stops it at barriers, drops it when the road ends and
// keeps count of how far round the lap it has really driven.
// ---------------------------------------------------------------------------

/** Downward acceleration, in units per second squared. */
export const GRAVITY = 26;
/** Fastest vertical speed the road may drag a vehicle up or down with it. */
const MAX_GLUE = 34;
/** Collision radius of a vehicle. */
export const BODY_RADIUS = 0.9;
/** A fall this far below the last road it stood on is a fall out of the circuit. */
const KILL_DROP = 30;
/** Landing this far along the lap from where you took off is not a shortcut, it is a fall. */
const MAX_SKIP = 0.12;

export interface Body {
  /** x and z are authoritative; y mirrors `y` */
  pos: THREE.Vector3;
  y: number;
  vy: number;
  airborne: boolean;
  heading: number;
  /** direction of travel. The same as the heading on tarmac; a hull on water slides, so there it lags the bow */
  course: number;
  speed: number;
  /** ribbon and sample last stood on */
  path: number;
  idx: number;
  /** lap progress 0..1 of the road under the body */
  prog: number;
  /** laps really driven, fractional: going backwards takes it back */
  total: number;
  /** where a fall puts the body back */
  safePath: number;
  safeIdx: number;
  /** scraping a barrier this frame */
  touching: boolean;
  /** height of the road under the body */
  groundY: number;
  /** rise per metre in the direction the body is pointing */
  slopeAlong: number;
  /** metres off the centre line of the road it is on, and that road's half-width */
  lat: number;
  half: number;
}

export interface StepOpts {
  /** added to the road height: hull bob, hover */
  rideOffset: number;
  /** vertical bobbing vehicle: needs real separation before it counts as airborne */
  bobbing: boolean;
  /** flying: holds `flyAlt` above the road and ignores gravity */
  fly: boolean;
  flyAlt: number;
  /** how far past the edge of the road a flying vehicle may stray (negative keeps it inside, as in a tube) */
  flyMargin: number;
  /** passes through barriers */
  ghost: boolean;
  /** share of gravity that acts on it: a levitating craft comes down slowly */
  gravityMul?: number;
}

export interface StepResult {
  /** speed into the barrier as a fraction of total speed, 0 when no contact */
  wallImpact: number;
  /** the contact started this frame */
  wallFirst: boolean;
  /** downward speed at touchdown, 0 when it did not land this frame */
  landed: number;
  /** left the ground this frame */
  launched: boolean;
  /** out of the circuit: the caller should respawn it */
  fell: boolean;
}

export function makeResult(): StepResult {
  return { wallImpact: 0, wallFirst: false, landed: 0, launched: false, fell: false };
}

const G = makeGround();
const W = makeGround();

function wrapAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Signed shortest way round the lap from a to b, in -0.5..0.5. */
export function progDelta(from: number, to: number) {
  return ((((to - from) % 1) + 1.5) % 1) - 0.5;
}

/**
 * Barriers. A body is fenced by the tarmac it is on: at a walled edge it is held
 * a body-radius inside. If it has left every ribbon on its floor (in the air, or
 * a fast step past the edge) the ribbon it last stood on fences it instead, at
 * any height, so a crest never throws a car out of a walled stretch.
 * Returns true when it pushed the body back.
 */
function wall(b: Body, opts: StepOpts, dt: number, res: StepResult, vx: number, vz: number): boolean {
  if (opts.ghost) return false;
  const onFloor = !opts.fly && groundAt(b.pos.x, b.pos.z, b.y, W, 1.6) && W.y > b.y - 2.5;
  if (!onFloor) {
    if (b.path < 0 || !locate(b.path, b.idx, b.pos.x, b.pos.z, W)) return false;
    // keep following the ribbon while in the air, so its barriers still apply
    b.idx = W.idx;
    // something already below the deck is past its barrier
    if (!opts.fly && b.y - W.y < -1.5) return false;
  }
  // flying vehicles are kept in a corridor a little wider than the road
  const lim = opts.fly ? W.half + opts.flyMargin : W.half - BODY_RADIUS;
  let side = 0;
  if (W.lat > lim && (opts.fly || W.flags & F_WALL_POS)) side = 1;
  else if (W.lat < -lim && (opts.fly || W.flags & F_WALL_NEG)) side = -1;
  if (!side) return false;

  // outward normal of the barrier
  const nx = -W.tz * side;
  const nz = W.tx * side;
  const over = Math.abs(W.lat) - lim;
  b.pos.x -= nx * over;
  b.pos.z -= nz * over;

  // (vx, vz) is the direction the body is really moving in
  const into = vx * nx + vz * nz;
  if (into > 0) {
    // sine of the angle to the barrier: 0 is a graze, 1 is head-on
    const impact = Math.min(1, into);
    const fwd = vx * W.tx + vz * W.tz >= 0 ? 1 : -1;
    // swing the travel round to run along the barrier, and the nose with it
    const turn = wrapAngle(Math.atan2(W.tx * fwd, W.tz * fwd) - Math.atan2(vx, vz)) * Math.min(1, dt * (4 + 9 * impact));
    b.heading += turn;
    b.course += turn;
    if (!b.touching) {
      // the hit costs what was driven into the barrier, a graze costs next to nothing
      b.speed *= 1 - 0.1 * impact - 0.62 * impact * impact;
      res.wallFirst = true;
    } else {
      b.speed *= Math.max(0, 1 - (0.22 + 1.5 * impact) * dt);
    }
    res.wallImpact = Math.max(res.wallImpact, impact);
  }
  return true;
}

/**
 * Advance a body by (dx, dz) on the ground plane and settle it vertically.
 * The move is cut into short steps so a fast body cannot skip a barrier.
 */
export function moveBody(b: Body, dx: number, dz: number, dt: number, opts: StepOpts, res: StepResult) {
  res.wallImpact = 0;
  res.wallFirst = false;
  res.landed = 0;
  res.launched = false;
  res.fell = false;

  const dist = Math.hypot(dx, dz);
  const steps = Math.min(6, Math.max(1, Math.ceil(dist / 0.7)));
  let touched = false;
  // direction of travel; standing still it is taken to be the way the body points
  let vx = dist > 1e-5 ? dx / dist : Math.sin(b.heading);
  let vz = dist > 1e-5 ? dz / dist : Math.cos(b.heading);
  for (let s = 0; s < steps; s++) {
    b.pos.x += (vx * dist) / steps;
    b.pos.z += (vz * dist) / steps;
    const before = b.course;
    if (wall(b, opts, dt / steps, res, vx, vz)) {
      touched = true;
      // the rest of this move goes the way the barrier turned it
      const turned = b.course - before;
      if (turned !== 0) {
        const c = Math.cos(turned);
        const s2 = Math.sin(turned);
        const nvx = vx * c + vz * s2;
        vz = vz * c - vx * s2;
        vx = nvx;
      }
    }
  }
  b.touching = touched;

  const found = groundAt(b.pos.x, b.pos.z, b.y, G, b.airborne ? 0.5 : 1.6);

  if (opts.fly) {
    // planes hold their altitude profile over whatever road is below them
    const base = found ? G.y : b.groundY;
    b.y = THREE.MathUtils.lerp(b.y, base + opts.flyAlt, 0.12);
    b.vy = 0;
    b.airborne = false;
    if (found) stand(b, G, res);
  } else if (!found) {
    // nothing underneath: fall until something is, or until it is clearly gone
    if (!b.airborne) res.launched = true;
    b.airborne = true;
    b.vy -= GRAVITY * (opts.gravityMul ?? 1) * dt;
    b.y += b.vy * dt;
    if (b.y < b.groundY - KILL_DROP) res.fell = true;
  } else {
    const rideY = G.y + opts.rideOffset;
    const need = THREE.MathUtils.clamp(dt > 1e-4 ? (rideY - b.y) / dt : 0, -MAX_GLUE, MAX_GLUE);
    const fall = b.vy - GRAVITY * (opts.gravityMul ?? 1) * dt;
    // the road dropped away faster than gravity can follow: we leave it
    if (!b.airborne && need < fall - 1.5 && (!opts.bobbing || b.y - rideY > 0.3)) {
      b.airborne = true;
      res.launched = true;
    }
    if (b.airborne) {
      b.vy = fall;
      b.y += b.vy * dt;
      if (b.y <= rideY && b.vy <= 0) {
        res.landed = -b.vy;
        b.y = rideY;
        b.vy = 0;
        b.airborne = false;
        // dropping onto a different part of the lap is leaving the circuit
        if (Math.abs(progDelta(b.prog, G.prog)) > MAX_SKIP) res.fell = true;
        else stand(b, G, res);
      } else if (b.y < b.groundY - KILL_DROP) {
        res.fell = true;
      }
    } else {
      b.y = rideY;
      // carry the road's own vertical speed, so a lip throws the body and a crest
      // lets go of it. Taken from the slope, not from the height change: stepping
      // up a kerb must not turn into a launch.
      b.vy = dt > 1e-4 ? (G.slope * (dx * G.tx + dz * G.tz)) / dt : 0;
      stand(b, G, res);
    }
  }
  b.pos.y = b.y;
}

/** The body is on this surface: take its lap progress and remember it as a safe place. */
function stand(b: Body, g: Ground, _res: StepResult) {
  const d = progDelta(b.prog, g.prog);
  if (Math.abs(d) <= MAX_SKIP) b.total += d;
  b.prog = g.prog;
  b.path = g.path;
  b.idx = g.idx;
  b.groundY = g.y;
  b.lat = g.lat;
  b.half = g.half;
  const sgn = Math.sin(b.heading) * g.tx + Math.cos(b.heading) * g.tz;
  b.slopeAlong = g.slope * sgn;
  // only the middle of the road is a place worth coming back to
  if (Math.abs(g.lat) < g.half - 2) {
    b.safePath = g.path;
    b.safeIdx = g.idx;
  }
}

const _p = new THREE.Vector3();

/** Put a body on a given sample of a ribbon, pointing along it. Counts the lap progress it gains or loses. */
export function placeBody(b: Body, pathId: number, idx: number, lat = 0) {
  const p = getPaths()[pathId];
  const i = p.closed ? ((idx % p.n) + p.n) % p.n : Math.min(p.n - 1, Math.max(0, idx));
  pathPoint(pathId, i, lat, _p);
  b.pos.copy(_p);
  b.y = _p.y;
  b.vy = 0;
  b.airborne = false;
  b.touching = false;
  b.heading = Math.atan2(p.tx[i], p.tz[i]);
  b.course = b.heading;
  b.path = pathId;
  b.idx = i;
  b.total += progDelta(b.prog, p.prog[i]);
  b.prog = p.prog[i];
  b.groundY = _p.y;
  b.lat = lat;
  b.half = p.half[i];
  b.slopeAlong = p.slope[i];
  b.safePath = pathId;
  b.safeIdx = i;
}

/** Back onto the road after a fall, with room to build speed before the next jump. */
export function respawnBody(b: Body) {
  const s = safeSpot(b.safePath, b.safeIdx);
  placeBody(b, s.path, s.idx);
}

/**
 * Point the AI steers at: `look` metres ahead along the road it has chosen,
 * `latFrac` of the way from the centre to the edge. `route` is the ribbon it
 * wants to take (0 = stay on the main loop). Returns the route it is still
 * committed to, which drops back to 0 once it has rejoined.
 */
export function aimAhead(b: Body, route: number, look: number, latFrac: number, out: THREE.Vector3): number {
  const paths = getPaths();
  const main = paths[0];
  const lookT = look / main.length;
  let pathId = 0;
  let idx = mainIndexAt(b.prog + lookT);
  // already well inside a route (pushed in, or put back there after a fall): follow it
  if (route === 0 && b.path > 0) {
    const on = paths[b.path];
    const u = progDelta(on.t0, b.prog) / on.span;
    if (u > 0.12 && u < 0.88) route = b.path;
  }
  if (route > 0 && paths[route]) {
    const rt = paths[route];
    const rel = progDelta(rt.t0, b.prog);
    if (b.path !== route && rel > rt.span + 0.004) {
      route = 0;
    } else {
      // Measured in metres along the route itself. A route is not the same
      // length as the stretch of main road it replaces, so from the main road
      // the position is carried over as a share of the way between the junctions.
      const along = b.path === route ? b.idx * rt.ds : (rel / rt.span) * rt.length;
      const i = Math.round((along + look) / rt.ds);
      if (i >= 0 && i <= rt.n - 1) {
        pathId = route;
        idx = i;
      } else if (i > rt.n - 1) {
        // past its far end: carry on along the main road from the junction
        idx = mainIndexAt(rt.t0 + rt.span + (along + look - rt.length) / main.length);
      }
    }
  }
  const p = paths[pathId];
  pathPoint(pathId, idx, latFrac * Math.max(0, p.half[Math.min(p.n - 1, idx)] - 2.6), out);
  return route;
}

/**
 * How much the road turns over the next `dist` metres from a sample, in
 * radians: negative is a bend to the left, positive to the right.
 */
export function bendAhead(pathId: number, idx: number, dist: number): number {
  const p = getPaths()[pathId];
  if (!p) return 0;
  const step = Math.max(1, Math.round(9 / p.ds));
  const n = Math.max(1, Math.round(dist / (step * p.ds)));
  let sum = 0;
  let a = p.closed ? ((idx % p.n) + p.n) % p.n : Math.min(p.n - 1, Math.max(0, idx));
  for (let k = 0; k < n; k++) {
    let b = a + step;
    if (p.closed) b %= p.n;
    else if (b >= p.n) break;
    sum += Math.atan2(p.tx[a] * p.tz[b] - p.tz[a] * p.tx[b], p.tx[a] * p.tx[b] + p.tz[a] * p.tz[b]);
    a = b;
  }
  return sum;
}

/** Circle-against-circle shove between two bodies on the same floor. Returns the closing speed, 0 if apart. */
export function collideBodies(a: Body, b: Body, wa: number, wb: number): number {
  const dx = b.pos.x - a.pos.x;
  const dz = b.pos.z - a.pos.z;
  const min = BODY_RADIUS * 2.1;
  const d2 = dx * dx + dz * dz;
  if (d2 >= min * min || d2 < 1e-6) return 0;
  if (Math.abs(a.y - b.y) > 1.6) return 0;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const nz = dz / d;
  const push = min - d;
  // the heavier one gives way less
  const ka = wb / (wa + wb);
  const kb = wa / (wa + wb);
  a.pos.x -= nx * push * ka;
  a.pos.z -= nz * push * ka;
  b.pos.x += nx * push * kb;
  b.pos.z += nz * push * kb;
  // closing speed along the line between them
  const va = (Math.sin(a.heading) * nx + Math.cos(a.heading) * nz) * a.speed;
  const vb = (Math.sin(b.heading) * nx + Math.cos(b.heading) * nz) * b.speed;
  const closing = va - vb;
  if (closing <= 0) return 0;
  // trade a share of it: the one running into the other slows, the one hit is shoved on
  a.speed -= closing * 0.45 * ka * (Math.sin(a.heading) * nx + Math.cos(a.heading) * nz);
  b.speed += closing * 0.45 * kb * (Math.sin(b.heading) * nx + Math.cos(b.heading) * nz);
  return closing;
}
