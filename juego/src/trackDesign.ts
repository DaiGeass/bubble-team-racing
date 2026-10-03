import * as THREE from "three";
import type { TrackDef, RouteDef, RouteKind, PadDef, Zone, ZoneKind, ThemeId, BiomeDef, BiomeId } from "./data";

// ---------------------------------------------------------------------------
// Track designer. A circuit is drawn the way you would describe it: go
// straight, turn left on this radius, climb this much, spiral up twice. The
// turtle turns that into the control points of the road, and names along the
// way ("the top of the tower", "the lip of the jump") are resolved to lap
// positions afterwards, so nothing in a circuit is a hand-typed fraction.
// ---------------------------------------------------------------------------

type P3 = [number, number, number];
const RAD = Math.PI / 180;

export class Turtle {
  x: number;
  y: number;
  z: number;
  /** heading in radians, the game's convention: direction is (sin h, cos h) */
  h: number;
  pts: P3[] = [];
  /** distance travelled when each point was laid */
  dist: number[] = [];
  travelled = 0;
  marks: Record<string, { i: number; h: number }> = {};

  constructor(x: number, y: number, z: number, headingDeg: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.h = headingDeg * RAD;
    this.push();
  }

  private push() {
    this.pts.push([this.x, this.y, this.z]);
    this.dist.push(this.travelled);
  }

  /** Straight on for `len`, climbing `dy` over it. */
  go(len: number, dy = 0) {
    if (len <= 0.01) return this;
    const n = Math.max(1, Math.ceil(len / 55));
    for (let k = 0; k < n; k++) {
      this.x += (Math.sin(this.h) * len) / n;
      this.z += (Math.cos(this.h) * len) / n;
      this.y += dy / n;
      this.travelled += len / n;
      this.push();
    }
    return this;
  }

  /**
   * A fall: the road runs flat to an edge and drops `dy` (negative) down a face
   * too steep to stay on, so anything arriving at speed flies off the edge and
   * lands below. Takes about 12 + 1.5 x the height along the ground.
   */
  drop(dy: number) {
    this.go(3);
    this.go(3, dy * 0.12);
    this.go(Math.abs(dy) * 1.5, dy * 0.76);
    this.go(6, dy * 0.12);
    return this;
  }

  /** Straight on for `len`, ending at absolute height `y`. */
  toY(len: number, y: number) {
    return this.go(len, y - this.y);
  }

  private arc(deg: number, r: number, dy: number, dir: 1 | -1) {
    const n = Math.max(1, Math.ceil(Math.abs(deg) / 30));
    const step = (deg * RAD) / n;
    // left of the direction of travel is (cos h, -sin h)
    const cx = this.x + Math.cos(this.h) * r * dir;
    const cz = this.z - Math.sin(this.h) * r * dir;
    for (let k = 0; k < n; k++) {
      this.h += step * dir;
      this.x = cx - Math.cos(this.h) * r * dir;
      this.z = cz + Math.sin(this.h) * r * dir;
      this.y += dy / n;
      this.travelled += Math.abs(step) * r;
      this.push();
    }
    return this;
  }

  left(deg: number, r: number, dy = 0) {
    return this.arc(deg, r, dy, 1);
  }

  right(deg: number, r: number, dy = 0) {
    return this.arc(deg, r, dy, -1);
  }

  /**
   * A bulge to one side that comes back to the line it left, pointing the same
   * way: out, across and back. Covers 4 x r x sin(deg) along that line, so it
   * can stand in for a straight of that length without moving anything else.
   */
  weave(side: "L" | "R", deg: number, r: number, dy = 0) {
    const out = side === "L" ? this.left.bind(this) : this.right.bind(this);
    const back = side === "L" ? this.right.bind(this) : this.left.bind(this);
    out(deg, r, dy / 4);
    back(deg * 2, r, dy / 2);
    out(deg, r, dy / 4);
    return this;
  }

  /** Name the current spot, to hang a zone, a jump, a pad or a junction on it. */
  mark(name: string) {
    this.marks[name] = { i: this.pts.length - 1, h: this.h };
    return this;
  }

