import * as THREE from "three";
import { TRACKS, ZONES, TRACK_WIDTH, type TrackDef, type Branch , setBiomeTrack, defaultBiomes } from "./data";

// Single mutable curve instance shared by the whole game.
// setActiveTrack() swaps its points in place before a race starts.
export const trackCurve = new THREE.CatmullRomCurve3(
  TRACKS[0].points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
  true,
  "catmullrom",
  0.5
);

const norm = (t: number) => ((t % 1) + 1) % 1;

const SAMPLES = 800;
let samplePoints: THREE.Vector3[] = [];

function resample() {
  trackCurve.updateArcLengths();
  samplePoints = [];
  for (let i = 0; i <= SAMPLES; i++) samplePoints.push(trackCurve.getPointAt(i / SAMPLES));
}
resample();

let activeTrackId = TRACKS[0].id;

export function getActiveTrack(): TrackDef {
  return TRACKS.find((t) => t.id === activeTrackId) ?? TRACKS[0];
}

export function setActiveTrack(id: string) {
  const def = TRACKS.find((t) => t.id === id) ?? TRACKS[0];
  activeTrackId = def.id;
  trackCurve.points = def.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  resample();
  // swap the shared ZONES array in place so every consumer sees the new zones
  ZONES.length = 0;
  for (const z of def.zones) ZONES.push({ ...z });
  // a circuit with no scenery of its own inherits a four-stretch chain
  if (!def.biomes || !def.biomes.length) def.biomes = defaultBiomes(def.theme, TRACKS.indexOf(def));
  setBiomeTrack(def);
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
  const tt = ((t % 1) + 1) % 1;
  return trackCurve.getPointAt(tt);
}

export function trackTangentAt(t: number) {
  const tt = ((t % 1) + 1) % 1;
  return trackCurve.getTangentAt(tt);
}

const _tangent = new THREE.Vector3();

/**
 * Orthonormal surface frame at t. `normal` is the horizontal lateral axis and `up` the
 * true 3D normal of the road, so a circuit with elevation gets a real slope.
 */
export function trackFrameAt(t: number) {
  const tt = ((t % 1) + 1) % 1;
  const point = trackCurve.getPointAt(tt);
  const tangent = _tangent.copy(trackCurve.getTangentAt(tt)).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
  if (normal.lengthSq() < 1e-8) normal.set(1, 0, 0);
  normal.normalize();
  // keep it perpendicular to the tangent now that the tangent can climb
  normal.addScaledVector(tangent, -normal.dot(tangent));
  if (normal.lengthSq() < 1e-8) normal.set(1, 0, 0);
  else normal.normalize();
  const up = new THREE.Vector3().crossVectors(normal, tangent).normalize();
  if (up.y < 0) up.negate();
  return { point, tangent: tangent.clone(), normal, up };
}

