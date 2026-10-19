import {surfaceSoundProfile,landingSound} from "./foley";
import { raceSoundProfile, type RaceSoundState } from "./adrenaline";
// Lightweight procedural SFX using the Web Audio API — no audio files needed.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  return ctx;
}

export function resumeAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

interface ToneOpts {
  freq: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
  freqEnd?: number;
  delay?: number;
  pan?: number;
}

function tone({ freq, duration, type = "sine", volume = 0.2, freqEnd, delay = 0, pan=0 }: ToneOpts) {
  const c = getCtx();
  if (!c || useMutedCheck()) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
  gain.gain.setValueAtTime(volume * masterVolume(), t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain);
  const panner=c.createStereoPanner();panner.pan.value=Math.max(-1,Math.min(1,pan));
  gain.connect(panner);panner.connect(c.destination);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); panner.disconnect(); };
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

let mutedGetter: () => boolean = () => false;
let volumeGetter: () => number = () => 1;
export function bindMuteGetter(fn: () => boolean) {
  mutedGetter = fn;
}
/** master volume slider from the options screen */
export function bindVolumeGetter(fn: () => number) {
  volumeGetter = fn;
}
function masterVolume() {
  try {
    const v = volumeGetter();
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
  } catch {
    return 1;
  }
}
function useMutedCheck() {
  try {
    return mutedGetter();
  } catch {
    return false;
  }
}

export const sfx = {
  combo: (count: number) => tone({freq:440*Math.pow(2,Math.min(8,count)/12),freqEnd:880,duration:0.09,type:"triangle",volume:0.07}),
  pass: (pan=0) => tone({freq:330,freqEnd:990,duration:0.16,type:"sine",volume:0.09,pan}),
  maneuver: () => tone({freq:280,freqEnd:700,duration:0.18,type:"triangle",volume:0.07}),
  landing: (impact:number,water:boolean) => {const p=landingSound(impact,water);if(p.volume>0)tone({...p,freqEnd:45,type:water?"triangle":"sine"});},
  cleanLanding: () => {
    tone({ freq: 660, freqEnd: 880, duration: 0.11, type: "triangle", volume: 0.12 });
    tone({ freq: 990, duration: 0.14, type: "sine", volume: 0.10, delay: 0.06 });
  },
  coin: () => tone({ freq: 880, freqEnd: 1320, duration: 0.12, type: "triangle", volume: 0.18 }),
  item: () => tone({ freq: 440, freqEnd: 900, duration: 0.18, type: "square", volume: 0.15 }),
  boost: () => {
    tone({ freq: 220, freqEnd: 60, duration: 0.3, type: "sawtooth", volume: 0.22 });
    tone({ freq: 660, freqEnd: 1000, duration: 0.2, type: "sine", volume: 0.15, delay: 0.02 });
  },
  hit: () => tone({ freq: 160, freqEnd: 40, duration: 0.25, type: "sawtooth", volume: 0.25 }),
  swap: () => {
    tone({ freq: 500, freqEnd: 900, duration: 0.15, type: "sine", volume: 0.2 });
    tone({ freq: 700, freqEnd: 1200, duration: 0.15, type: "sine", volume: 0.15, delay: 0.08 });
  },
  countdown: () => tone({ freq: 500, duration: 0.15, type: "square", volume: 0.2 }),
  go: () => {
    tone({ freq: 500, freqEnd: 1000, duration: 0.3, type: "square", volume: 0.25 });
    tone({ freq: 900, freqEnd: 1400, duration: 0.3, type: "square", volume: 0.2, delay: 0.1 });
  },
  finish: () => {
    [0, 0.12, 0.24, 0.4].forEach((d, i) => tone({ freq: 523 + i * 120, duration: 0.3, type: "triangle", volume: 0.2, delay: d }));
  },
  click: () => tone({ freq: 700, duration: 0.07, type: "sine", volume: 0.12 }),
  bump: () => tone({ freq: 120, freqEnd: 60, duration: 0.15, type: "sawtooth", volume: 0.18 }),
};

