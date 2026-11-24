import { TRACKS, type ThemeId, type TrackDef, type PadDef } from "./data";
import { design, BYPASS, type RouteSpec, type Turtle } from "./trackDesign";
import { setSong } from "./music";
import { audioContext } from "./sound";

// ---------------------------------------------------------------------------
// Rhythm mode. A song the player brings is listened to once, before the race:
// how loud it is, where the beats fall, how much bass and how busy it is, bar
// by bar. Then a circuit is drawn from it, bar by bar, so that driving it at
// race pace takes as long as the song does: the quiet intro is a long
// straight, the verses wind, the chorus floats on magnets, and every drop is a
// jump. During the race the song plays, and the road appears around you in
// time with it.
// ---------------------------------------------------------------------------

/** What is kept of a song: small enough to send to the other players in a network race. */
export interface SongFeatures {
  name: string;
  duration: number;
  bpm: number;
  /** seconds into the song of the first beat */
  offset: number;
  /** one entry per bar of four beats: loudness, share of bass, and how busy it is, all 0..1 */
  bars: { energy: number; bass: number; busy: number }[];
}

export const RHYTHM_TRACK_ID = "ritmo";
/** Units per second a kart covers at race pace, to size the lap to the song. */
const PACE = 32;

/**
 * Listen to a decoded song: frame loudness, bass, onsets, tempo by
 * autocorrelation of the onsets, and a summary per bar.
 */
export function analyseSong(buffer: AudioBuffer, name: string): SongFeatures {
  const rate = buffer.sampleRate;
  const n = buffer.length;
  const chans = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  const hop = 1024;
  const frames = Math.floor(n / hop);
  const energy = new Float32Array(frames);
  const bass = new Float32Array(frames);
  let low = 0;
  // a one-pole low-pass at about 150 Hz separates the bass from the rest
  const k = 1 - Math.exp((-2 * Math.PI * 150) / rate);
  for (let f = 0; f < frames; f++) {
    let e = 0;
    let b = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) {
      let s = 0;
      for (const ch of chans) s += ch[i];
      s /= chans.length;
      low += (s - low) * k;
      e += s * s;
      b += low * low;
    }
    energy[f] = Math.sqrt(e / hop);
    bass[f] = Math.sqrt(b / hop);
  }
  // onset strength: how much louder each frame is than the one before
  const onset = new Float32Array(frames);
  for (let f = 1; f < frames; f++) onset[f] = Math.max(0, energy[f] - energy[f - 1]);
  const frameSec = hop / rate;

  // tempo: the lag at which the onsets look most like themselves, between 70 and 180 beats a minute
  let bestLag = Math.round(0.5 / frameSec);
  let bestScore = -1;
  const minLag = Math.round(60 / 180 / frameSec);
  const maxLag = Math.round(60 / 70 / frameSec);
  const span = Math.min(frames, Math.round(90 / frameSec));
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let f = lag; f < span; f++) s += onset[f] * onset[f - lag];
    // a gentle preference for the middle of the range, where most songs live
    const bpm = 60 / (lag * frameSec);
    s *= 1 - Math.min(0.3, Math.abs(bpm - 120) / 300);
    if (s > bestScore) {
      bestScore = s;
      bestLag = lag;
    }
  }
  const beat = bestLag * frameSec;
  const bpm = Math.round((60 / beat) * 10) / 10;
  // phase: where in the first beat the onsets line up best
  let offset = 0;
  let bestPhase = -1;
  for (let p = 0; p < bestLag; p++) {
    let s = 0;
    for (let f = p; f < frames; f += bestLag) s += onset[f];
    if (s > bestPhase) {
      bestPhase = s;
      offset = p * frameSec;
    }
  }

  // bars of four beats
  const barSec = beat * 4;
  const count = Math.max(4, Math.floor((buffer.duration - offset) / barSec));
  const raw: { energy: number; bass: number; busy: number }[] = [];
  for (let b = 0; b < count; b++) {
    const f0 = Math.floor((offset + b * barSec) / frameSec);
    const f1 = Math.min(frames, Math.floor((offset + (b + 1) * barSec) / frameSec));
    let e = 0;
    let lo = 0;
    let on = 0;
    for (let f = f0; f < f1; f++) {
      e += energy[f];
      lo += bass[f];
      on += onset[f];
    }
    const m = Math.max(1, f1 - f0);
    raw.push({ energy: e / m, bass: lo / Math.max(1e-6, e), busy: on / m });
  }
  // put each measure on a 0..1 scale against the song itself, ignoring the loudest and quietest few
  const scale = (vals: number[]) => {
    const sorted = [...vals].sort((a, b) => a - b);
    const lo = sorted[Math.floor(sorted.length * 0.05)];
    const hi = sorted[Math.floor(sorted.length * 0.95)] || lo + 1e-6;
    return vals.map((v) => Math.max(0, Math.min(1, (v - lo) / Math.max(1e-6, hi - lo))));
  };
  const e = scale(raw.map((r) => r.energy));
  const bs = scale(raw.map((r) => r.bass));
  const bu = scale(raw.map((r) => r.busy));
  return { name, duration: buffer.duration, bpm, offset, bars: raw.map((_, i) => ({ energy: e[i], bass: bs[i], busy: bu[i] })) };
}

