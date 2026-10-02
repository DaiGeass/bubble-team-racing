import * as THREE from "three";
import { TRACKS, ZONES, TRACK_WIDTH, type TrackDef, type Branch } from "./data";

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
export function surfaceYAt(t: number): number {
  return trackPointAt(t).y;
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

/**
 * Drivable lateral bounds at t: forks widen symmetrically, branches peel off to one side.
 * With no branches it returns halfWidthAt(t) on both sides, so the main road is unchanged.
 */
export function corridorBounds(t: number): { min: number; max: number; branch: number } {
  const def = getActiveTrack();
  const tt = norm(t);
  const half = TRACK_WIDTH / 2;
  let min = -half;
  let max = half;
  let branch = 0;

  for (const f of def.forks) {
    if (tt >= f[0] && tt <= f[1]) {
      min = -(half + 7);
      max = half + 7;
    }
  }
  for (const b of def.branches) {
    const env = branchEnvelope(t, b);
    if (env > 0.001) {
      branch = Math.max(branch, env);
      const off = b.pull * env;
      if (off > 0) max = Math.max(max, off + half + 1.5);
      else min = Math.min(min, off - half - 1.5);
    }
  }
  return { min, max, branch };
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

export interface ShortcutGeo {
  entry: THREE.Vector3;
  exit: THREE.Vector3;
  heading: number;
  entryHeading: number;
  lift: number;
  t0: number;
  t1: number;
  side: number;
  /** centre line of the alternate route, hugging the terrain plus `lift` */
  path: THREE.Vector3[];
}

/** Alternative paths: drive into the glowing gate and you fly an arc to the exit gate. */
export function getShortcuts(): ShortcutGeo[] {
  const def = getActiveTrack();
  return def.shortcuts.map((s) => {
    const mk = (t: number) => {
      const c = trackPointAt(t);
      const tan = trackTangentAt(t);
      const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      const p = c.clone().addScaledVector(n, s.side * (halfWidthAt(t) - 3.6));
      return { p, h: Math.atan2(tan.x, tan.z) };
    };
    const a = mk(s.t0);
    const b = mk(s.t1);
    const span = ((s.t1 - s.t0) % 1 + 1) % 1;
    // The alternate route is sampled straight off the circuit so it climbs and
    // dives with the relief instead of cutting a chord through a hillside, and so
    // the drawn ribbon matches exactly the line the warp follows.
    const path: THREE.Vector3[] = [];
    const STEPS = 26;
    for (let i = 0; i <= STEPS; i++) {
      const e = i / STEPS;
      const t = (s.t0 + span * e) % 1;
      const c = trackPointAt(t);
      const tan = trackTangentAt(t);
      const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      const off = s.side * (halfWidthAt(t) - 3.6);
      const p = c.clone().addScaledVector(n, off);
      p.y = surfaceYAt(t) + Math.sin(e * Math.PI) * s.lift;
      path.push(p);
    }
    return {
      entry: a.p,
      exit: b.p,
      heading: b.h,
      entryHeading: a.h,
      lift: s.lift,
      t0: s.t0,
      t1: s.t1,
      side: s.side,
      path,
    };
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