let skidGain: GainNode | null = null;
/** Tyre screech: filtered noise that runs for as long as a drift does. 0 is silence. */
export function setSkid(level: number) {
  const c = getCtx();
  if (!c) return;
  if (!skidGain) {
    if (level <= 0) return;
    const buffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const band = c.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 2300;
    band.Q.value = 5;
    skidGain = c.createGain();
    skidGain.gain.value = 0;
    src.connect(band);
    band.connect(skidGain);
    skidGain.connect(c.destination);
    src.start();
  }
  const target = useMutedCheck() ? 0 : Math.max(0, level) * 0.11 * masterVolume();
  skidGain.gain.setTargetAtTime(target, c.currentTime, 0.06);
}

type RaceMix = {engine:OscillatorNode;engineGain:GainNode;wind:GainNode;bass:OscillatorNode;bassGain:GainNode;lead:OscillatorNode;leadGain:GainNode;kick:OscillatorNode;kickGain:GainNode;surface:GainNode;surfaceFilter:BiquadFilterNode;step:number};
let raceMix: RaceMix | null = null;
function smooth(param: AudioParam, value: number, now: number, lag=0.04) {
  param.cancelScheduledValues(now);
  param.setTargetAtTime(value,now,lag);
}
/** Fixed voice pool, driven by race time; no timers, downloads or per-beat nodes. */
export function setRaceSound(state: RaceSoundState | null) {
  if (!state) {
    if (raceMix && ctx) for (const gain of [raceMix.engineGain,raceMix.wind,raceMix.bassGain,raceMix.leadGain,raceMix.kickGain,raceMix.surface]) smooth(gain.gain,0,ctx.currentTime,0.015);
    return;
  }
  const c=getCtx();if (!c || c.state!=="running") return;
  if (!raceMix) {
    const voice=(type:OscillatorType)=>{
      const osc=c.createOscillator(),gain=c.createGain();osc.type=type;gain.gain.value=0;
      osc.connect(gain);gain.connect(c.destination);osc.start();return {osc,gain};
    };
    const engine=voice("triangle"),bass=voice("sine"),lead=voice("triangle"),kick=voice("sine");
    const buffer=c.createBuffer(1,c.sampleRate,c.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    const source=c.createBufferSource(),filter=c.createBiquadFilter(),wind=c.createGain();
    source.buffer=buffer;source.loop=true;filter.type="lowpass";filter.frequency.value=1400;wind.gain.value=0;
    source.connect(filter);filter.connect(wind);wind.connect(c.destination);
    const surface=c.createGain(),surfaceFilter=c.createBiquadFilter();surface.gain.value=0;surfaceFilter.type="bandpass";
    source.connect(surfaceFilter);surfaceFilter.connect(surface);surface.connect(c.destination);source.start();
    raceMix={engine:engine.osc,engineGain:engine.gain,wind,bass:bass.osc,bassGain:bass.gain,lead:lead.osc,leadGain:lead.gain,kick:kick.osc,kickGain:kick.gain,surface,surfaceFilter,step:-1};
  }
  const mix=raceMix,profile=raceSoundProfile(state),now=c.currentTime,volume=useMutedCheck()?0:masterVolume();
  smooth(mix.engine.frequency,profile.engine,now,0.08);
  smooth(mix.engineGain.gain,profile.engineGain*volume,now);
  smooth(mix.wind.gain,profile.wind*volume,now,0.12);
  const contact=state.surface?surfaceSoundProfile(state.surface):{frequency:1000,gain:0,q:0.7};
  smooth(mix.surface.gain,contact.gain*volume,now,0.08);smooth(mix.surfaceFilter.frequency,contact.frequency,now,0.1);smooth(mix.surfaceFilter.Q,contact.q,now);
  // Rhythmic envelopes come from simulation time: pausing cannot advance a song.
  const phase=profile.beat%1,half=(profile.beat*2)%1;
  smooth(mix.bassGain.gain,0.027*Math.exp(-phase*5)*volume,now,0.01);
  smooth(mix.leadGain.gain,profile.leadGain*Math.exp(-half*6)*volume,now,0.01);
  smooth(mix.kickGain.gain,(state.final?0.045:0.025)*Math.exp(-phase*14)*volume,now,0.008);
  smooth(mix.kick.frequency,45+65*Math.exp(-phase*20),now,0.008);
  if (profile.step!==mix.step) {
    mix.step=profile.step;
    smooth(mix.bass.frequency,profile.bass,now,0.015);
    const notes=[1,1.5,2,1.25,1.5,2,2.5,2];
    smooth(mix.lead.frequency,profile.bass*4*notes[profile.step%notes.length],now,0.015);
  }
}
