import type { ThemeId } from "./data";

// ---------------------------------------------------------------------------
// Songs that come with the game, for rhythm mode without a file of your own.
// None of them is a recording: each is a recipe (tempo, key, sounds and the
// shape of the song, section by section) that is played once into an
// offline audio context, a few seconds' work, and then goes through rhythm
// mode exactly like a song the player brought: listened to, turned into a
// circuit, raced. The shape is what makes the circuit: a quiet intro is a
// long straight, a build winds, a drop jumps and floats.
// ---------------------------------------------------------------------------

type Wave = OscillatorType;

/** How a section of a song is played: 0 barely there .. 3 everything at once. */
interface Part {
  bars: number;
  level: 0 | 1 | 2 | 3;
  /** a snare roll and a rising sweep into the next section */
  build?: boolean;
}

export interface SongRecipe {
  id: string;
  name: string;
  bpm: number;
  /** semitones above A2 */
  key: number;
  minor: boolean;
  lead: Wave;
  arp: Wave;
  bass: Wave;
  /** 0 straight .. 0.2 a lot of swing */
  swing: number;
  /** extra notes on the hats and the arpeggio: chiptune, nightcore */
  rapid?: boolean;
  /** chords as scale degrees, one per bar */
  chords: number[];
  parts: Part[];
  /** the aesthetic the circuit starts in */
  theme: ThemeId;
}

const P = (bars: number, level: Part["level"], build = false): Part => ({ bars, level, build });
const SHAPE = [P(4, 0), P(8, 1), P(4, 2, true), P(8, 3), P(4, 1), P(8, 2), P(4, 2, true), P(8, 3), P(4, 0)];

export const SONGBOOK: SongRecipe[] = [
  { id: "burbujas", name: "Burbujas al sol", bpm: 124, key: 3, minor: false, lead: "triangle", arp: "square", bass: "sine", swing: 0.04, chords: [0, 4, 5, 3], parts: SHAPE, theme: "frutiger" },
  { id: "neon", name: "Neón de medianoche", bpm: 102, key: 5, minor: true, lead: "sawtooth", arp: "triangle", bass: "sawtooth", swing: 0.08, chords: [0, 5, 2, 6], parts: [P(4, 0), P(8, 1), P(8, 2, true), P(8, 3), P(4, 1), P(8, 3), P(4, 0)], theme: "vapor" },
  { id: "tormenta", name: "Turbo tormenta", bpm: 140, key: 0, minor: true, lead: "square", arp: "sawtooth", bass: "square", swing: 0, chords: [0, 5, 6, 4], parts: [...SHAPE, P(8, 3)], theme: "cyberpunk" },
  { id: "nivelcero", name: "Nivel cero", bpm: 92, key: 1, minor: true, lead: "sine", arp: "triangle", bass: "triangle", swing: 0, chords: [0, 0, 1, 0], parts: [P(8, 0), P(8, 1), P(4, 2, true), P(8, 2), P(8, 0), P(8, 3), P(4, 0)], theme: "backrooms" },
  { id: "caramelo", name: "Caramelo glitch", bpm: 150, key: 7, minor: false, lead: "square", arp: "square", bass: "triangle", swing: 0, rapid: true, chords: [0, 3, 4, 4], parts: [...SHAPE, P(8, 3)], theme: "kidcore" },
  { id: "peluche", name: "Peluche nocturno", bpm: 168, key: 9, minor: true, lead: "sawtooth", arp: "square", bass: "sawtooth", swing: 0, rapid: true, chords: [5, 3, 0, 4], parts: [P(4, 0), P(8, 1), P(4, 2, true), P(12, 3), P(4, 1), P(8, 2), P(4, 2, true), P(12, 3), P(4, 0)], theme: "nightcore" },
];

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

/** Length of a recipe in seconds. */
export const recipeLength = (r: SongRecipe) => (r.parts.reduce((a, p) => a + p.bars, 0) * 4 * 60) / r.bpm + 2;

