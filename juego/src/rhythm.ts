import { TRACKS, type ThemeId, type TrackDef, type PadDef, type ZoneKind } from "./data";
import { design, DESIGN_REPORT, type Turtle } from "./trackDesign";
import { setSong } from "./music";
import { audioContext } from "./sound";
import { renderRecipe, toWav, type SongRecipe } from "./songbook";

// ---------------------------------------------------------------------------
// Rhythm mode. A song the player brings is listened to once, before the race:
// how loud it is, where the beats fall, how much bass and how busy it is, bar
// by bar. Then a circuit is drawn from it, bar by bar, so that driving it at
// race pace takes as long as the song does: the quiet intro is a long
// straight, the verses wind, the chorus floats on magnets, and every drop is a
// jump. During the race the song plays, and the road appears around you in
// time with it.
// ---------------------------------------------------------------------------

/** One bar of four beats, every measure on a 0..1 scale against the rest of the song. */
export interface BarFeatures {
  /** loudness */
  energy: number;
  /** share of the sound below about 150 Hz */
  bass: number;
  /** how many hits it has */
  busy: number;
  /** share of the sound above about 2 kHz: hats, cymbals, bright synths */
  high?: number;
}

/** What is kept of a song: small enough to send to the other players in a network race. */
export interface SongFeatures {
  name: string;
  duration: number;
  bpm: number;
  /** seconds into the song of the first beat */
  offset: number;
  bars: BarFeatures[];
  /** how hard each beat hits, 0..9 */
  beats?: number[];
}

export const RHYTHM_TRACK_ID = "ritmo";
/** Units per second a kart covers at race pace on an ordinary circuit. */
const BASE_PACE = 31;
/** How much faster than usual everything runs on a song's circuit: faster songs, faster race. */
export const rushFor = (bpm: number) => Math.max(1.15, Math.min(1.45, 0.85 + bpm / 300));

/** The circuit last built from a song, for the race to read the song back off the road. */
let live: { length: number; lead: number; barLen: number; beatLen: number; bars: BarFeatures[]; beats: number[]; rush: number } | null = null;

/**
 * Speed multiplier at lap progress t on the song's circuit: the tempo sets it,
 * and the loud bars push it up a little more, so a chorus is felt in the feet.
 */
export function rhythmRush(t: number): number {
  if (!live) return 1;
  const bar = live.bars[Math.floor((t * live.length - live.lead) / live.barLen)];
  return live.rush * (1 + 0.12 * ((bar?.energy ?? 0.5) - 0.4));
}

/**
 * Where the notes go: on the strongest beats, at least two beats apart,
 * swapping sides of the road, as lap progress and metres off the centre line.
 */
export function rhythmNotes(max = 140): { t: number; lat: number; beat: number }[] {
  if (!live) return [];
  const out: { t: number; lat: number; beat: number }[] = [];
  const { beats, beatLen, lead, length } = live;
  const fallback = (k: number) => (k % 4 === 0 ? 8 : k % 2 === 0 ? 5 : 2);
  let last = -9;
  for (let k = 8; k < (beats.length || Math.floor((length - lead) / beatLen)); k++) {
    const s = beats.length ? beats[k] : fallback(k);
    if (s < 5 || k - last < 2) continue;
    const d = lead + k * beatLen;
    if (d > length - 80) break;
    last = k;
    out.push({ t: d / length, lat: ((k >> 1) % 3) - 1, beat: k });
  }
  // too many: keep an even spread of them
  if (out.length <= max) return out;
  const step = out.length / max;
  return Array.from({ length: max }, (_, i) => out[Math.floor(i * step)]);
}

/**
 * Listen to a decoded song. The sound is split in three bands (bass, middle,
 * bright); a hit is a jump in any of them, measured on a log scale so quiet
 * passages count as much as loud ones. The tempo is where the hits look most
 * like themselves a beat later (and two beats later, which settles whether a
 * song is at 70 or at 140), the phase is where they line up, and then every
 * beat gets a strength and every bar a summary.
 */
