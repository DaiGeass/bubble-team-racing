import * as THREE from "three";
import { TRACKS, ZONES, TRACK_WIDTH, type TrackDef, type RouteDef, setBiomeTrack, defaultBiomes } from "./data";

// ---------------------------------------------------------------------------
// Track runtime. A circuit is a set of road ribbons in real 3D: the main loop
// plus any number of alternate routes that leave it and rejoin it. Ribbons may
// pass over and under each other; everything that needs to know "what is under
// this point" asks groundAt(), which picks the surface by height, so a bridge
// and the road beneath it are two different floors.
// ---------------------------------------------------------------------------

// Main loop of the active circuit. setActiveTrack() swaps its points in place.
export const trackCurve = new THREE.CatmullRomCurve3(
  TRACKS[0].points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
  true,
  "catmullrom",
  0.5
);

const norm = (t: number) => ((t % 1) + 1) % 1;

/** sample is drivable tarmac (not inside a hole) */
export const F_SOLID = 1;
/** barrier on the +lateral edge */
export const F_WALL_POS = 2;
/** barrier on the -lateral edge */
export const F_WALL_NEG = 4;
/** covered stretch, dressed with arches */
export const F_TUNNEL = 8;

/** One road ribbon, sampled every couple of metres along its centre line. */
export interface PathRT {
  id: number;
  main: boolean;
  closed: boolean;
  /** number of samples */
  n: number;
  /** metres between samples */
  ds: number;
  length: number;
  /** lap progress where the ribbon starts and how much of the lap it spans */
  t0: number;
  span: number;
  px: Float32Array;
  py: Float32Array;
  pz: Float32Array;
  /** unit tangent on the ground plane */
  tx: Float32Array;
  tz: Float32Array;
  /** rise per metre travelled along the tangent */
  slope: Float32Array;
  half: Float32Array;
  /** how far either side of the sample, along the tangent, its strip of tarmac extends */
  reach: Float32Array;
  prog: Float32Array;
  flags: Uint8Array;
  def: RouteDef | null;
}

/** Answer of a surface query. Reused by callers, never allocated per frame. */
export interface Ground {
  path: number;
  idx: number;
  y: number;
  /** signed distance from the centre line, positive towards (-tz, tx) */
  lat: number;
  /** distance past the sample along the tangent */
  along: number;
  half: number;
  prog: number;
  slope: number;
  tx: number;
  tz: number;
  flags: number;
}

export function makeGround(): Ground {
  return { path: -1, idx: 0, y: 0, lat: 0, along: 0, half: 0, prog: 0, slope: 0, tx: 0, tz: 1, flags: 0 };
}

let paths: PathRT[] = [];
const CELL = 20;
let grid = new Map<number, number[]>();
const PACK = 16384;

const cellKey = (cx: number, cz: number) => (cx + 2048) * 4096 + (cz + 2048);

export function getPaths(): PathRT[] {
  return paths;
}

let activeTrackId = TRACKS[0].id;

export function getActiveTrack(): TrackDef {
  return TRACKS.find((t) => t.id === activeTrackId) ?? TRACKS[0];
}

function inRanges(ranges: [number, number][] | undefined, t: number) {
  if (!ranges) return false;
  for (const r of ranges) {
    if (r[0] <= r[1] ? t >= r[0] && t <= r[1] : t >= r[0] || t <= r[1]) return true;
  }
  return false;
}