/** Height of the road surface at t. Lanes are level across, so the offset does not matter. */
function smoothstep(a: number, b: number, x: number) {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

/**
 * Vertical offset of the racing surface caused by a gap. The road mesh and the
 * physics both read this, so a hole you can see is a hole you fall into.
 */
export function gapOffsetAt(t: number): number {
  const gaps = getActiveTrack().gaps;
  if (!gaps || !gaps.length) return 0;
  const tt = ((t % 1) + 1) % 1;
  let off = 0;
  for (const g of gaps) {
    if (tt < g.t0 || tt > g.t1) continue;
    const span = g.t1 - g.t0 || 0.0001;
    const u = (tt - g.t0) / span;
    if (u < 0.45) {
      // launch ramp: long enough to drive up, steep enough to launch
      off += g.ramp * Math.pow(u / 0.45, 1.5);
    } else if (u < 0.56) {
      // the lip falls away: past here the car is on its own
      off += g.ramp * (1 - smoothstep(0.45, 0.56, u));
    } else if (u < 0.8) {
      // pit floor
      off -= g.pit * smoothstep(0.56, 0.68, u);
    } else {
      // far wall, shallow enough to climb out of if you land with some speed
      off -= g.pit * (1 - smoothstep(0.8, 1, u) ** 1.5);
    }
  }
  return off;
}

/** True while the point is inside the pit floor of a gap. */
export function inGapPit(t: number): boolean {
  const gaps = getActiveTrack().gaps;
  if (!gaps) return false;
  const tt = ((t % 1) + 1) % 1;
  for (const g of gaps) {
    const u = (tt - g.t0) / (g.t1 - g.t0 || 1);
    if (u > 0.5 && u < 0.94) return true;
  }
  return false;
}

/** Parameter just past a gap, used to fish a stuck car back onto the road. */
export function gapExitT(t: number): number {
  const gaps = getActiveTrack().gaps ?? [];
  const tt = ((t % 1) + 1) % 1;
  let best = -1;
  for (const g of gaps) {
    if (tt >= g.t0 && tt <= g.t1) best = Math.max(best, g.t1 + 0.012);
  }
  return best < 0 ? tt : best % 1;
}

export function surfaceYAt(t: number): number {
  return trackPointAt(t).y + gapOffsetAt(t);
}

/** True 3D normal of the road at t, for orienting anything that sits on the surface. */
export function surfaceUpAt(t: number): THREE.Vector3 {
  return trackFrameAt(t).up;
}

/** Slope angle of the road at t, positive when the track climbs ahead. */
export function slopeAt(t: number): number {
  const tt = ((t % 1) + 1) % 1;
  const tan = trackCurve.getTangentAt(tt);
  return Math.asin(THREE.MathUtils.clamp(tan.y, -1, 1));
}

/** Half-width of the drivable road at parameter t (forks are wider, two lanes). */
export function halfWidthAt(t: number) {
  const def = getActiveTrack();
  const tt = ((t % 1) + 1) % 1;
  for (const f of def.forks) if (tt >= f[0] && tt <= f[1]) return TRACK_WIDTH / 2 + 7;
  return TRACK_WIDTH / 2;
}

function branchEnvelope(t: number, b: Branch) {
  const tt = norm(t);
  if (tt < b.t0 || tt > b.t1) return 0;
  const u = (tt - b.t0) / Math.max(1e-5, b.t1 - b.t0);
  return Math.sin(u * Math.PI);
}


/** Width of the side roads that peel off the main carriageway. */
export const SIDE_HALF = TRACK_WIDTH / 2 - 1.1;

export interface Lane {
  /** lateral bounds relative to the racing line */
  min: number;
  max: number;
  /** height of this lane's tarmac at t */
  y: number;
  kind: "main" | "side";
  /** which side of the racing line this side road sits on */
  side: 1 | -1 | 0;
}

/**
 * Every drivable surface at t, left to right. The main carriageway plus one lane
 * per side road, so a car knows what it is standing on: the old model widened a
 * single corridor, which meant side roads were drivable but had no surface of
 * their own (cars floated over them) and the verge between road and side road was
 * drivable too.
 */
export function lanesAt(t: number): Lane[] {
  const def = getActiveTrack();
  const lanes: Lane[] = [];
  const road = surfaceYAt(t);
  const main = halfWidthAt(t);
  lanes.push({ min: -main, max: main, y: road, kind: "main", side: 0 });
  for (const b of def.branches) {
    const env = branchEnvelope(t, b);
    if (env <= 0.001) continue;
    const centre = b.pull * env;
    lanes.push({ min: centre - SIDE_HALF, max: centre + SIDE_HALF, y: road + (b.rise ?? 0) * env, kind: "side", side: centre >= 0 ? 1 : -1 });
  }
  lanes.sort((a, b) => a.min - b.min);
  return lanes;
}

/** The lane a lateral offset belongs to, and how far outside it is when it does not. */
export function laneAt(t: number, offset: number): { lane: Lane; inside: boolean; outBy: number } {
  const lanes = lanesAt(t);
  for (const l of lanes) if (offset >= l.min && offset <= l.max) return { lane: l, inside: true, outBy: 0 };
  let best = lanes[0];
  let bestD = Infinity;
  for (const l of lanes) {
    const d = offset < l.min ? l.min - offset : offset - l.max;
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return { lane: best, inside: false, outBy: bestD };
}

/** Center of the alternate branch ribbon at t (null when not inside a branch). */
export function branchCenterAt(t: number): { point: THREE.Vector3; tangent: THREE.Vector3; normal: THREE.Vector3; pull: number } | null {
  const def = getActiveTrack();
  for (const b of def.branches) {
    const env = branchEnvelope(t, b);
    if (env > 0.001) {
      const point = trackPointAt(t);
      const tangent = trackTangentAt(t);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      return { point: point.clone().addScaledVector(normal, b.pull * env), tangent, normal, pull: b.pull };
    }
  }
  return null;
}

export function inFork(t: number) {
  const def = getActiveTrack();
  const tt = ((t % 1) + 1) % 1;
  return def.forks.some((f) => tt >= f[0] && tt <= f[1]);
}

export interface SideRoadGeo {
  /** where it leaves the main carriageway and where it merges back */
  entry: THREE.Vector3;
  exit: THREE.Vector3;
  t0: number;
  t1: number;
  pull: number;
  rise: number;
  side: 1 | -1;
  /** centre line of the side road, one sample every few metres */
  path: THREE.Vector3[];
}

/**
 * Side roads as real geometry. Unlike the old jump ribbons these are not arcs
 * hung above the track: the centre line stays on the racing surface, only
 * `rise` lifts it in the middle, so a car can simply drive onto them.
 */
export function getSideRoads(): SideRoadGeo[] {
  return getActiveTrack().branches.map((b) => {
    const span = ((b.t1 - b.t0) % 1 + 1) % 1;
    const path: THREE.Vector3[] = [];
    const STEPS = Math.max(12, Math.round(span * 220));
    for (let i = 0; i <= STEPS; i++) {
      const e = i / STEPS;
      const t = (b.t0 + span * e) % 1;
      const env = Math.sin(e * Math.PI);
      const c = trackPointAt(t);
      const tan = trackTangentAt(t);
      const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      const p = c.clone().addScaledVector(n, b.pull * env);
      p.y = surfaceYAt(t) + (b.rise ?? 0) * env;
      path.push(p);
    }
    const side: 1 | -1 = b.pull >= 0 ? 1 : -1;
    return { entry: path[0], exit: path[path.length - 1], t0: b.t0, t1: b.t1, pull: b.pull, rise: b.rise ?? 0, side, path };
  });
}

export function lateralOffsetFrom(pos: THREE.Vector3, t: number) {
  const center = trackPointAt(t);
  const tangent = trackTangentAt(t);
  const toPoint = new THREE.Vector3().subVectors(pos, center);
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  return toPoint.dot(normal);
}

/**
 * Traps slide along the circuit instead of sitting still. Both the renderer and
 * the collision check run this so what you see is what you hit.
 */
export function trapPhase(tr: { t: number; speed: number; phase: number }, now: number) {
  return ((((tr.t + now * 0.0001 * tr.speed + tr.phase) % 1) + 1) % 1);
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

/** Debug hook used by the harness to catch a car standing on nothing. */
