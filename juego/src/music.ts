import { audioContext, soundLevel } from "./sound";

// ---------------------------------------------------------------------------
// Race music, made while it plays. No audio files: a small sequencer writes
// sixteen-step bars over a four-chord loop, with drums, bass, an arpeggio and
// now and then a melody, all with the Web Audio API. Every circuit gets its
// own tune from its name, in the manner of its aesthetic; the last lap plays
// harder. When the real soundtrack arrives it can replace this behind the
// same three calls: startMusic, setMusicIntensity, stopMusic.
// ---------------------------------------------------------------------------

export type MusicStyle = "aero" | "synth" | "drive" | "eerie";

const STYLE_OF: Record<string, MusicStyle> = {
  frutiger: "aero", aero: "aero", eco: "aero", eden: "aero", aqua: "aero", liquid: "aero", mac: "aero", slime: "aero", dreamcore: "aero", liminal: "aero",
  vapor: "synth", sunset: "synth", y2k: "synth", webcore: "synth", win98: "synth",
  techno: "drive", cyberpunk: "drive", metro: "drive", arch: "drive", tux: "drive", debian: "drive", noir: "drive",
  backrooms: "eerie", level1: "eerie", traumacore: "eerie",
  kidcore: "aero", cottagecore: "aero", aurora: "aero", levelfun: "synth", weirdcore: "synth",
  glitchcore: "drive", nightcore: "drive",
};

export function styleFor(themeId: string): MusicStyle {
  return STYLE_OF[themeId] ?? "aero";
}