function smoothstep(a: number, b: number, x: number) {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

/** Half-width of the main carriageway at lap progress t. Wide stretches taper in and out. */
export function halfWidthAt(t: number) {
  const def = getActiveTrack();
  const tt = norm(t);
  const base = (def.width ?? TRACK_WIDTH) / 2;
  let half = base;
  const TAPER = 0.012;
  const widen = (a: number, b: number, to: number) => {
    const k = smoothstep(a - TAPER, a, tt) * (1 - smoothstep(b, b + TAPER, tt));
    half = Math.max(half, base + (to - base) * k);
  };
  for (const f of def.forks) widen(f[0], f[1], base + 7);
  for (const w of def.widths ?? []) widen(w[0], w[1], w[2]);
  return half;
}

function allocPath(id: number, n: number, main: boolean): PathRT {
  return {
    id, main, closed: main, n, ds: 1, length: 1, t0: 0, span: 1,
    px: new Float32Array(n), py: new Float32Array(n), pz: new Float32Array(n),
    tx: new Float32Array(n), tz: new Float32Array(n), slope: new Float32Array(n),
    half: new Float32Array(n), reach: new Float32Array(n), prog: new Float32Array(n), flags: new Uint8Array(n), def: null,
  };
}

/** How far before a hole the tarmac starts curling up into a launch lip. */
const KICK_RUN = 14;

function fillPath(
  p: PathRT,
  curve: THREE.Curve<THREE.Vector3>,
  halfAt: (u: number, prog: number) => number,
  holes: [number, number][] | undefined,
  kick: number,
  walled: (prog: number, u: number) => boolean,
  tunnel: boolean
) {
  const len = curve.getLength();
  p.length = len;
  const steps = p.closed ? p.n : p.n - 1;
  p.ds = len / steps;
  const pt = new THREE.Vector3();
  const tan = new THREE.Vector3();
  for (let i = 0; i < p.n; i++) {
    const u = i / steps;
    curve.getPointAt(Math.min(1, u), pt);
    curve.getTangentAt(Math.min(1, u), tan);
    const h = Math.hypot(tan.x, tan.z) || 1;
    p.px[i] = pt.x;
    p.py[i] = pt.y;
    p.pz[i] = pt.z;
    p.tx[i] = tan.x / h;
    p.tz[i] = tan.z / h;
    const prog = norm(p.t0 + p.span * u);
    p.prog[i] = prog;
    p.half[i] = halfAt(u, prog);
    const key = p.main ? prog : u;
    let f = inRanges(holes, key) ? 0 : F_SOLID;
    if (walled(prog, u)) f |= F_WALL_POS | F_WALL_NEG;
    if (tunnel) f |= F_TUNNEL;
    p.flags[i] = f;
    p.reach[i] = p.ds * 0.6;
  }
  // launch lips: the last metres before a hole curl up, so speed becomes height
  if (holes && kick > 0) {
    const run = Math.max(2, Math.round(KICK_RUN / p.ds));
    for (let i = 0; i < p.n; i++) {
      if (!(p.flags[i] & F_SOLID)) continue;
      for (let k = 1; k <= run; k++) {
        const j = p.closed ? (i + k) % p.n : i + k;
        if (j >= p.n) break;
        if (!(p.flags[j] & F_SOLID)) {
          const u = 1 - (k - 1) / run;
          p.py[i] += kick * u * u;
          break;
        }
      }
    }
  }
  // slope from the final heights, so the lip launches for real
  for (let i = 0; i < p.n; i++) {
    let a = p.closed ? (i - 1 + p.n) % p.n : Math.max(0, i - 1);
    let b = p.closed ? (i + 1) % p.n : Math.min(p.n - 1, i + 1);
    // at the rim of a hole only the tarmac side counts
    if (p.flags[i] & F_SOLID) {
      if (!(p.flags[b] & F_SOLID)) b = i;
      if (!(p.flags[a] & F_SOLID)) a = i;
    }
    if (a === b) continue;
    // on the outside of a bend the strips fan out, so they are made longer there
    const turn = Math.abs(Math.atan2(p.tx[a] * p.tz[b] - p.tz[a] * p.tx[b], p.tx[a] * p.tx[b] + p.tz[a] * p.tz[b]));
    p.reach[i] = p.ds * 0.6 + p.half[i] * turn * 0.55;
    const d = Math.hypot(p.px[b] - p.px[a], p.pz[b] - p.pz[a]) || 1;
    p.slope[i] = (p.py[b] - p.py[a]) / d;
  }
}

/** Old-style side road: a lateral bulge off the main loop, turned into a real ribbon. */
function branchPoints(b: { t0: number; t1: number; pull: number; rise?: number }): THREE.Vector3[] {
  const span = norm(b.t1 - b.t0);
  const out: THREE.Vector3[] = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const e = i / N;
    const t = norm(b.t0 + span * e);
    const env = Math.sin(e * Math.PI);
    const c = trackCurve.getPointAt(t);
    const tan = trackCurve.getTangentAt(t);
    const h = Math.hypot(tan.x, tan.z) || 1;
    // it only climbs once it has cleared the main road, so there is no step between them
    const lift = (b.rise ?? 0) * smoothstep(0.62, 1, env);
    out.push(new THREE.Vector3(c.x + (-tan.z / h) * b.pull * env, c.y + lift, c.z + (tan.x / h) * b.pull * env));
  }
  return out;
}