/** The aesthetic of a stretch, from how loud it is. */
function themeFor(energy: number, base: ThemeId): ThemeId {
  if (energy < 0.25) return "liminal";
  if (energy < 0.5) return base;
  if (energy < 0.75) return "vapor";
  return "cyberpunk";
}

/**
 * Draw the circuit of a song. The lap is a long oval sized so that race pace
 * gets round it in the time the song lasts; the song is written onto it bar
 * by bar as bends to one side and the other (busier and louder, further out),
 * as hills (the bass), as floating stretches (the choruses), as jumps (the
 * drops) and as second roads beside the quiet passages that fall on a
 * straight. Deterministic: the same features always give the same circuit,
 * which lets every machine in a network race build it for itself.
 */
export function rhythmTrack(song: SongFeatures, base: ThemeId = "frutiger"): TrackDef {
  const bars = song.bars;
  const n = bars.length;
  const barSec = (60 / song.bpm) * 4;
  const barLen = barSec * PACE;
  const L = Math.max(1600, 60 + n * barLen);
  // stadium: two straights and two half circles
  const R = Math.max(150, L * 0.1);
  const S = (L - 2 * Math.PI * R) / 2;
  const at = (d: number): [number, number, number, number] => {
    // position and the unit normal pointing out of the oval at distance d along it
    const u = ((d % L) + L) % L;
    if (u < S) return [0, u, 1, 0];
    if (u < S + Math.PI * R) {
      const a = (u - S) / R;
      return [-R + R * Math.cos(a), S + R * Math.sin(a), Math.cos(a), Math.sin(a)];
    }
    if (u < 2 * S + Math.PI * R) return [-2 * R, S - (u - S - Math.PI * R), -1, 0];
    const a = (u - 2 * S - Math.PI * R) / R;
    return [-R - R * Math.cos(a), -R * Math.sin(a), -Math.cos(a), -Math.sin(a)];
  };
  const onStraight = (d0: number, d1: number) => (d0 >= 0 && d1 <= S) || (d0 >= S + Math.PI * R && d1 <= 2 * S + Math.PI * R);

  // how far out each bar bends: never tighter than a radius of about 70
  const reach = Math.min(70, (2 * barLen) ** 2 / (8 * 70));
  const bend = bars.map((b, i) => {
    if (i < 2 || i >= n - 1) return 0;
    const calm = b.energy < 0.3 && b.busy < 0.4;
    return calm ? 0 : (i % 2 ? 1 : -1) * reach * (0.35 + 0.65 * (b.busy * 0.6 + b.energy * 0.4));
  });
  // the ground follows the bass, smoothed over three bars
  const lift = bars.map((_, i) => {
    let s = 0;
    let c = 0;
    for (let k = i - 1; k <= i + 1; k++) if (k >= 0 && k < n) (s += bars[k].bass), c++;
    return i < 2 ? 0 : (s / c) * 18;
  });

  const routes: RouteSpec[] = [];
  const pads: [string, PadDef["kind"], number?, number?][] = [["go", "boost"]];
  const zones: [string, string, "mag"][] = [];
  const sectors: [string, ThemeId][] = [];
  let lastTheme: ThemeId = base;
  bars.forEach((b, i) => {
    const theme = themeFor(b.energy, base);
    if (theme !== lastTheme && i > 1) sectors.push([`b${i}`, theme]);
    lastTheme = theme;
    const prev = i > 0 ? bars[i - 1].energy : 0;
    if (i > 2 && b.energy - prev > 0.35) pads.push([`b${i}`, "jump", 11]);
    else if (i > 1 && b.busy > 0.7) pads.push([`b${i}`, "boost", 1.3]);
  });
  // a long chorus floats: four loud bars or more in a row
  let run = 0;
  for (let i = 0; i <= n; i++) {
    if (i < n && bars[i].energy > 0.72 && i > 2) run++;
    else {
      if (run >= 4) zones.push([`b${i - run}`, `b${i - 1}e`, "mag"]);
      run = 0;
    }
  }
  // quiet passages on a straight get a road beside them, alternately over and under
  let calmFrom = -1;
  let side = 0;
  const calmEnds: number[][] = [];
  for (let i = 2; i <= n - 1; i++) {
    const calm = i < n - 1 && bend[i] === 0;
    if (calm && calmFrom < 0) calmFrom = i;
    if (!calm && calmFrom >= 0) {
      calmEnds.push([calmFrom, i]);
      calmFrom = -1;
    }
  }
  const routeMarks = new Map<number, string>();
  for (const [a, e] of calmEnds) {
    const d0 = 60 + a * barLen;
    const d1 = 60 + e * barLen;
    if (d1 - d0 < BYPASS + 140 || !onStraight(d0, d1)) continue;
    const high = side++ % 2 === 0;
    const runLen = d1 - d0 - BYPASS;
    routeMarks.set(a, `q${a}a`);
    routeMarks.set(e, `q${a}b`);
    routes.push({ from: `q${a}a`, to: `q${a}b`, draw: (rt) => rt.bypass(high ? "L" : "R", runLen, high ? 9 : -5, lift[e] - lift[a]), kind: high ? "high" : "low", tunnel: !high, pads: [["mid", "boost", 1.4]] });
  }

  const draw = (t: Turtle) => {
    t.go(40).mark("go").go(20);
    let d = 60;
    const step = 18;
    let y = 10;
    for (let i = 0; i < n; i++) {
      t.mark(`b${i}`);
      const qa = routeMarks.get(i);
      if (qa) t.mark(qa);
      const end = 60 + (i + 1) * barLen;
      const b0 = bend[i];
      // each bar is one swell: out to its side and back to the line by the end of it
      while (d < end - 1e-6) {
        const nd = Math.min(end, d + step);
        const f = (nd - (60 + i * barLen)) / barLen;
        const off = b0 * Math.sin(Math.PI * f);
        const [x, z, nx, nz] = at(nd);
        const tx = x + nx * off;
        const tz = z + nz * off;
        const ty = 10 + lift[i] * (1 - f) + (lift[Math.min(n - 1, i + 1)]) * f;
        t.h = Math.atan2(tx - t.x, tz - t.z);
        t.go(Math.hypot(tx - t.x, tz - t.z), ty - y);
        y = ty;
        d = nd;
      }
      t.mark(`b${i}e`);
    }
    // home along the oval to the line
    while (d < L - 1e-6) {
      const nd = Math.min(L, d + step);
      const [x, z] = at(nd);
      const ty = y + (10 - y) * ((nd - d) / Math.max(1, L - d));
      t.h = Math.atan2(x - t.x, z - t.z);
      t.go(Math.hypot(x - t.x, z - t.z), ty - y);
      y = ty;
      d = nd;
    }
  };

  return design({
    id: RHYTHM_TRACK_ID,
    theme: base,
    difficulty: 2,
    start: [0, 10, 0, 0],
    hazards: 2,
    warp: false,
    draw,
    routes,
    zones,
    sectors: dedupe(sectors),
    pads,
    traffic: 2,
  });
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
export const songLapLength = (song: SongFeatures) => song.duration * PACE;

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