export function analyseSong(buffer: AudioBuffer, name: string, knownBpm?: number): SongFeatures {
  const rate = buffer.sampleRate;
  const n = buffer.length;
  const chans = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  const hop = 1024;
  const frames = Math.floor(n / hop);
  const frameSec = hop / rate;
  const energy = new Float32Array(frames);
  const bands = [new Float32Array(frames), new Float32Array(frames), new Float32Array(frames)];
  let lp1 = 0;
  let lp2 = 0;
  const k1 = 1 - Math.exp((-2 * Math.PI * 150) / rate);
  const k2 = 1 - Math.exp((-2 * Math.PI * 2000) / rate);
  for (let f = 0; f < frames; f++) {
    let e = 0;
    let lo = 0;
    let mid = 0;
    let hi = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) {
      let s = 0;
      for (const ch of chans) s += ch[i];
      s /= chans.length;
      lp1 += (s - lp1) * k1;
      lp2 += (s - lp2) * k2;
      e += s * s;
      lo += lp1 * lp1;
      mid += (lp2 - lp1) * (lp2 - lp1);
      hi += (s - lp2) * (s - lp2);
    }
    energy[f] = Math.sqrt(e / hop);
    bands[0][f] = Math.sqrt(lo / hop);
    bands[1][f] = Math.sqrt(mid / hop);
    bands[2][f] = Math.sqrt(hi / hop);
  }
  // hits: rises of the log energy in each band, the bright band counting a little more
  const raw = new Float32Array(frames);
  const weight = [1, 1, 1.4];
  for (let f = 1; f < frames; f++) {
    let v = 0;
    for (let b = 0; b < 3; b++) v += weight[b] * Math.max(0, Math.log1p(1000 * bands[b][f]) - Math.log1p(1000 * bands[b][f - 1]));
    raw[f] = v;
  }
  // less the local average, so a loud passage is not all hits
  const onset = new Float32Array(frames);
  let run = 0;
  const W = 16;
  for (let f = 0; f < frames; f++) {
    run += raw[f] - (f >= W ? raw[f - W] : 0);
    onset[f] = Math.max(0, raw[f] - run / Math.min(W, f + 1));
  }

  const span = Math.min(frames, Math.round(150 / frameSec));
  const ac = (lag: number) => {
    let s = 0;
    for (let f = lag; f < span; f++) s += onset[f] * onset[f - lag];
    return s;
  };
  const minLag = Math.max(2, Math.floor(60 / 190 / frameSec));
  const maxLag = Math.ceil(60 / 70 / frameSec);
  const acs: number[] = [];
  for (let lag = 0; lag <= maxLag * 2 + 2; lag++) acs.push(lag >= minLag / 2 ? ac(lag) : 0);
  let bestLag = Math.round(0.5 / frameSec);
  let bestScore = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = 60 / (lag * frameSec);
    // most songs are felt between 95 and 170
    const pref = Math.exp(-0.5 * (Math.log2(bpm / 128) / 0.7) ** 2);
    const score = (acs[lag] + 0.5 * acs[lag * 2] + 0.25 * acs[Math.round(lag / 2)]) * (0.4 + 0.6 * pref);
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  // between frames: the top of a parabola through the best lag and its neighbours
  const a = acs[bestLag - 1] ?? 0;
  const b = acs[bestLag];
  const c = acs[bestLag + 1] ?? 0;
  // a song whose tempo is known (one of the game's own) is not second-guessed
  const lagF = knownBpm ? 60 / knownBpm / frameSec : bestLag + (a - 2 * b + c !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / (a - 2 * b + c))) : 0);
  if (knownBpm) bestLag = Math.max(1, Math.round(lagF));
  const beat = lagF * frameSec;
  const bpm = Math.round((60 / beat) * 10) / 10;
  let offset = 0;
  let bestPhase = -1;
  for (let p = 0; p < bestLag; p++) {
    let s = 0;
    for (let k = 0; p + k * lagF < frames; k++) s += onset[Math.round(p + k * lagF)];
    if (s > bestPhase) {
      bestPhase = s;
      offset = p * frameSec;
    }
  }

  // every beat: the strongest hit within a frame or two of it
  const beatCount = Math.max(16, Math.floor((buffer.duration - offset) / beat));
  const hit: number[] = [];
  for (let k = 0; k < beatCount; k++) {
    const f = Math.round((offset + k * beat) / frameSec);
    let m = 0;
    for (let g = f - 2; g <= f + 2; g++) if (g >= 0 && g < frames) m = Math.max(m, onset[g]);
    hit.push(m);
  }
  const hitTop = [...hit].sort((x, y) => x - y)[Math.floor(hit.length * 0.95)] || 1;
  const beats = hit.map((h) => Math.max(0, Math.min(9, Math.round((h / hitTop) * 9))));

  const barSec = beat * 4;
  const count = Math.max(4, Math.floor((buffer.duration - offset) / barSec));
  const sums: { energy: number; bass: number; busy: number; high: number }[] = [];
  for (let bar = 0; bar < count; bar++) {
    const f0 = Math.floor((offset + bar * barSec) / frameSec);
    const f1 = Math.min(frames, Math.floor((offset + (bar + 1) * barSec) / frameSec));
    let e = 0;
    let lo = 0;
    let hi = 0;
    let all = 0;
    let on = 0;
    for (let f = f0; f < f1; f++) {
      e += energy[f];
      lo += bands[0][f];
      hi += bands[2][f];
      all += bands[0][f] + bands[1][f] + bands[2][f];
      on += onset[f];
    }
    const m = Math.max(1, f1 - f0);
    sums.push({ energy: e / m, bass: lo / Math.max(1e-6, all), busy: on / m, high: hi / Math.max(1e-6, all) });
  }
  const scale = (vals: number[]) => {
    const sorted = [...vals].sort((x, y) => x - y);
    const lo = sorted[Math.floor(sorted.length * 0.05)];
    const hi = sorted[Math.floor(sorted.length * 0.95)] || lo + 1e-6;
    return vals.map((v) => Math.max(0, Math.min(1, (v - lo) / Math.max(1e-6, hi - lo))));
  };
  const e = scale(sums.map((r) => r.energy));
  const bs = scale(sums.map((r) => r.bass));
  const bu = scale(sums.map((r) => r.busy));
  const hs = scale(sums.map((r) => r.high));
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    name,
    duration: buffer.duration,
    bpm,
    offset: Math.round(offset * 1000) / 1000,
    bars: sums.map((_, i) => ({ energy: r2(e[i]), bass: r2(bs[i]), busy: r2(bu[i]), high: r2(hs[i]) })),
    beats,
  };
}