function routeList(def: TrackDef): RouteDef[] {
  if (def.routes) return def.routes;
  return def.branches.map((b) => ({ t0: b.t0, t1: b.t1, points: [], width: TRACK_WIDTH - 2.2, legacy: b }));
}

function rebuild(def: TrackDef) {
  trackCurve.points = def.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  trackCurve.updateArcLengths();
  const len = trackCurve.getLength();

  paths = [];
  const main = allocPath(0, Math.max(400, Math.round(len / 1.9)), true);
  fillPath(main, trackCurve, (_u, prog) => halfWidthAt(prog), def.holes, def.kick ?? 2.6, (prog) => !inRanges(def.open, prog), false);
  paths.push(main);

  for (const r of routeList(def)) {
    let pts: THREE.Vector3[];
    if (r.legacy) {
      pts = branchPoints(r.legacy);
    } else {
      // leave and rejoin along the main road's own direction, so the mouths are smooth
      const lead = 14 / len;
      const a = trackCurve.getPointAt(norm(r.t0));
      const a2 = trackCurve.getPointAt(norm(r.t0 + lead));
      const b2 = trackCurve.getPointAt(norm(r.t1 - lead));
      const b = trackCurve.getPointAt(norm(r.t1));
      pts = [a, a2, ...r.points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), b2, b];
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
    const rl = curve.getLength();
    const p = allocPath(paths.length, Math.max(12, Math.round(rl / 1.9)) + 1, false);
    p.t0 = norm(r.t0);
    p.span = norm(r.t1 - r.t0);
    p.def = r;
    const half = (r.width ?? 14) / 2;
    fillPath(p, curve, () => half, r.holes, r.kick ?? 2.6, () => r.walls !== false, !!r.tunnel);
    // a generated side road on the inside of a hairpin folds over itself: the
    // ribbon would overlap its own tarmac, so it is left out
    if (r.legacy) {
      let tight = false;
      for (let i = 4; i < p.n && !tight; i++) {
        const turn = Math.abs(Math.atan2(p.tx[i - 4] * p.tz[i] - p.tz[i - 4] * p.tx[i], p.tx[i - 4] * p.tx[i] + p.tz[i - 4] * p.tz[i]));
        if (turn > 1e-3 && (4 * p.ds) / turn < half * 1.6) tight = true;
      }
      if (tight) continue;
    }
    paths.push(p);
  }

  grid = new Map();
  for (const p of paths) {
    for (let i = 0; i < p.n; i++) {
      if (!(p.flags[i] & F_SOLID)) continue;
      const key = cellKey(Math.floor(p.px[i] / CELL), Math.floor(p.pz[i] / CELL));
      let cell = grid.get(key);
      if (!cell) grid.set(key, (cell = []));
      cell.push(p.id * PACK + i);
    }
  }

  // A barrier is only real where the tarmac actually ends. Where another ribbon
  // carries on past the edge (a route peeling off, a merge) the wall is dropped,
  // for the mesh and for the physics alike.
  const probe = makeGround();
  for (const p of paths) {
    for (let i = 0; i < p.n; i++) {
      if (!(p.flags[i] & F_SOLID)) continue;
      for (const side of [1, -1]) {
        const bit = side === 1 ? F_WALL_POS : F_WALL_NEG;
        if (!(p.flags[i] & bit)) continue;
        const reach = p.half[i] + 1.1;
        const x = p.px[i] - p.tz[i] * side * reach;
        const z = p.pz[i] + p.tx[i] * side * reach;
        if (groundAt(x, z, p.py[i] + 0.9, probe, 0.9, p.id, i) && probe.y > p.py[i] - 0.9) p.flags[i] &= ~bit;
      }
    }
  }
}