interface Style {
  bpm: number;
  /** semitones of the scale above the root */
  scale: number[];
  /** chord roots as scale degrees, one per bar */
  chords: number[][];
  lead: OscillatorType;
  arp: OscillatorType;
  bass: OscillatorType;
  kick: number[];
  snare: number[];
  swing: number;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const STYLES: Record<MusicStyle, Style> = {
  // bright and bubbly: major, I–V–vi–IV and friends
  aero: { bpm: 122, scale: MAJOR, chords: [[0, 4, 5, 3], [0, 5, 3, 4], [3, 4, 0, 5]], lead: "triangle", arp: "square", bass: "sine", kick: [0, 8], snare: [4, 12], swing: 0.04 },
  // night drive in pastel: minor sevenths, slower, a wide saw
  synth: { bpm: 104, scale: MINOR, chords: [[0, 5, 2, 6], [0, 3, 5, 4], [5, 3, 0, 6]], lead: "sawtooth", arp: "triangle", bass: "sawtooth", kick: [0, 6, 8], snare: [4, 12], swing: 0.08 },
  // four on the floor
  drive: { bpm: 134, scale: MINOR, chords: [[0, 5, 6, 4], [0, 0, 5, 6], [0, 3, 4, 4]], lead: "square", arp: "sawtooth", bass: "square", kick: [0, 4, 8, 12], snare: [4, 12], swing: 0 },
  // the hum of the lights, and something a long way off
  eerie: { bpm: 76, scale: [0, 1, 3, 6, 7, 8, 11], chords: [[0, 0, 1, 0], [0, 3, 0, 1]], lead: "sine", arp: "sine", bass: "triangle", kick: [0], snare: [], swing: 0 },
};

let master: GainNode | null = null;
let timer: number | null = null;
let noise: AudioBuffer | null = null;
let style: Style = STYLES.aero;
let styleName: MusicStyle = "aero";
let seed = 1;
let progression: number[] = [0, 4, 5, 3];
let rootHz = 220;
let step = 0;
let nextAt = 0;
let intensity = 0.5;
let paused = false;
let level = 0.5;

/** How loud the music is, 0..1, on top of the master volume. */
export function setMusicLevel(v: number) {
  level = Math.max(0, Math.min(1, v));
}

/** 0 calm .. 1 flat out: the last lap plays harder. */
export function setMusicIntensity(v: number) {
  intensity = Math.max(0, Math.min(1, v));
}

let song: AudioBuffer | null = null;
let songId = "";
let songSrc: AudioBufferSourceNode | null = null;
let songStart = 0;
let songBeat = 0.5;
let songOffset = 0;

/** The player's own song, played instead of the generated music on the circuit made from it. */
export function setSong(buffer: AudioBuffer | null, trackId = "", bpm = 120, offset = 0) {
  song = buffer;
  songId = trackId;
  songBeat = 60 / bpm;
  songOffset = offset;
}

/** Where the song is: seconds in, and how far through the current beat (0..1). Null when no song plays. */
export function songClock(): { time: number; beat: number } | null {
  const c = audioContext();
  if (!c || !songSrc) return null;
  const time = c.currentTime - songStart;
  const b = (time - songOffset) / songBeat;
  return { time, beat: b - Math.floor(b) };
}

export function setMusicPaused(p: boolean) {
  // a song is a recording: it has to stop where it is, not just go quiet
  if (songSrc && p !== paused) {
    const c = audioContext();
    if (c) {
      if (p) c.suspend().catch(() => {});
      else c.resume().catch(() => {});
    }
  }
  paused = p;
}

const rand = (k: number) => {
  const v = Math.sin(seed * 0.0137 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

export function startMusic(which: MusicStyle, name: string) {
  stopMusic();
  const c = audioContext();
  if (!c) return;
  styleName = which;
  style = STYLES[which];
  seed = 1;
  for (const ch of name) seed = (seed * 31 + ch.charCodeAt(0)) % 1000003;
  progression = style.chords[Math.floor(rand(1) * style.chords.length)];
  // a key of its own: somewhere between A2 and E3
  rootHz = 110 * Math.pow(2, Math.floor(rand(2) * 8) / 12);
  if (!noise) {
    noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  master = c.createGain();
  master.gain.value = 0;
  master.connect(c.destination);
  if (song && name === songId) {
    songSrc = c.createBufferSource();
    songSrc.buffer = song;
    songSrc.connect(master);
    songStart = c.currentTime + 0.05;
    songSrc.start(songStart);
  }
  step = 0;
  nextAt = c.currentTime + 0.1;
  paused = false;
  timer = window.setInterval(tick, 25);
}

export function stopMusic() {
  if (timer !== null) window.clearInterval(timer);
  timer = null;
  if (songSrc) {
    try {
      songSrc.stop();
    } catch {
      /* already stopped */
    }
    songSrc = null;
    const c = audioContext();
    if (c && c.state === "suspended") c.resume().catch(() => {});
  }
  const m = master;
  master = null;
  const c = audioContext();
  if (m && c) {
    m.gain.setTargetAtTime(0, c.currentTime, 0.15);
    window.setTimeout(() => m.disconnect(), 800);
  }
}

export const musicPlaying = () => timer !== null;

function tick() {
  const c = audioContext();
  if (!c || !master) return;
  // a song is mixed louder than the generated music: it is the whole point of the race
  const target = paused ? 0 : soundLevel() * level * (songSrc ? 1 : 0.5);
  master.gain.setTargetAtTime(target, c.currentTime, 0.12);
  if (songSrc) return;
  const stepLen = 60 / (style.bpm * (1 + intensity * 0.06)) / 4;
  // never fall behind by more than a moment, even after the tab slept
  if (nextAt < c.currentTime - 0.2) nextAt = c.currentTime + 0.05;
  while (nextAt < c.currentTime + 0.14) {
    play(step, nextAt + (step % 2 ? style.swing * stepLen : 0));
    nextAt += stepLen;
    step = (step + 1) % 64;
  }
}

/** Frequency of a scale degree (any integer, octaves wrap) in the current key. */
function degree(d: number, octave = 0) {
  const n = style.scale.length;
  const o = Math.floor(d / n);
  const s = style.scale[((d % n) + n) % n];
  return rootHz * Math.pow(2, o + octave + s / 12);
}

function play(s: number, at: number) {
  const bar = Math.floor(s / 16);
  const i = s % 16;
  const chord = progression[bar % progression.length];
  const hard = intensity > 0.75;

  // drums
  if (style.kick.includes(i) || (hard && i === 14 && styleName !== "eerie")) kick(at);
  if (style.snare.includes(i)) snare(at, 0.5);
  if (styleName !== "eerie" && (i % 2 === 0 || hard)) hat(at, i % 4 === 2 ? 0.35 : 0.18);

  // bass: the root on the beat, the fifth on the off-beat now and then
  if (styleName === "eerie") {
    if (i === 0) note(degree(chord, -1), at, 2.6, style.bass, 0.32, 0.6);
  } else if (i % 4 === 0 || (styleName === "drive" && i % 2 === 0)) {
    note(degree(chord + (i % 8 === 6 && rand(bar * 16 + i) > 0.5 ? 4 : 0), -1), at, 0.18, style.bass, 0.3);
  }

  // arpeggio over the chord, its pattern fixed per circuit
  const pattern = [0, 2, 4, 2, 0, 4, 2, 7];
  const pick = pattern[(i + Math.floor(rand(3) * 8)) % pattern.length];
  if (styleName === "eerie") {
    if (i % 4 === 2 && rand(bar * 7 + i) > 0.45) note(degree(chord + pick, 1), at, 0.6, style.arp, 0.05, 0.3);
  } else if (i % 2 === 1 || styleName === "drive") {
    note(degree(chord + pick, 1), at, 0.09, style.arp, 0.045);
  }

  // a melody on every second pass through the loop, made of the same notes
  if (styleName !== "eerie" && Math.floor(s / 32) % 2 === 1 && (i % 4 === 0 || (i % 2 === 0 && rand(s * 3) > 0.6))) {
    const m = Math.floor(rand(s * 5 + 11) * 5) - 1;
    note(degree(chord + m + 2, 1), at, i % 4 === 0 ? 0.32 : 0.16, style.lead, hard ? 0.06 : 0.045);
  }
}

function note(freq: number, at: number, length: number, type: OscillatorType, volume: number, attack = 0.005) {
  const c = audioContext();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(volume, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  o.connect(g);
  g.connect(master);
  o.start(at);
  o.stop(at + length + 0.05);
}

function kick(at: number) {
  const c = audioContext();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.setValueAtTime(150, at);
  o.frequency.exponentialRampToValueAtTime(42, at + 0.14);
  g.gain.setValueAtTime(0.55, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
  o.connect(g);
  g.connect(master);
  o.start(at);
  o.stop(at + 0.25);
}

function noiseHit(at: number, length: number, volume: number, filter: BiquadFilterType, freq: number) {
  const c = audioContext();
  if (!c || !master || !noise) return;
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(volume, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(at, Math.random() * 0.5);
  src.stop(at + length + 0.02);
}

const snare = (at: number, v: number) => noiseHit(at, 0.16, v * 0.5, "bandpass", 1800);
const hat = (at: number, v: number) => noiseHit(at, 0.04, v * 0.35, "highpass", 7000);