  /**
   * A road that runs beside a straight: swing out to one side, run parallel for
   * `run`, swing back. While it is still swinging out it stays level with the
   * main road, and only once the two are apart does it climb to `peak` above
   * it, so there is never a step between them. `net` is the height the main
   * road gains between the two junctions.
   * Covers BYPASS + run along the straight.
   */
  bypass(side: "L" | "R", run: number, peak: number, net = 0) {
    const out = side === "L" ? this.left.bind(this) : this.right.bind(this);
    const back = side === "L" ? this.right.bind(this) : this.left.bind(this);
    const ramp = Math.min(run / 2, Math.max(50, Math.abs(peak) * 6));
    // rise of the main road per unit travelled along the straight
    const k = net / (BYPASS + run);
    const ARC = 40 * Math.sin(35 * RAD);
    const LEG = 30 * Math.cos(35 * RAD);
    this.go(18, k * 18);
    out(35, 40, k * ARC);
    this.go(30, k * LEG);
    back(35, 40, k * ARC);
    this.go(ramp, k * ramp + peak);
    this.mark("mid");
    this.go(run - ramp * 2, k * (run - ramp * 2));
    this.go(ramp, k * ramp - peak);
    back(35, 40, k * ARC);
    this.go(30, k * LEG);
    out(35, 40, k * ARC);
    this.go(18, k * 18);
    return this;
  }
}

/** Forward distance a bypass takes besides its parallel run, for laying the straight it runs beside. */
export const BYPASS = 177;

interface RouteSpec {
  from: string;
  to: string;
  draw: (t: Turtle) => unknown;
  width?: number;
  walls?: boolean;
  tunnel?: boolean;
  kind?: RouteKind;
  /** a second channel, flight line or tunnel rather than a road */
  afloat?: boolean;
  /** [mark on the route, length in units]: a jump on the route */
  holes?: [string, number][];
  /** [mark on the route, kind, power] */
  pads?: [string, PadDef["kind"], number?][];
}

interface DesignSpec {
  id: string;
  theme: ThemeId;
  difficulty: 1 | 2 | 3;
  /** x, y, z and heading in degrees of the start line */
  start: [number, number, number, number];
  draw: (t: Turtle) => unknown;
  width?: number;
  floor?: number;
  sea?: number;
  hazards?: number;
  biomes?: BiomeDef[];
  /** [from mark, to mark, kind] */
  zones?: [string, string, ZoneKind][];
  /** [mark where the tarmac ends, length in units] */
  holes?: [string, number][];
  kick?: number;
  /** [from mark, to mark]: no barriers */
  open?: [string, string][];
  /** [mark, kind, power, units before (-) or after (+) the mark] */
  pads?: [string, PadDef["kind"], number?, number?][];
  /** [mark of the cannon, mark where it lands, arc height] */
  cannons?: [string, string, number?][];
  /** [mark, aesthetic]: from that mark on the lap is in that aesthetic. The line starts in `theme`. */
  sectors?: [string, ThemeId][];
  traffic?: number;
  /** [mark of the mouth, mark of the exit]: a warp gate by the barrier */
  portals?: [string, string][];
  routes?: RouteSpec[];
}

/** What the designer had to bend to make each circuit close, for the checker. */
export const DESIGN_REPORT: Record<string, { closeError: number; routeErrors: number[]; length: number }> = {};