/**
 * The floor under (x, z) for something at height y: of the ribbons that are not
 * more than `stepUp` above it, the one closest in height. A car under a bridge
 * gets the lower road, a car on the bridge gets the deck, and something dropping
 * from the sky gets the first floor below it. `skipPath`/`skipIdx` leave out the
 * neighbourhood of one sample, which is how wall building asks "is there any
 * OTHER road here".
 */
export function groundAt(x: number, z: number, y: number, out: Ground, stepUp = 1.6, skipPath = -1, skipIdx = 0): boolean {
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  let bestGap = Infinity;
  let bestAlong = Infinity;
  let bestPid = 1e9;
  let found = false;
  const top = y + stepUp;
  for (let gx = cx - 1; gx <= cx + 1; gx++) {
    for (let gz = cz - 1; gz <= cz + 1; gz++) {
      const cell = grid.get(cellKey(gx, gz));
      if (!cell) continue;
      for (let k = 0; k < cell.length; k++) {
        const code = cell[k];
        const pid = (code / PACK) | 0;
        const i = code - pid * PACK;
        const p = paths[pid];
        if (pid === skipPath) {
          let d = Math.abs(i - skipIdx);
          if (p.closed) d = Math.min(d, p.n - d);
          if (d * p.ds < 60) continue;
        }
        const dx = x - p.px[i];
        const dz = z - p.pz[i];
        const along = dx * p.tx[i] + dz * p.tz[i];
        if (along > p.reach[i] || along < -p.reach[i]) continue;
        const lat = -dx * p.tz[i] + dz * p.tx[i];
        const half = p.half[i];
        if (lat > half || lat < -half) continue;
        const sy = p.py[i] + along * p.slope[i];
        if (sy > top) continue;
        // the floor closest in height wins: you stay on the road you are on even
        // while another one overlaps it a little higher or lower. Where two
        // ribbons share a floor the main loop wins, then the closest sample.
        const gap = Math.abs(sy - y);
        const a = Math.abs(along);
        const closer = gap < bestGap - 0.25;
        if (closer || (gap < bestGap + 0.25 && (pid < bestPid || (pid === bestPid && a < bestAlong)))) {
          bestGap = closer ? gap : Math.min(bestGap, gap);
          bestAlong = a;
          bestPid = pid;
          found = true;
          out.path = pid;
          out.idx = i;
          out.y = sy;
          out.lat = lat;
          out.along = along;
          out.half = half;
          out.prog = norm(p.prog[i] + (along / p.length) * (p.main ? 1 : p.span));
          out.slope = p.slope[i];
          out.tx = p.tx[i];
          out.tz = p.tz[i];
          out.flags = p.flags[i];
        }
      }
    }
  }
  return found;
}

/**
 * Where (x, z) sits relative to one ribbon, searched around a known sample.
 * Used for barriers: it answers even when the point is outside the tarmac.
 * False when the point has run past the end of an open ribbon.
 */