/** What a stretch of the song is driven as. */
export type Section = "land" | "water" | "sub" | "sky" | "mag";

/**
 * Cut the song in phrases of four bars and give each a way to be driven: the
 * loudest bright ones fly, the loudest heavy ones float on magnets, the quiet
 * ones dive under the sea, the busy middle ones go by boat, and the rest is
 * road. A song long enough always gets every one of them at least once.
 */
export function songSections(bars: BarFeatures[]): Section[] {
  const n = bars.length;
  const out: Section[] = new Array(n).fill("land");
  const phrases: { from: number; to: number; e: number; busy: number; high: number; bass: number }[] = [];
  for (let p = 2; p + 2 < n - 1; p += 4) {
    const to = Math.min(n - 1, p + 4);
    const slice = bars.slice(p, to);
    const avg = (f: (b: BarFeatures) => number) => slice.reduce((s, b) => s + f(b), 0) / slice.length;
    phrases.push({ from: p, to, e: avg((b) => b.energy), busy: avg((b) => b.busy), high: avg((b) => b.high ?? b.busy), bass: avg((b) => b.bass) });
  }
  const kind = phrases.map((ph): Section => {
    if (ph.e > 0.72) return ph.bass > ph.high ? "mag" : "sky";
    if (ph.e < 0.3) return "sub";
    if (ph.high > 0.55 || ph.busy > 0.6) return "water";
    return "land";
  });
  // how sure each phrase is of its way: the weakest give way to road first
  const sure = (ph: (typeof phrases)[0], k: Section) =>
    k === "sky" || k === "mag" ? ph.e - 0.72 : k === "sub" ? 0.3 - ph.e : k === "water" ? Math.max(ph.high - 0.55, ph.busy - 0.6) : 0;
  // never two different ways in a row without road between them, and never three phrases off the road
  for (let i = 1; i < kind.length; i++) {
    if (kind[i] === "land" || kind[i - 1] === "land") continue;
    if (kind[i] !== kind[i - 1] || (i > 1 && kind[i - 2] === kind[i])) {
      if (sure(phrases[i], kind[i]) < sure(phrases[i - 1], kind[i - 1]) || kind[i] === kind[i - 1]) kind[i] = "land";
      else kind[i - 1] = "land";
    }
  }
  // at least half the lap on the road, where the items, the traps and the jumps are
  const off = () => kind.filter((k) => k !== "land").length;
  while (off() > Math.floor(kind.length * 0.5)) {
    let weakest = -1;
    for (let i = 0; i < kind.length; i++) if (kind[i] !== "land" && (weakest < 0 || sure(phrases[i], kind[i]) < sure(phrases[weakest], kind[weakest]))) weakest = i;
    kind[weakest] = "land";
  }
  // every way of driving, when there is room for it: the closest phrase still on the road takes the one missing
  const want: [Section, (ph: (typeof phrases)[0]) => number][] = [
    ["sky", (ph) => ph.e + ph.high],
    ["water", (ph) => ph.busy + ph.high - Math.abs(ph.e - 0.5)],
    ["sub", (ph) => -ph.e],
    ["mag", (ph) => ph.e + ph.bass],
  ];
  for (const [sec, score] of want) {
    if (kind.includes(sec)) continue;
    const lone = (i: number) => kind[i] === "land" && (kind[i - 1] ?? "land") === "land" && (kind[i + 1] ?? "land") === "land";
    const free = phrases.map((ph, i) => ({ i, s: score(ph) })).filter(({ i }) => lone(i) && off() < kind.length * 0.62);
    if (!free.length) continue;
    free.sort((x, y) => y.s - x.s);
    kind[free[0].i] = sec;
  }
  phrases.forEach((ph, i) => {
    for (let b = ph.from; b < ph.to; b++) out[b] = kind[i];
  });
  return out;
}