/** A filter of the classic kind, for the drums: band-pass or high-pass at a frequency. */
class Biquad {
  b0 = 0; b1 = 0; b2 = 0; a1 = 0; a2 = 0;
  x1 = 0; x2 = 0; y1 = 0; y2 = 0;
  set(type: "bandpass" | "highpass", freq: number, q: number, rate: number) {
    const w = (2 * Math.PI * Math.min(freq, rate * 0.45)) / rate;
    const alpha = Math.sin(w) / (2 * q);
    const cos = Math.cos(w);
    const a0 = 1 + alpha;
    if (type === "bandpass") {
      this.b0 = alpha / a0; this.b1 = 0; this.b2 = -alpha / a0;
    } else {
      this.b0 = (1 + cos) / 2 / a0; this.b1 = -(1 + cos) / a0; this.b2 = (1 + cos) / 2 / a0;
    }
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }
  run(x: number) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/**
 * Play a recipe, sample by sample, into a plain array: a few oscillators, a
 * kick, filtered noise for the snare, hats and sweeps, and a soft limiter at
 * the end. Nothing is random: the same recipe always gives the same song, so
 * two players in a network race hear the same thing.
 */
export function synthRecipe(r: SongRecipe, rate = 22050): Float32Array<ArrayBuffer> {
  const total = recipeLength(r);
  const out = new Float32Array(Math.ceil(total * rate));
  let noiseSeed = 12345;
  const noise = () => {
    noiseSeed = (noiseSeed * 1103515245 + 12345) & 0x7fffffff;
    return (noiseSeed / 0x7fffffff) * 2 - 1;
  };
  let seed = 7;
  for (const ch of r.id) seed = (seed * 31 + ch.charCodeAt(0)) % 1000003;
  const rand = (k: number) => {
    const v = Math.sin(seed * 0.0137 + k * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };

  const scale = r.minor ? MINOR : MAJOR;
  const root = 110 * Math.pow(2, r.key / 12);
  const degree = (d: number, octave = 0) => {
    const o = Math.floor(d / 7);
    return root * Math.pow(2, o + octave + scale[((d % 7) + 7) % 7] / 12);
  };
  const wave = (type: Wave, p: number) =>
    type === "sine" ? Math.sin(p * 2 * Math.PI) : type === "square" ? (p < 0.5 ? 0.7 : -0.7) : type === "sawtooth" ? (2 * p - 1) * 0.8 : 1 - 4 * Math.abs(p - 0.5);

  /** a note: rises over `attack`, then dies away to nothing by `len` */
  const note = (freq: number, at: number, len: number, type: Wave, vol: number, attack = 0.005) => {
    const i0 = Math.floor(at * rate);
    const n = Math.min(out.length - i0, Math.floor(len * rate));
    const na = Math.max(1, Math.floor(attack * rate));
    const fall = Math.log(0.0001) / Math.max(1, n - na);
    let p = 0;
    const dp = freq / rate;
    for (let k = 0; k < n; k++) {
      const env = k < na ? k / na : Math.exp(fall * (k - na));
      out[i0 + k] += wave(type, p) * vol * env;
      p += dp;
      if (p >= 1) p -= 1;
    }
  };
  const kick = (at: number, vol: number) => {
    const i0 = Math.floor(at * rate);
    const n = Math.min(out.length - i0, Math.floor(0.24 * rate));
    let p = 0;
    for (let k = 0; k < n; k++) {
      const t = k / rate;
      const f = 42 + (160 - 42) * Math.exp(-t / 0.035);
      p += f / rate;
      out[i0 + k] += Math.sin(p * 2 * Math.PI) * vol * Math.exp(-t / 0.06);
    }
  };
  const hit = (at: number, len: number, vol: number, type: "bandpass" | "highpass", freq: number) => {
    const i0 = Math.floor(at * rate);
    const n = Math.min(out.length - i0, Math.floor(len * rate));
    const f = new Biquad();
    f.set(type, freq, type === "bandpass" ? 0.9 : 0.7, rate);
    for (let k = 0; k < n; k++) out[i0 + k] += f.run(noise()) * vol * Math.exp((Math.log(0.0001) * k) / n);
  };
  const sweep = (at: number, len: number) => {
    const i0 = Math.floor(at * rate);
    const n = Math.min(out.length - i0, Math.floor(len * rate));
    const f = new Biquad();
    for (let k = 0; k < n; k++) {
      const u = k / n;
      if (k % 64 === 0) f.set("bandpass", 300 * Math.pow(20, u), 3, rate);
      out[i0 + k] += f.run(noise()) * 0.25 * u * u;
    }
  };

  // a motif of eight steps, made once per song, played over every chord
  const motif = Array.from({ length: 8 }, (_, i) => (rand(40 + i) > 0.35 ? Math.floor(rand(60 + i) * 6) - 1 : null));
  const step = 60 / r.bpm / 4;
  let t = 0.4;
  let bar = 0;
  for (const part of r.parts) {
    for (let b = 0; b < part.bars; b++, bar++) {
      const chord = r.chords[bar % r.chords.length];
      const last = b === part.bars - 1;
      const lastTwo = b >= part.bars - 2;
      const L = part.level;
      // a long pad under everything, louder the busier the section
      for (const d of [0, 2, 4]) note(degree(chord + d, 0), t, step * 16, "triangle", 0.025 + L * 0.008, 0.25);
      for (let i = 0; i < 16; i++) {
        const at = t + i * step + (i % 2 ? r.swing * step : 0);
        // drums
        if (L >= 1 && (i % 4 === 0 || (L === 3 && i === 14))) kick(at, L === 1 ? 0.5 : 0.85);
        if (L === 0 && i === 0 && b % 2 === 0) kick(at, 0.35);
        if (L >= 1 && (i === 4 || i === 12)) hit(at, 0.16, 0.5, "bandpass", 1800);
        if (part.build && lastTwo && (last || i % 2 === 0)) hit(at, 0.08, 0.2 + (i / 16) * 0.3, "bandpass", 2200);
        if (L >= 2 && (i % 2 === 0 || r.rapid)) hit(at, 0.04, i % 4 === 2 ? 0.3 : 0.16, "highpass", 7000);
        // bass
        if (L >= 1 && (i % 4 === 0 || (L >= 2 && i % 4 === 3))) note(degree(chord, -1), at, step * 1.6, r.bass, 0.22 + L * 0.03);
        // arpeggio
        if (L >= 1 && (i % 2 === 1 || r.rapid || L === 3)) {
          const pick = [0, 2, 4, 7, 4, 2, 0, 4][(i + bar) % 8];
          note(degree(chord + pick, 1), at, step * 0.9, r.arp, 0.03 + (L === 3 ? 0.015 : 0));
        }
        // the motif, in the louder sections, an octave up in the drops
        const m = motif[i % 8];
        if (L >= 2 && m !== null && i % 2 === 0) note(degree(chord + m + 2, L === 3 ? 2 : 1), at, step * 1.8, r.lead, L === 3 ? 0.06 : 0.04);
        // a bell now and then in the quiet bits
        if (L === 0 && i % 8 === 4 && rand(bar * 16 + i) > 0.4) note(degree(chord + 4, 2), at, 1.2, "sine", 0.05, 0.01);
      }
      if (part.build && last) sweep(t, step * 16);
      // a crash on the first beat of a loud section
      if (b === 0 && L === 3) hit(t, 1.2, 0.35, "highpass", 4000);
      t += step * 16;
    }
  }
  // a soft limiter, then bring the loudest moment to just under full scale
  let peak = 0;
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.tanh(out[i] * 1.2);
    peak = Math.max(peak, Math.abs(out[i]));
  }
  const gain = peak > 0 ? 0.9 / peak : 1;
  for (let i = 0; i < out.length; i++) out[i] *= gain;
  return out;
}

/** A recipe as a recording the game's audio can play. */
export async function renderRecipe(r: SongRecipe, rate = 22050): Promise<AudioBuffer> {
  // let the button show that it is working before the arithmetic starts
  await new Promise((done) => setTimeout(done, 30));
  const data = synthRecipe(r, rate);
  const buffer = new AudioBuffer({ length: data.length, sampleRate: rate, numberOfChannels: 1 });
  buffer.copyToChannel(data, 0);
  return buffer;
}

/** A recording as a WAV file, so a built-in song can be sent to the other players like any other. */
export function toWav(buffer: AudioBuffer): ArrayBuffer {
  const data = buffer.getChannelData(0);
  const rate = buffer.sampleRate;
  const out = new ArrayBuffer(44 + data.length * 2);
  const v = new DataView(out);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + data.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 0x7fff, true);
  return out;
}