export function locate(pathId: number, hint: number, x: number, z: number, out: Ground, win = 8): boolean {
  const p = paths[pathId];
  if (!p) return false;
  let best = -1;
  let bestD = Infinity;
  for (let k = -win; k <= win; k++) {
    let i = hint + k;
    if (p.closed) i = ((i % p.n) + p.n) % p.n;
    else if (i < 0 || i >= p.n) continue;
    const dx = x - p.px[i];
    const dz = z - p.pz[i];
    const along = dx * p.tx[i] + dz * p.tz[i];
    const d = Math.abs(along);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (best < 0) return false;
  const i = best;
  const dx = x - p.px[i];
  const dz = z - p.pz[i];
  const along = dx * p.tx[i] + dz * p.tz[i];
  if (Math.abs(along) > p.ds * 2.5) return false;
  out.path = pathId;
  out.idx = i;
  out.along = along;
  out.lat = -dx * p.tz[i] + dz * p.tx[i];
  out.y = p.py[i] + along * p.slope[i];
  out.half = p.half[i];
  out.prog = p.prog[i];
  out.slope = p.slope[i];
  out.tx = p.tx[i];
  out.tz = p.tz[i];
  out.flags = p.flags[i];
  return true;
}

/** Sample of the main loop at lap progress t. */
export function mainIndexAt(t: number) {
  const m = paths[0];
  return Math.round(norm(t) * m.n) % m.n;
}

/** World position of a point on a ribbon, `lat` metres off its centre line. */
export function pathPoint(pathId: number, idx: number, lat: number, out: THREE.Vector3) {
  const p = paths[pathId];
  const i = p.closed ? ((idx % p.n) + p.n) % p.n : Math.min(p.n - 1, Math.max(0, idx));
  return out.set(p.px[i] - p.tz[i] * lat, p.py[i], p.pz[i] + p.tx[i] * lat);
}

/**
 * Where to put a car back after a fall: the sample it last stood on, walked
 * back until there is a clear run-up, so nobody respawns on the lip of a jump.
 */
export function safeSpot(pathId: number, idx: number): { path: number; idx: number } {
  let p = paths[pathId] ?? paths[0];
  let i = Math.min(p.n - 1, Math.max(0, idx));
  const RUN = 48;
  for (let guard = 0; guard < 400; guard++) {
    const ahead = Math.round(RUN / p.ds);
    let clear = (p.flags[i] & F_SOLID) !== 0;
    for (let k = 1; clear && k <= ahead; k++) {
      const j = p.closed ? (i + k) % p.n : i + k;
      if (j >= p.n) break;
      if (!(p.flags[j] & F_SOLID)) clear = false;
    }
    if (clear) return { path: p.id, idx: i };
    i -= 3;
    if (i < 0) {
      if (p.closed) i += p.n;
      else {
        // ran off the start of a route: carry on backwards along the main loop
        const t = p.t0;
        p = paths[0];
        i = mainIndexAt(t);
      }
    }
  }
  return { path: 0, idx: 0 };
}

export interface PadRT {
  pos: THREE.Vector3;
  heading: number;
  kind: "boost" | "jump";
  power?: number;
}

/** Pads of the active circuit, placed on the ribbon they belong to. */
export function getPads(): PadRT[] {
  const def = getActiveTrack();
  return (def.pads ?? []).map((pad) => {
    const pid = pad.route === undefined ? 0 : pad.route + 1;
    const p = paths[pid] ?? paths[0];
    const i = p.main ? mainIndexAt(pad.t) : Math.round(Math.min(1, Math.max(0, pad.t)) * (p.n - 1));
    return { pos: pathPoint(p.id, i, pad.lat ?? 0, new THREE.Vector3()), heading: Math.atan2(p.tx[i], p.tz[i]), kind: pad.kind, power: pad.power };
  });
}

export function setActiveTrack(id: string) {
  const def = TRACKS.find((t) => t.id === id) ?? TRACKS[0];
  activeTrackId = def.id;
  rebuild(def);
  resample();
  // swap the shared ZONES array in place so every consumer sees the new zones
  ZONES.length = 0;
  for (const z of def.zones) ZONES.push({ ...z });
  // a circuit with no scenery of its own inherits a four-stretch chain
  if (!def.biomes || !def.biomes.length) def.biomes = defaultBiomes(def.theme, TRACKS.indexOf(def));
  setBiomeTrack(def);
}

// ---------------------------------------------------------------------------
// Main-loop helpers, addressed by lap progress. Scenery and track-side objects
// are placed with these.
// ---------------------------------------------------------------------------

const SAMPLES = 800;
let samplePoints: THREE.Vector3[] = [];

function resample() {
  samplePoints = [];
  for (let i = 0; i <= SAMPLES; i++) samplePoints.push(trackCurve.getPointAt(i / SAMPLES));
}

export function nearestT(pos: THREE.Vector3, hintT?: number): number {
  let bestT = 0;
  let bestD = Infinity;
  let searchStart = 0;
  let searchEnd = SAMPLES;
  if (hintT !== undefined) {
    const window = 60;
    const center = Math.round(hintT * SAMPLES);
    searchStart = center - window;
    searchEnd = center + window;
  }
  for (let i = searchStart; i <= searchEnd; i++) {
    const idx = ((i % SAMPLES) + SAMPLES) % SAMPLES;
    const d = samplePoints[idx].distanceToSquared(pos);
    if (d < bestD) {
      bestD = d;
      bestT = idx / SAMPLES;
    }
  }
  return bestT;
}

export function trackPointAt(t: number) {
  return trackCurve.getPointAt(norm(t));
}

export function trackTangentAt(t: number) {
  return trackCurve.getTangentAt(norm(t));
}

const _tangent = new THREE.Vector3();

/**
 * Orthonormal surface frame at t. `normal` is the horizontal lateral axis and `up` the
 * true 3D normal of the road, so a circuit with elevation gets a real slope.
 */
export function trackFrameAt(t: number) {
  const tt = norm(t);
  const point = trackCurve.getPointAt(tt);
  const tangent = _tangent.copy(trackCurve.getTangentAt(tt)).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
  if (normal.lengthSq() < 1e-8) normal.set(1, 0, 0);
  normal.normalize();
  const up = new THREE.Vector3().crossVectors(normal, tangent).normalize();
  if (up.y < 0) up.negate();
  return { point, tangent: tangent.clone(), normal, up };
}

/** Height of the main road surface at t, launch lips included. */
export function surfaceYAt(t: number): number {
  const m = paths[0];
  return m.py[mainIndexAt(t)];
}

export function inFork(t: number) {
  const def = getActiveTrack();
  const tt = norm(t);
  return def.forks.some((f) => tt >= f[0] && tt <= f[1]);
}

export function lateralOffsetFrom(pos: THREE.Vector3, t: number) {
  const center = trackPointAt(t);
  const tangent = trackTangentAt(t);
  const h = Math.hypot(tangent.x, tangent.z) || 1;
  return ((pos.x - center.x) * -tangent.z + (pos.z - center.z) * tangent.x) / h;
}

/**
 * Traps slide along the circuit instead of sitting still. Both the renderer and
 * the collision check run this so what you see is what you hit.
 */
export function trapPhase(tr: { t: number; speed: number; phase: number }, now: number) {
  return norm(tr.t + now * 0.0001 * tr.speed + tr.phase);
}

/** World transform of a trap at a given clock time. */
export function trapTransform(
  tr: { t: number; side: number; kind: "spike" | "bar"; speed: number; phase: number },
  now: number
) {
  const t = trapPhase(tr, now);
  const c = trackPointAt(t);
  const tan = trackTangentAt(t);
  const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
  const off = tr.side * (halfWidthAt(t) - 2.2);
  const p = c.clone().addScaledVector(n, off);
  return { t, p, ground: surfaceYAt(t), heading: Math.atan2(tan.x, tan.z), span: halfWidthAt(t) };
}

/** Ground-anchored world position of a portal mouth. */
export function portalTransform(pr: { tIn: number; side: number }, which: "in" | "out", out?: { tOut: number; side: number }) {
  const t = which === "in" ? pr.tIn : out!.tOut;
  const side = which === "in" ? pr.side : out!.side;
  const c = trackPointAt(t);
  const tan = trackTangentAt(t);
  const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
  const p = c.clone().addScaledVector(n, side * (halfWidthAt(t) - 2.6));
  return { t, p, ground: surfaceYAt(t), heading: Math.atan2(tan.x, tan.z) };
}

rebuild(TRACKS[0]);
resample();