/** The aesthetic of a stretch, from the way it is driven and how loud it is. */
function themeFor(energy: number, base: ThemeId, section: Section = "land"): ThemeId {
  if (section === "sub") return "liquid";
  if (section === "water") return "aqua";
  if (section === "sky") return energy > 0.85 ? "vapor" : "dreamcore";
  if (section === "mag") return "cyberpunk";
  if (energy < 0.25) return "liminal";
  if (energy < 0.5) return base;
  if (energy < 0.75) return "sunset";
  return "techno";
}

const smoothstep = (x: number) => {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
};

/**
 * Draw the circuit of a song. Its shape is the song itself: the line runs
 * round once in the time the song lasts, out wide where it is loud and tucked
 * in where it is quiet, like the outline of the music drawn in a circle, and
 * however strange that comes out is how the circuit is. On that, every bar
 * is a swing to one side or the other and the busy bars are a chicane on the
 * half bar; the bass lifts the ground; each phrase is driven its own way
 * (road, boat, submarine, plane or magnets: see songSections); the drops are
 * jumps; and the strong beats put boosts down. Deterministic: the same
 * features always give the same circuit, which lets every machine in a
 * network race build it for itself.
 */
export function rhythmTrack(song: SongFeatures, base: ThemeId = "frutiger", stretch = 1): TrackDef {
  const bars = song.bars;
  const n = bars.length;
  const barSec = (60 / song.bpm) * 4;
  const rush = rushFor(song.bpm);
  // a little over race pace times the rush: a clean lap ends with the song
  const barLen = barSec * BASE_PACE * rush * stretch;
  const lead = 60;
  const L = Math.max(1600, lead + n * barLen + barLen);
  const R0 = L / (2 * Math.PI);
  const sections = songSections(bars);

  // features smoothed over a bar or so either side, and read at any distance along the lap
  const smooth = (vals: number[], sigma: number) =>
    vals.map((_, i) => {
      let s = 0;
      let w = 0;
      for (let k = Math.max(0, i - 4); k <= Math.min(vals.length - 1, i + 4); k++) {
        const g = Math.exp(-0.5 * ((k - i) / sigma) ** 2);
        s += vals[k] * g;
        w += g;
      }
      return s / w;
    });
  const env = smooth(bars.map((b) => b.energy), 2.5);
  const bassS = smooth(bars.map((b) => b.bass), 1);
  const meanEnv = env.reduce((x, y) => x + y, 0) / n;
  const barAt = (d: number) => (d - lead) / barLen;
  const read = (vals: number[], d: number) => {
    const u = Math.max(0, Math.min(n - 1, barAt(d) - 0.5));
    const i = Math.floor(u);
    const f = u - i;
    return vals[i] * (1 - f) + vals[Math.min(n - 1, i + 1)] * f;
  };
  // one big lobe per phrase of four bars: out for the loud and bright ones, in for the quiet and heavy ones
  const phraseVal: number[] = [];
  for (let p = 0; p < n; p += 4) {
    const slice = bars.slice(p, p + 4);
    const e = slice.reduce((a, b) => a + b.energy, 0) / slice.length;
    const tone = slice.reduce((a, b) => a + (b.high ?? b.busy) - b.bass, 0) / slice.length;
    phraseVal.push(Math.max(-1, Math.min(1, (e - meanEnv) * 2.2 + tone * 0.6)));
  }
  const lobe = (d: number) => {
    const u = Math.max(0, Math.min(phraseVal.length - 1, barAt(d) / 4 - 0.5));
    const i = Math.floor(u);
    const f = u - i;
    const w = (1 - Math.cos(Math.PI * f)) / 2;
    return phraseVal[i] * (1 - w) + phraseVal[Math.min(phraseVal.length - 1, i + 1)] * w;
  };
  // the start and the end of the lap are calm, so the grid sits on a gentle line
  const calmLen = Math.max(2.5 * barLen, 0.1 * L);
  const calm = (d: number) => smoothstep((d - lead) / calmLen) * smoothstep((L - d) / calmLen);

  // swings: never tighter than a radius of about 36
  const RMIN = 36;
  const swing = (d: number) => {
    const u = barAt(d);
    const i = Math.floor(u);
    if (i < 2 || i >= n - 1) return 0;
    const b = bars[i];
    if (sections[i] === "sky") return 0;
    const double = b.busy > 0.6;
    const l = double ? barLen / 2 : barLen;
    const f = double ? (u - i) * 2 : u - i;
    const side = (double ? Math.floor(f) + i : i) % 2 ? 1 : -1;
    // sin² starts and ends level, so one swing runs into the next without a corner
    const reach = (l * l) / (2 * Math.PI * Math.PI * RMIN);
    const amp = Math.min(reach, 18) * (0.4 + 0.6 * Math.max(b.busy, b.energy));
    return side * amp * Math.sin(Math.PI * (f - Math.floor(f))) ** 2;
  };

  const steps = Math.round(L / 12);
  const STEP = L / steps;
  const shape = (k: number) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const d = i * STEP;
      const th = (2 * Math.PI * d) / L;
      const r = R0 * (1 + k * calm(d) * (0.42 * lobe(d) + (read(env, d) - meanEnv) * 0.8)) + swing(d);
      pts.push([-R0 + r * Math.cos(th), r * Math.sin(th)]);
    }
    return pts;
  };
  // the tightest bend of a line, from the turn between successive steps
  const tightest = (pts: [number, number][]) => {
    let min = Infinity;
    for (let i = 1; i + 1 < pts.length; i++) {
      const h1 = Math.atan2(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const h2 = Math.atan2(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      let dh = Math.abs(h2 - h1);
      if (dh > Math.PI) dh = 2 * Math.PI - dh;
      const len = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      if (dh > 1e-6) min = Math.min(min, len / dh);
    }
    return min;
  };
  let k = 1;
  let pts = shape(k);
  for (let tries = 0; tries < 12 && tightest(pts) < RMIN * 0.8; tries++) pts = shape((k *= 0.85));
  // the bends make the road longer than the lap it was planned on: plan again, shorter, so the lap still lasts the song
  let drawn = 0;
  for (let i = 1; i < pts.length; i++) drawn += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  if (stretch === 1 && drawn / L > 1.02) return rhythmTrack(song, base, L / drawn);

  // height: the ground rides the bass; each section pulls it to its own level inside it
  const runs: { from: number; to: number; sec: Section }[] = [];
  for (let i = 0; i < n; i++) {
    if (sections[i] === "land") continue;
    const last = runs[runs.length - 1];
    if (last && last.to === i && last.sec === sections[i]) last.to = i + 1;
    else runs.push({ from: i, to: i + 1, sec: sections[i] });
  }
  const landY = (d: number) => 9 + 16 * read(bassS, d);
  const heightAt = (d: number) => {
    const edge = landY(d);
    const u = barAt(d);
    const run = runs.find((r) => u >= r.from && u < r.to);
    if (!run) return edge;
    const d0 = lead + run.from * barLen;
    const d1 = lead + run.to * barLen;
    const deep = run.sec === "sky" ? 50 + 12 * read(env, d) : run.sec === "sub" ? -20 : run.sec === "water" ? 0.6 : edge + 10;
    const ramp = Math.min(run.sec === "sky" ? 190 : run.sec === "sub" ? 140 : 80, (d1 - d0) / 2.2);
    return edge + (deep - edge) * smoothstep(Math.min(d - d0, d1 - d) / ramp);
  };
  const ys = pts.map((_, i) => heightAt(i * STEP));
  ys[ys.length - 1] = ys[0];
  // no climb steeper than about one in three, either way round
  const MAXS = 0.3 * STEP;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i - 1] - MAXS, Math.min(ys[i - 1] + MAXS, ys[i]));
    for (let i = ys.length - 2; i >= 0; i--) ys[i] = Math.max(ys[i + 1] - MAXS, Math.min(ys[i + 1] + MAXS, ys[i]));
  }

  const zones: [string, string, ZoneKind][] = runs.map((r) => [`b${r.from}`, `b${r.to}`, r.sec as ZoneKind]);
  const pads: [string, PadDef["kind"], number?, number?][] = [["go", "boost"]];
  const sectors: [string, ThemeId][] = [];
  let lastTheme: ThemeId = base;
  const beats = song.beats ?? [];
  bars.forEach((b, i) => {
    const theme = themeFor(b.energy, base, sections[i]);
    if (theme !== lastTheme && i > 1) sectors.push([`b${i}`, theme]);
    lastTheme = theme;
    if (i < 2 || i >= n - 1 || sections[i] === "sky") return;
    const prev = bars[i - 1].energy;
    if (sections[i] === "land" && sections[i - 1] === "land" && b.energy - prev > 0.3) pads.push([`b${i}`, "jump", 10 + 4 * b.energy]);
    else {
      // boosts on the hardest beats of a loud bar
      const strong = [0, 1, 2, 3].filter((q) => (beats[i * 4 + q] ?? (q === 0 ? 9 : q === 2 ? 6 : 0)) >= 6);
      if (b.energy > 0.4 || b.busy > 0.6) for (const q of strong.slice(0, b.energy > 0.7 ? 2 : 1)) pads.push([`b${i}`, "boost", 1.2 + 0.2 * b.energy, (q + 0.5) * (barLen / 4)]);
      // a quiet bar on the road between loud ones is a ramp
      else if (sections[i] === "land" && i % 3 === 0 && (bars[i + 1]?.energy ?? 0) > 0.5) pads.push([`b${i}`, "jump", 9, barLen * 0.6]);
    }
  });

  const draw = (t: Turtle) => {
    // the first point is the start line itself
    for (let i = 1; i < pts.length; i++) {
      const d = i * STEP;
      if (d >= 40 && d - STEP < 40) t.mark("go");
      const tx = pts[i][0];
      const tz = pts[i][1];
      t.h = Math.atan2(tx - t.x, tz - t.z);
      t.go(Math.max(0.01, Math.hypot(tx - t.x, tz - t.z)), ys[i] - ys[i - 1]);
      for (let b = 0; b <= n; b++) {
        const db = lead + b * barLen;
        if (db <= d && db > d - STEP) t.mark(`b${b}`);
      }
    }
  };

  const def = design({
    id: RHYTHM_TRACK_ID,
    theme: base,
    difficulty: 2,
    start: [0, ys[0], 0, 0],
    hazards: 3,
    sea: 0,
    warp: false,
    draw,
    zones,
    sectors: dedupe(sectors),
    pads,
    traffic: 2,
  });
  live = { length: DESIGN_REPORT[RHYTHM_TRACK_ID]?.length ?? L, lead, barLen, beatLen: barLen / 4, bars, beats, rush };
  return def;
}