export function design(spec: DesignSpec): TrackDef {
  const t = new Turtle(spec.start[0], spec.start[1], spec.start[2], spec.start[3]);
  spec.draw(t);

  // Close the loop: whatever the drawing misses the start by is spread evenly
  // along the lap, which keeps straights straight and bends smooth.
  const last = t.pts.length - 1;
  const ex = t.pts[last][0] - t.pts[0][0];
  const ey = t.pts[last][1] - t.pts[0][1];
  const ez = t.pts[last][2] - t.pts[0][2];
  const total = t.dist[last] || 1;
  for (let i = 0; i <= last; i++) {
    const k = t.dist[i] / total;
    t.pts[i][0] -= ex * k;
    t.pts[i][1] -= ey * k;
    t.pts[i][2] -= ez * k;
  }
  const pts = t.pts.slice(0, last);

  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), true, "centripetal");
  const length = curve.getLength();
  const N = 3000;
  const samples = curve.getSpacedPoints(N);
  const tOfPoint = (p: P3) => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < N; i++) {
      const s = samples[i];
      const d = (s.x - p[0]) ** 2 + (s.y - p[1]) ** 2 + (s.z - p[2]) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best / N;
  };
  const tOf = (name: string, shift = 0) => {
    const m = t.marks[name];
    if (!m) throw new Error(`track ${spec.id}: no mark "${name}"`);
    const idx = Math.min(m.i, last - 1);
    return (((tOfPoint(pts[idx] ?? pts[0]) + shift / length) % 1) + 1) % 1;
  };

  const zones: Zone[] = (spec.zones ?? []).map(([a, b, type]) => ({ t0: tOf(a), t1: tOf(b), type }));
  const holes = (spec.holes ?? []).map(([m, len]) => [tOf(m), tOf(m, len)] as [number, number]);
  const pads: PadDef[] = (spec.pads ?? []).map(([m, kind, power, shift]) => ({ t: tOf(m, shift ?? 0), kind, power }));
  for (const [from, to, lift] of spec.cannons ?? []) pads.push({ t: tOf(from), kind: "cannon", toT: tOf(to), lift });

  const routeErrors: number[] = [];
  const routes: RouteDef[] = (spec.routes ?? []).map((r, ri) => {
    const a = t.marks[r.from];
    const b = t.marks[r.to];
    if (!a || !b) throw new Error(`track ${spec.id}: route needs marks "${r.from}" and "${r.to}"`);
    const pa = pts[Math.min(a.i, last - 1)];
    const pb = pts[Math.min(b.i, last - 1)];
    const rt = new Turtle(pa[0], pa[1], pa[2], a.h / RAD);
    r.draw(rt);
    // bend the route so it lands exactly on the junction it is meant to reach
    const rl = rt.pts.length - 1;
    const dx = rt.pts[rl][0] - pb[0];
    const dy = rt.pts[rl][1] - pb[1];
    const dz = rt.pts[rl][2] - pb[2];
    routeErrors.push(Math.hypot(dx, dz));
    const rTotal = rt.dist[rl] || 1;
    for (let i = 0; i <= rl; i++) {
      const k = rt.dist[i] / rTotal;
      rt.pts[i][0] -= dx * k;
      rt.pts[i][1] -= dy * k;
      rt.pts[i][2] -= dz * k;
    }
    const frac = (name: string, shift = 0) => {
      const m = rt.marks[name];
      if (!m) throw new Error(`track ${spec.id}: route has no mark "${name}"`);
      return Math.min(1, Math.max(0, (rt.dist[m.i] + shift) / rTotal));
    };
    for (const [m, kind, power] of r.pads ?? []) pads.push({ t: frac(m), route: ri, kind, power });
    return {
      t0: tOf(r.from),
      t1: tOf(r.to),
      // the first and last stretch belong to the junctions, which the runtime lays along the main road
      points: rt.pts.slice(2, rl - 1),
      width: r.width,
      walls: r.walls,
      tunnel: r.tunnel,
      kind: r.kind ?? (r.walls === false ? "cut" : undefined),
      afloat: r.afloat,
      holes: (r.holes ?? []).map(([m, len]) => [frac(m), frac(m, len)] as [number, number]),
    };
  });

  DESIGN_REPORT[spec.id] = { closeError: Math.hypot(ex, ez), routeErrors, length };

  const sectors = [{ t0: 0, theme: spec.theme }, ...(spec.sectors ?? []).map(([m, theme]) => ({ t0: tOf(m), theme }))].sort((a, b) => a.t0 - b.t0);
  // the ground clutter of each stretch follows its aesthetic
  const biomeOf: Record<ThemeId, BiomeId> = {
    frutiger: "meadow", eco: "forest", aero: "cloud", techno: "city", aqua: "reef", sunset: "desert",
    y2k: "city", liquid: "coast", win98: "city", vapor: "ruins", dreamcore: "cloud", cyberpunk: "volcano", noir: "ruins",
  };
  const biomes: BiomeDef[] = sectors.map((s, i) => ({ id: biomeOf[s.theme], t0: s.t0, t1: sectors[i + 1]?.t0 ?? 1 }));

  let lowest = Infinity;
  for (const p of pts) lowest = Math.min(lowest, p[1]);
  for (const r of routes) for (const p of r.points) lowest = Math.min(lowest, p[1]);

  return {
    id: spec.id,
    theme: spec.theme,
    difficulty: spec.difficulty,
    hazards: spec.hazards ?? 0,
    points: pts,
    zones,
    forks: [],
    branches: [],
    designed: true,
    noGround: true,
    floor: spec.floor ?? (spec.sea !== undefined ? Math.min(spec.sea - 20, lowest - 12) : lowest - 1.2),
    sea: spec.sea,
    width: spec.width,
    holes,
    kick: spec.kick,
    open: (spec.open ?? []).map(([a, b]) => [tOf(a), tOf(b)] as [number, number]),
    pads,
    portals: (spec.portals ?? []).map(([a, b], i) => ({ tIn: tOf(a), tOut: tOf(b), side: i % 2 ? -1 : 1, cd: 4 })),
    routes,
    biomes: spec.biomes ?? biomes,
    sectors,
    traffic: spec.traffic,
  };
}
