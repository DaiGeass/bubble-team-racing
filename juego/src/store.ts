import type { ModeId, AiSkillId } from "./data";
import { create } from "zustand";
import type { Lang } from "./i18n";
import {
  BODY_COLORS,
  DECAL_COLORS,
  WHEEL_STYLES,
  THEMES,
  TRACKS,
  type WheelStyle,
  type WeaponId,
  type ShapeId,
  type ThemeId,
  type VehicleMode,
  type SpoilerId,
  type BoosterId,
  type BoatId,
  type PlaneId,
  type SubId,
} from "./data";

export type Screen = "start" | "select" | "howto" | "options" | "race" | "results" | "highscores";

export interface HighScoreEntry {
  name: string;
  score: number;
  mode: string;
  character: string;
  theme: ThemeId;
  date: number;
}

export interface Standing {
  id: string;
  name: string;
  isPlayer: boolean;
  progress: number;
  lap: number;
  color: string;
}

export interface Telemetry {
  lap: number;
  totalLaps: number;
  position: number;
  totalRacers: number;
  timeMs: number;
  score: number;
  coins: number;
  rings: number;
  weapon: WeaponId | null;
  speedKph: number;
  tagCooldown: number;
  shieldActive: boolean;
  boosting: boolean;
  finished: boolean;
  standings: Standing[];
  activeIsPartner: boolean;
  countdown: number;
  mode: VehicleMode;
  fuseReady: number; // 0..1 cooldown progress
  fused: boolean;
  fusionHp: number; // 0..1 turret partner health
  turbo: number; // 0..1 drift-charged turbo meter
  shortcutFlash: number; // timestamp of the last alternative-path jump
}

const defaultTelemetry: Telemetry = {
  lap: 1,
  totalLaps: 3,
  position: 1,
  totalRacers: 6,
  timeMs: 0,
  score: 0,
  coins: 0,
  rings: 0,
  weapon: null,
  speedKph: 0,
  tagCooldown: 1,
  shieldActive: false,
  boosting: false,
  finished: false,
  standings: [],
  activeIsPartner: false,
  countdown: 3,
  mode: "land",
  fuseReady: 1,
  fused: false,
  fusionHp: 1,
  turbo: 0,
  shortcutFlash: 0,
};

export interface RaceResult {
  position: number;
  score: number;
  timeMs: number;
  coins: number;
  tagSwaps: number;
  rings: number;
  lapsCompleted: number;
}

export interface VehiclePrefs {
  body: string;
  decal: string;
  wheel: WheelStyle;
  shape: ShapeId;
  spoiler: SpoilerId;
  booster: BoosterId;
  boat: BoatId;
  plane: PlaneId;
  sub: SubId;
  finish: import("./data").FinishId;
}

// ---------------------------------------------------------------------------
// Input remapping: the same action list drives the keyboard binds and the
// on-screen buttons, so anything the HUD can do the player can reassign.
// ---------------------------------------------------------------------------

export type Action = "item" | "drift" | "swap" | "fuse" | "turbo" | "left" | "right" | "gas" | "brake";

export const ACTIONS: Action[] = ["item", "drift", "swap", "fuse", "turbo", "left", "right", "gas", "brake"];

/** Physical slots available to the touch overlay. */
export type TouchSlot = "padL" | "padR" | "drift" | "turbo" | "gas" | "brake" | "swap" | "fuse" | "item";

export const TOUCH_SLOTS: TouchSlot[] = ["padL", "padR", "drift", "turbo", "gas", "brake", "swap", "fuse", "item"];

export const DEFAULT_KEYBINDS: Record<Action, string[]> = {
  item: ["Space"],
  drift: ["ShiftLeft", "ShiftRight"],
  swap: ["KeyQ"],
  fuse: ["KeyF", "KeyE"],
  turbo: ["KeyK", "KeyJ"],
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  gas: ["ArrowUp", "KeyW"],
  brake: ["ArrowDown", "KeyS"],
};

/**
 * The two named layouts offered in Options. Picking one really does move the
 * keys: previously the preset was only saved and the bindings never changed.
 */
export const PRESET_KEYBINDS: Record<"A" | "B", Record<Action, string[]>> = {
  A: DEFAULT_KEYBINDS,
  B: {
    item: ["KeyE"],
    drift: ["Space"],
    swap: ["KeyQ"],
    fuse: ["KeyF"],
    turbo: ["KeyK", "KeyJ"],
    left: ["ArrowLeft", "KeyA"],
    right: ["ArrowRight", "KeyD"],
    gas: ["ArrowUp", "KeyW"],
    brake: ["ArrowDown", "KeyS"],
  },
};

export const DEFAULT_TOUCH: Record<TouchSlot, Action> = {
  padL: "left",
  padR: "right",
  drift: "drift",
  turbo: "turbo",
  gas: "gas",
  brake: "brake",
  swap: "swap",
  fuse: "fuse",
  item: "item",
};

export interface Settings {
  autoGas: boolean;
  steerAssist: boolean;
  bloom: boolean;
  controlPreset: "A" | "B";
  /** how hard the AI pushes */
  aiSkill: AiSkillId;
  /** invert the steering axis */
  invertSteer: boolean;
  /** camera shake 0..1 */
  shake: number;
  /** show the debug telemetry overlay */
  telemetry: boolean;
  /** master-ish volume 0..1 */
  volume: number;
  /** 0 = crisp, 1 = cinematic blur on the fast camera */
  motionBlur: number;
  /** remapped keyboard bindings */
  keybinds: Record<Action, string[]>;
  /** which action each on-screen slot performs */
  touchLayout: Record<TouchSlot, Action>;
  /** 0.8 small .. 1.4 chunky touch buttons */
  touchScale: number;
  /** mirrors the touch overlay for left handed players */
  handed: "right" | "left";
}