function dedupe(list: [string, ThemeId][]) {
  const seen = new Set<string>();
  return list.filter(([m]) => (seen.has(m) ? false : (seen.add(m), true)));
}

/** Put a generated circuit in the list, in place of any earlier one with the same id. */
export function registerTrack(def: TrackDef) {
  const i = TRACKS.findIndex((t) => t.id === def.id);
  if (i >= 0) TRACKS.splice(i, 1, def);
  else TRACKS.push(def);
}

/** Seconds a race on this song lasts if the kart keeps race pace: the length of the song. */
export const songLapLength = (song: SongFeatures) => song.duration * BASE_PACE * rushFor(song.bpm);

/** The song loaded for rhythm mode, if any, and the circuit made from it. */
export const rhythmState: { features: SongFeatures | null; buffer: AudioBuffer | null; bytes: ArrayBuffer | null; theme: ThemeId } = { features: null, buffer: null, bytes: null, theme: "frutiger" };

/** Decode a song file, listen to it and build its circuit. */
export async function loadSong(bytes: ArrayBuffer, name: string, theme: ThemeId): Promise<SongFeatures> {
  const c = audioContext();
  if (!c) throw new Error("audio");
  const buffer = await c.decodeAudioData(bytes.slice(0));
  if (buffer.duration < 20) throw new Error("short");
  const features = analyseSong(buffer, name.replace(/\.[a-z0-9]+$/i, "").slice(0, 40));
  useSong(features, buffer, bytes, theme);
  return features;
}

/** Make a song current: build its circuit and hand the recording to the music player. */
export function useSong(features: SongFeatures, buffer: AudioBuffer | null, bytes: ArrayBuffer | null, theme: ThemeId) {
  registerTrack(rhythmTrack(features, theme));
  rhythmState.features = features;
  rhythmState.buffer = buffer;
  rhythmState.bytes = bytes;
  rhythmState.theme = theme;
  setSong(buffer, RHYTHM_TRACK_ID, features.bpm, features.offset);
}

/** Play one of the game's own songs into a recording, listen to it and build its circuit. */
export async function loadRecipe(recipe: SongRecipe, theme: ThemeId): Promise<SongFeatures> {
  const buffer = await renderRecipe(recipe);
  const features = analyseSong(buffer, recipe.name, recipe.bpm);
  useSong(features, buffer, toWav(buffer), theme);
  return features;
}
