import * as THREE from "three";
import { TRACKS, ZONES, TRACK_WIDTH, type TrackDef } from "./data";

// Single mutable curve instance shared by the whole game.
// setActiveTrack() swaps its points in place before a race starts.
export const trackCurve = new THREE.CatmullRomCurve3(
  TRACKS[0].points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
  true,
  "catmullrom",
  0.5
);

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

/** Half-width of the drivable road at parameter t (forks are wider, two lanes). */
export function halfWidthAt(t: number) {
  const def = getActiveTrack();
  const tt = ((t % 1) + 1) % 1;
  for (const f of def.forks) if (tt >= f[0] && tt <= f[1]) return TRACK_WIDTH / 2 + 7;
  return TRACK_WIDTH / 2;
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
      p.y = 0;
      return { p, h: Math.atan2(tan.x, tan.z) };
    };
    const a = mk(s.t0);
    const b = mk(s.t1);
    return { entry: a.p, exit: b.p, heading: b.h, entryHeading: a.h, lift: 9 };
  });
}

export function lateralOffsetFrom(pos: THREE.Vector3, t: number) {
  const center = trackPointAt(t);
  const tangent = trackTangentAt(t);
  const toPoint = new THREE.Vector3().subVectors(pos, center);
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  return toPoint.dot(normal);
}