interface GameState {
  screen: Screen;
  lang: Lang;
  setLang: (l: Lang) => void;
  modeId: ModeId;
  setMode: (m: ModeId) => void;
  trackId: string;
  setTrackId: (id: string) => void;
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  characterId: string;
  partnerId: string;
  setCharacter: (id: string) => void;
  setPartner: (id: string) => void;
  vehicle: VehiclePrefs;
  setVehicle: (v: Partial<VehiclePrefs>) => void;
  settings: Settings;
  setSettings: (s: Partial<Settings>) => void;
  setKeybinds: (kb: Record<Action, string[]>) => void;
  goto: (s: Screen) => void;
  paused: boolean;
  setPaused: (p: boolean) => void;
  telemetry: Telemetry;
  setTelemetry: (t: Partial<Telemetry>) => void;
  resetTelemetry: () => void;
  raceResult: RaceResult | null;
  setRaceResult: (r: RaceResult | null) => void;
  highScores: HighScoreEntry[];
  addHighScore: (e: HighScoreEntry) => void;
  raceRunId: number;
  restartRace: () => void;
  muted: boolean;
  toggleMuted: () => void;
}

function loadHighScores(): HighScoreEntry[] {
  try {
    const raw = localStorage.getItem("tsc_highscores_v2");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHighScores(list: HighScoreEntry[]) {
  try {
    localStorage.setItem("tsc_highscores_v2", JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function loadPrefs<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as object) } as T;
  } catch {
    return fallback;
  }
}

function savePrefs(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function detectLang(): Lang {
  try {
    const nav = navigator.language?.slice(0, 2);
    const supported = ["es", "en", "he", "ja", "zh", "ar", "fr", "ru"];
    if (nav && supported.includes(nav)) return nav as Lang;
  } catch {
    /* ignore */
  }
  return "en";
}

const defaultVehicle: VehiclePrefs = {
  body: BODY_COLORS[0],
  decal: DECAL_COLORS[0],
  wheel: WHEEL_STYLES[2],
  shape: "kart",
  spoiler: "wing",
  booster: "neon",
  boat: "cat",
  plane: "wing",
  sub: "classic",
} as VehiclePrefs;

// Sensible defaults per device: touch screens get auto-throttle, small screens skip bloom.
const isTouch = typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || (navigator.maxTouchPoints ?? 0) > 0);
const isSmall = typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 700;
const defaultSettings: Settings = {
  autoGas: isTouch,
  steerAssist: true,
  bloom: !isSmall,
  controlPreset: "A",
  aiSkill: "amateur",
  invertSteer: false,
  shake: 1,
  telemetry: true,
  volume: 0.8,
  motionBlur: 0,
  keybinds: DEFAULT_KEYBINDS,
  touchLayout: DEFAULT_TOUCH,
  touchScale: 1,
  handed: "right",
};

export const useGame = create<GameState>((set, get) => ({
  screen: "start",
  lang: detectLang(),
  setLang: (l) => {
    savePrefs("tsc_lang", { lang: l });
    set({ lang: l });
  },
  modeId: "quick",
  setMode: (m) => set({ modeId: m }),
  trackId: TRACKS[0].id,
  setTrackId: (id) => set({ trackId: id }),
  theme: (loadPrefs<{ theme: ThemeId }>("tsc_theme", { theme: "frutiger" }).theme in THEMES
    ? loadPrefs<{ theme: ThemeId }>("tsc_theme", { theme: "frutiger" }).theme
    : "frutiger") as ThemeId,
  setTheme: (t) => {
    savePrefs("tsc_theme", { theme: t });
    set({ theme: t });
  },
  characterId: "nova",
  partnerId: "blip",
  setCharacter: (id) =>
    set((s) => ({ characterId: id, partnerId: s.partnerId === id ? (s.characterId === id ? s.partnerId : s.characterId) : s.partnerId })),
  setPartner: (id) => set({ partnerId: id }),
  vehicle: loadPrefs<VehiclePrefs>("tsc_vehicle", defaultVehicle),
  setVehicle: (v) =>
    set((s) => {
      const next = { ...s.vehicle, ...v };
      savePrefs("tsc_vehicle", next);
      return { vehicle: next };
    }),
  settings: loadPrefs<Settings>("tsc_settings", defaultSettings),
  setSettings: (v) =>
    set((s) => {
      const next = { ...s.settings, ...v };
      // choosing a layout also installs its key bindings
      if (v.controlPreset && v.controlPreset !== s.settings.controlPreset) {
        next.keybinds = PRESET_KEYBINDS[v.controlPreset];
      }
      savePrefs("tsc_settings", next);
      return { settings: next };
    }),
  setKeybinds: (kb) =>
    set((s) => {
      const next = { ...s.settings, keybinds: kb };
      savePrefs("tsc_settings", next);
      return { settings: next };
    }),
  goto: (s) => set({ screen: s }),
  paused: false,
  setPaused: (p) => set({ paused: p }),
  telemetry: defaultTelemetry,
  setTelemetry: (t) => set((s) => ({ telemetry: { ...s.telemetry, ...t } })),
  resetTelemetry: () => set({ telemetry: { ...defaultTelemetry } }),
  raceResult: null,
  setRaceResult: (r) => set({ raceResult: r }),
  highScores: loadHighScores(),
  addHighScore: (e) => {
    const list = [...get().highScores, e].sort((a, b) => b.score - a.score).slice(0, 10);
    saveHighScores(list);
    set({ highScores: list });
  },
  raceRunId: 0,
  restartRace: () => set((s) => ({ raceRunId: s.raceRunId + 1, paused: false })),
  muted: false,
  toggleMuted: () => set((s) => ({ muted: !s.muted })),
}));
