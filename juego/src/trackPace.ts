import { F_SOLID, type PathRT, getPaths, getActiveTrack, getPads } from "./trackCurve";
import { zoneOnPath } from "./trackModes";

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const smooth = (x: number) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const index = (p: PathRT, i: number) => p.closed ? (i % p.n + p.n) % p.n : clamp(i, 0, p.n - 1);

/** Compute once per loaded circuit; the frame loop only reads a float. */
export function buildPace(path: PathRT, indoor: boolean, junctions: readonly number[] = [], pads: readonly number[] = []): Float32Array {
  const pace = new Float32Array(path.n).fill(1);
  const cap = indoor ? 0.14 : 0.26;
  for (let i = 0; i < path.n; i++) {
    let safe = !!(path.flags[i] & F_SOLID);
    let bend = 0;
    for (let sample = -Math.ceil(12 / path.ds); sample <= Math.ceil(84 / path.ds); sample++) {
      const j = index(path, i + sample);
      if (!(path.flags[j] & F_SOLID) || Math.abs(path.slope[j]) > 0.22 || path.half[j] < 5) safe = false;
      bend = Math.max(bend, Math.abs(Math.atan2(path.tx[i] * path.tz[j] - path.tz[i] * path.tx[j], path.tx[i] * path.tx[j] + path.tz[i] * path.tz[j])));
    }
    if (!safe) continue;
    const along = i * path.ds;
    // Leave room to choose a branch, land a jump, transform or approach a cannon.
    const distance = (at: number) => { const d = Math.abs(at - along); return path.closed ? Math.min(d, path.length - d) : d; };
    if (junctions.some(at => distance(at) < 65) || pads.some(at => distance(at) < 80)) continue;
    if (!path.closed && (along < 45 || path.length - along < 85)) continue;
    pace[i] = 1 + cap * (1 - smooth((bend - 0.08) / 0.32));
  }
  // Limit changes to 0.004 per metre, including the start/finish seam.
  const step = 0.004 * path.ds;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < path.n; i++) pace[i] = Math.min(pace[i], pace[index(path, i - 1)] + step);
    for (let i = path.n - 1; i >= 0; i--) pace[i] = Math.min(pace[i], pace[index(path, i + 1)] + step);
  }
  return pace;
}

let loaded: PathRT[] | null = null;
let fields: Float32Array[] = [];
export function trackPace(pathId: number, at: number): number {
  const paths = getPaths();
  if (loaded !== paths) {
    loaded = paths;
    const main = paths[0];
    fields = paths.map(path => {
      const junctions = path.main ? paths.slice(1).flatMap(branch => [branch.t0 * main.length, ((branch.t0 + branch.span) % 1) * main.length]) : [];
      const pads = getPads().filter(pad => pad.kind !== "boost").map(pad => {
        let best = Infinity; let at = -1;
        for (let i = 0; i < path.n; i++) {
          const d = Math.hypot(path.px[i] - pad.pos.x, path.py[i] - pad.pos.y, path.pz[i] - pad.pos.z);
          if (d < best) { best = d; at = i * path.ds; }
        }
        return best < path.half[0] + 2 ? at : -1;
      }).filter(at => at >= 0);
      const field = buildPace(path, !!getActiveTrack().indoor, junctions, pads);
      // A mode boundary is a braking area as well, on each actual ribbon.
      for (let i = 0; i < path.n; i++) {
        const kind = zoneOnPath(path.id, path.prog[i])?.type;
        for (const m of [-20, 20, 55]) {
          if (kind !== zoneOnPath(path.id, path.prog[index(path, i + Math.round(m / path.ds))])?.type) field[i] = 1;
        }
      }
      const step = 0.004 * path.ds;
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < path.n; i++) field[i] = Math.min(field[i], field[index(path, i - 1)] + step);
        for (let i = path.n - 1; i >= 0; i--) field[i] = Math.min(field[i], field[index(path, i + 1)] + step);
      }
      return field;
    });
  }
  const field = fields[pathId];
  return field && Number.isFinite(at) ? field[clamp(Math.round(at), 0, field.length - 1)] : 1;
}

export function cruisePace(road: number, speed: number, steer: number, airborne: boolean, drifting: boolean, hindered: boolean, alignment = 1): number {
  if (speed < 0 || airborne || drifting || hindered || alignment < 0.96) return 1;
  return 1 + (clamp(road, 1, 1.26) - 1) * (1 - smooth((Math.abs(steer) - 0.12) / 0.35));
}

/** Same neutral reference for all racers; shortcuts still reward faster routes. */
export function lapTimeBudget(): number {
  trackPace(0, 0);
  const main = getPaths()[0];
  let seconds = 8;
  for (let i = 0; i < main.n; i++) seconds += main.ds / (24 * fields[0][i]) * 1.25;
  return Math.max(40, seconds) * 1000;
}
