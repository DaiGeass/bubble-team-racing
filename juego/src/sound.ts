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
}

function tone({ freq, duration, type = "sine", volume = 0.2, freqEnd, delay = 0 }: ToneOpts) {
  const c = getCtx();
  if (!c || useMutedCheck()) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

let mutedGetter: () => boolean = () => false;
export function bindMuteGetter(fn: () => boolean) {
  mutedGetter = fn;
}
function useMutedCheck() {
  try {
    return mutedGetter();
  } catch {
    return false;
  }
}

export const sfx = {
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
