// ---------------------------------------------------------------------------
// Core game data: characters, aesthetics, tracks, vehicle parts, weapons
// ---------------------------------------------------------------------------

// Frutiger Aero life-forms instead of animals: glossy droplets, bubbles, crystals...
export type FormId = "drop" | "bubble" | "leaf" | "crystal" | "holo" | "cloud" | "star" | "flame";
export type EyeStyle = "sparkle" | "sharp" | "visor" | "sleepy";
export type RoleId = "speed" | "handler" | "heavy" | "balanced" | "trickster" | "tech";
export type WeaponId =
  | "orb" | "missile" | "bubble" | "slime" | "beam" | "zap" | "mine" | "wave"
  | "swap" | "magnet" | "ghost" | "quake";
export type ShapeId =
  | "kart" | "hover" | "buggy" | "jet" | "cruiser" | "moto" | "ufo"
  | "coupe" | "van" | "formula" | "bubble" | "rocket" | "mono"
  | "tank" | "wedge" | "sled" | "orbit" | "dune" | "phantom";
export type ThemeId =
  | "frutiger" | "aero" | "techno" | "eco" | "aqua" | "sunset"
  | "y2k" | "liquid" | "win98" | "vapor";
export type WheelStyle = "classic" | "sporty" | "glow" | "chrome" | "spike";
export type SpoilerId = "none" | "wing" | "fin";
export type BoosterId = "single" | "twin" | "neon";
export type BoatId = "cat" | "speed" | "ski" | "yacht";
export type PlaneId = "wing" | "bi" | "delta" | "stealth";
export type SubId = "classic" | "pod" | "shark" | "diver";
export type VehicleMode = "land" | "boat" | "plane" | "sub";

export interface CharacterDef {
  id: string;
  name: string;
  form: FormId;
  eye: EyeStyle;
  primary: string;
  secondary: string;
  accent: string;
  speed: number;
  accel: number;
  handling: number;
  weight: number;
  role: RoleId;
  favorite: WeaponId;
}

// ---- color helpers: boost saturation so every racer pops ----
function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const f = (p: number, q: number, tt: number) => {
    let t = tt;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = f(p, q, h + 1 / 3);
    g = f(p, q, h);
    b = f(p, q, h - 1 / 3);
  }
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function vivid(hex: string, minL: number, maxL: number): string {
  const [h, s, l] = hexToHsl(hex);
  if (s < 0.22 || l > 0.9) return hex;
  return hslToHex(h, Math.min(1, s * 1.1 + 0.14), Math.min(maxL, Math.max(minL, l)));
}

const RAW_CHARACTERS: CharacterDef[] = [
  { id: "nova", name: "NOVA", form: "drop", eye: "sparkle", primary: "#22d3ee", secondary: "#e0fbff", accent: "#0e7490", speed: 3, accel: 4, handling: 4, weight: 2, role: "balanced", favorite: "orb" },
  { id: "blip", name: "BLIP", form: "star", eye: "sharp", primary: "#fde047", secondary: "#fffbe6", accent: "#f59e0b", speed: 5, accel: 5, handling: 2, weight: 1, role: "speed", favorite: "missile" },
  { id: "mochi", name: "MOCHI", form: "bubble", eye: "sparkle", primary: "#f9a8d4", secondary: "#fff0f7", accent: "#db2777", speed: 2, accel: 5, handling: 4, weight: 1, role: "trickster", favorite: "slime" },
  { id: "kori", name: "KORI", form: "crystal", eye: "sharp", primary: "#a5b4fc", secondary: "#eef2ff", accent: "#4f46e5", speed: 4, accel: 3, handling: 3, weight: 2, role: "speed", favorite: "beam" },
  { id: "zepp", name: "ZEPP", form: "leaf", eye: "sleepy", primary: "#4ade80", secondary: "#eaffef", accent: "#15803d", speed: 2, accel: 3, handling: 5, weight: 3, role: "handler", favorite: "bubble" },
  { id: "pixl", name: "PIXL", form: "holo", eye: "visor", primary: "#c084fc", secondary: "#f5e8ff", accent: "#7e22ce", speed: 4, accel: 4, handling: 3, weight: 2, role: "tech", favorite: "missile" },
  { id: "fizz", name: "FIZZ", form: "bubble", eye: "sparkle", primary: "#38bdf8", secondary: "#e6f7ff", accent: "#0369a1", speed: 3, accel: 4, handling: 4, weight: 2, role: "balanced", favorite: "bubble" },
  { id: "brum", name: "BRUM", form: "flame", eye: "sleepy", primary: "#fb923c", secondary: "#ffedd5", accent: "#9a3412", speed: 4, accel: 2, handling: 2, weight: 5, role: "heavy", favorite: "slime" },
  { id: "lumo", name: "LUMO", form: "drop", eye: "visor", primary: "#67e8f9", secondary: "#ecfeff", accent: "#0891b2", speed: 3, accel: 3, handling: 5, weight: 1, role: "handler", favorite: "beam" },
  { id: "tiko", name: "TIKO", form: "flame", eye: "sharp", primary: "#f87171", secondary: "#fff1f1", accent: "#b91c1c", speed: 5, accel: 3, handling: 3, weight: 3, role: "speed", favorite: "missile" },
  { id: "sola", name: "SOLA", form: "star", eye: "sparkle", primary: "#fbbf24", secondary: "#fffbeb", accent: "#d97706", speed: 4, accel: 4, handling: 3, weight: 4, role: "trickster", favorite: "orb" },
  { id: "nixe", name: "NIXE", form: "holo", eye: "visor", primary: "#34d399", secondary: "#e8fff7", accent: "#047857", speed: 3, accel: 5, handling: 4, weight: 2, role: "tech", favorite: "beam" },
  { id: "yuki", name: "YUKI", form: "cloud", eye: "sparkle", primary: "#c7e4ff", secondary: "#ffffff", accent: "#3b82f6", speed: 3, accel: 4, handling: 5, weight: 1, role: "handler", favorite: "bubble" },
  { id: "taro", name: "TARO", form: "leaf", eye: "sparkle", primary: "#fdba74", secondary: "#fff7ed", accent: "#c2410c", speed: 3, accel: 3, handling: 3, weight: 3, role: "balanced", favorite: "orb" },
  { id: "vexa", name: "VEXA", form: "crystal", eye: "sharp", primary: "#f472b6", secondary: "#ffe4f3", accent: "#9d174d", speed: 5, accel: 4, handling: 2, weight: 2, role: "tech", favorite: "beam" },
  { id: "rook", name: "ROOK", form: "cloud", eye: "sleepy", primary: "#a78bfa", secondary: "#ede9fe", accent: "#5b21b6", speed: 4, accel: 2, handling: 2, weight: 5, role: "heavy", favorite: "missile" },
  { id: "pepa", name: "PEPA", form: "bubble", eye: "sparkle", primary: "#c4b5fd", secondary: "#f5f3ff", accent: "#7c3aed", speed: 2, accel: 5, handling: 4, weight: 1, role: "trickster", favorite: "wave" },
  { id: "kiko", name: "KIKO", form: "drop", eye: "sparkle", primary: "#5eead4", secondary: "#ecfeff", accent: "#0f766e", speed: 3, accel: 4, handling: 3, weight: 2, role: "balanced", favorite: "zap" },
  { id: "onyx", name: "ONYX", form: "crystal", eye: "visor", primary: "#4f6bff", secondary: "#dbe4ff", accent: "#1e2a8a", speed: 5, accel: 3, handling: 2, weight: 4, role: "speed", favorite: "mine" },
  { id: "pipi", name: "PIPI", form: "star", eye: "sparkle", primary: "#fb7185", secondary: "#ffe4e6", accent: "#e11d48", speed: 4, accel: 5, handling: 2, weight: 1, role: "trickster", favorite: "zap" },
  { id: "aquos", name: "AQUOS", form: "bubble", eye: "visor", primary: "#0ea5e9", secondary: "#e0f2fe", accent: "#075985", speed: 3, accel: 3, handling: 5, weight: 2, role: "handler", favorite: "wave" },
  { id: "ember", name: "EMBER", form: "flame", eye: "sharp", primary: "#f59e0b", secondary: "#fef3c7", accent: "#b45309", speed: 5, accel: 4, handling: 2, weight: 3, role: "speed", favorite: "mine" },
  { id: "mist", name: "MIST", form: "cloud", eye: "sparkle", primary: "#a5f3fc", secondary: "#f0fdff", accent: "#0e7490", speed: 3, accel: 4, handling: 5, weight: 1, role: "handler", favorite: "bubble" },
  { id: "terra", name: "TERRA", form: "leaf", eye: "sharp", primary: "#84cc16", secondary: "#f7fee7", accent: "#4d7c0f", speed: 4, accel: 3, handling: 3, weight: 4, role: "heavy", favorite: "slime" },
  { id: "prism", name: "PRISM", form: "holo", eye: "sparkle", primary: "#e879f9", secondary: "#fdf4ff", accent: "#a21caf", speed: 4, accel: 5, handling: 3, weight: 2, role: "tech", favorite: "beam" },
  { id: "cobalt", name: "COBALT", form: "drop", eye: "sharp", primary: "#2b5cff", secondary: "#e7ecff", accent: "#12239c", speed: 4, accel: 4, handling: 3, weight: 3, role: "balanced", favorite: "missile" },
  { id: "kiwi", name: "KIWI", form: "leaf", eye: "sparkle", primary: "#c6ff4f", secondary: "#f7ffe4", accent: "#6da300", speed: 3, accel: 5, handling: 4, weight: 1, role: "trickster", favorite: "slime" },
  { id: "magma", name: "MAGMA", form: "flame", eye: "visor", primary: "#ff2d00", secondary: "#ffe6dc", accent: "#8f1500", speed: 5, accel: 3, handling: 2, weight: 5, role: "heavy", favorite: "zap" },
];

const fixEarColors: Record<string, { primary?: string; secondary?: string; accent?: string }> = {
  yuki: { primary: "#c7e4ff", secondary: "#ffffff", accent: "#3b82f6" },
  rook: { primary: "#a78bfa", secondary: "#ede9fe", accent: "#5b21b6" },
  onyx: { primary: "#4f6bff", secondary: "#dbe4ff", accent: "#1e2a8a" },
  cobalt: { primary: "#2b5cff", secondary: "#e7ecff", accent: "#12239c" },
  magma: { primary: "#ff2d00", secondary: "#ffe6dc", accent: "#8f1500" },
};

export const CHARACTERS: CharacterDef[] = RAW_CHARACTERS.map((c) => {
  const f = fixEarColors[c.id];
  return {
    ...c,
    primary: f?.primary ?? vivid(c.primary, 0.55, 0.66),
    secondary: f?.secondary ?? c.secondary,
    accent: f?.accent ?? vivid(c.accent, 0.3, 0.44),
  };
});

// ---------------------------------------------------------------------------
// Aesthetics (10 worlds)
// ---------------------------------------------------------------------------

export interface ThemeDef {
  id: ThemeId;
  name: string;
  skyTop: string;
  skyBottom: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  water: string;
  ground: string;
  road: string;
  roadLine: string;
  roadEdge: string;
  barrierA: string;
  barrierB: string;
  sun: string;
  sunIntensity: number;
  ambient: number;
  ambientColor: string;
  hemiSky: string;
  hemiGround: string;
  cloud: string;
  isle: string;
  glow: string;
  particles: string[];
  prop: "palm" | "crystal" | "circuit" | "tree" | "coral" | "cactus" | "y2k" | "win98" | "liquid" | "vapor";
  bloom: number;
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  frutiger: {
    id: "frutiger", name: "FRUTIGER AERO", skyTop: "#7fd7ff", skyBottom: "#eafff4", fog: "#cdeeff", fogNear: 80, fogFar: 300,
    water: "#3ec9f2", ground: "#a8ec8b", road: "#eaf4ff", roadLine: "#ffd166", roadEdge: "#ffffff",
    barrierA: "#ff8fbf", barrierB: "#8be9ff", sun: "#fffbe8", sunIntensity: 1.75, ambient: 1.0, ambientColor: "#ffffff",
    hemiSky: "#bfeaff", hemiGround: "#a8ec8b", cloud: "#ffffff", isle: "#7ed957", glow: "#8be9ff",
    particles: ["#ffffff", "#8be9ff", "#ffd166", "#ff8fbf"], prop: "palm", bloom: 0.9,
  },
  eco: {
    id: "eco", name: "FRUTIGER ECO", skyTop: "#8fe0a8", skyBottom: "#f4ffe0", fog: "#dff5cf", fogNear: 80, fogFar: 290,
    water: "#3fae7a", ground: "#6fbf4f", road: "#e6d8b0", roadLine: "#a3d977", roadEdge: "#fff8e1",
    barrierA: "#7ac74f", barrierB: "#ffd166", sun: "#fff6d8", sunIntensity: 1.6, ambient: 0.95, ambientColor: "#fff8e0",
    hemiSky: "#cdeccd", hemiGround: "#6fbf4f", cloud: "#ffffff", isle: "#4f9c3a", glow: "#a3d977",
    particles: ["#a3d977", "#ffd166", "#ffffff", "#7ac74f"], prop: "tree", bloom: 0.75,
  },
  aero: {
    id: "aero", name: "AERO GLASS", skyTop: "#2f7fd1", skyBottom: "#cfeaff", fog: "#bfe0ff", fogNear: 90, fogFar: 310,
    water: "#1f6fb2", ground: "#cfe6ff", road: "#dff0ff", roadLine: "#9fd8ff", roadEdge: "#ffffff",
    barrierA: "#5fc8ff", barrierB: "#e8f6ff", sun: "#eaf6ff", sunIntensity: 1.9, ambient: 1.05, ambientColor: "#eaf6ff",
    hemiSky: "#8fd3ff", hemiGround: "#dff0ff", cloud: "#ffffff", isle: "#a9d6ff", glow: "#7de1ff",
    particles: ["#ffffff", "#7de1ff", "#a9d6ff", "#dff0ff"], prop: "crystal", bloom: 1.15,
  },
  techno: {
    id: "techno", name: "TECHNO", skyTop: "#0b1030", skyBottom: "#2b1a6b", fog: "#1b1147", fogNear: 70, fogFar: 260,
    water: "#123a7a", ground: "#171a3a", road: "#1d2350", roadLine: "#00ffc6", roadEdge: "#7c5cff",
    barrierA: "#00e5ff", barrierB: "#ff3ea5", sun: "#8fb0ff", sunIntensity: 1.1, ambient: 0.7, ambientColor: "#8ea2ff",
    hemiSky: "#3b2a9b", hemiGround: "#0b1030", cloud: "#2c2a6b", isle: "#1b2160", glow: "#00ffc6",
    particles: ["#00ffc6", "#ff3ea5", "#7c5cff", "#ffffff"], prop: "circuit", bloom: 1.6,
  },
  aqua: {
    id: "aqua", name: "AQUA", skyTop: "#4fd8e8", skyBottom: "#d9fbff", fog: "#bdf3fb", fogNear: 70, fogFar: 250,
    water: "#12b6d8", ground: "#f3fcd6", road: "#dffaff", roadLine: "#4fd8e8", roadEdge: "#ffffff",
    barrierA: "#00c2d1", barrierB: "#ffe066", sun: "#eafeff", sunIntensity: 1.85, ambient: 1.05, ambientColor: "#eafeff",
    hemiSky: "#8eeaf5", hemiGround: "#12b6d8", cloud: "#ffffff", isle: "#f7e6a8", glow: "#4fd8e8",
    particles: ["#4fd8e8", "#ffffff", "#ffe066", "#00c2d1"], prop: "coral", bloom: 1.05,
  },
  sunset: {
    id: "sunset", name: "SUNSET", skyTop: "#ff8fa3", skyBottom: "#ffe6a7", fog: "#ffc9a3", fogNear: 75, fogFar: 270,
    water: "#ff6f91", ground: "#ffd6a5", road: "#fff1e0", roadLine: "#ff9f6e", roadEdge: "#ffe6a7",
    barrierA: "#ff4d6d", barrierB: "#ffc93c", sun: "#fff0c9", sunIntensity: 1.7, ambient: 0.95, ambientColor: "#ffe0c0",
    hemiSky: "#ffb3a7", hemiGround: "#ff9f6e", cloud: "#ffe6f0", isle: "#ff8fa3", glow: "#ffc93c",
    particles: ["#ffc93c", "#ff4d6d", "#ff9f6e", "#ffffff"], prop: "cactus", bloom: 1.2,
  },
  y2k: {
    id: "y2k", name: "Y2K", skyTop: "#b69cff", skyBottom: "#ffd9f5", fog: "#f2d0ff", fogNear: 80, fogFar: 290,
    water: "#7ee8ff", ground: "#e6e9ff", road: "#d8dcf5", roadLine: "#ff4fd8", roadEdge: "#ffffff",
    barrierA: "#ff4fd8", barrierB: "#4fe3ff", sun: "#fff0ff", sunIntensity: 1.8, ambient: 1.0, ambientColor: "#f4e8ff",
    hemiSky: "#d4c2ff", hemiGround: "#ffc2f0", cloud: "#fff0ff", isle: "#c7b8ff", glow: "#ff7bea",
    particles: ["#ff4fd8", "#4fe3ff", "#ffffff", "#c7b8ff"], prop: "y2k", bloom: 1.3,
  },
  liquid: {
    id: "liquid", name: "LIQUID GLASS", skyTop: "#8ec5ff", skyBottom: "#ffe3f7", fog: "#e0eaff", fogNear: 90, fogFar: 310,
    water: "#7fd1ff", ground: "#f5f0ff", road: "#f2f7ff", roadLine: "#a8d8ff", roadEdge: "#ffffff",
    barrierA: "#9de8ff", barrierB: "#ffb8f0", sun: "#ffffff", sunIntensity: 1.9, ambient: 1.1, ambientColor: "#f4f0ff",
    hemiSky: "#bcdcff", hemiGround: "#ffe3f7", cloud: "#ffffff", isle: "#d9c9ff", glow: "#b6e9ff",
    particles: ["#ffffff", "#b6e9ff", "#ffb8f0", "#d9c9ff"], prop: "liquid", bloom: 1.35,
  },
  win98: {
    id: "win98", name: "WINDOWS 98", skyTop: "#008080", skyBottom: "#00a0a0", fog: "#009090", fogNear: 100, fogFar: 330,
    water: "#000080", ground: "#c0c0c0", road: "#d4d0c8", roadLine: "#ffff00", roadEdge: "#808080",
    barrierA: "#000080", barrierB: "#c0c0c0", sun: "#ffffff", sunIntensity: 1.5, ambient: 1.0, ambientColor: "#ffffff",
    hemiSky: "#40c0c0", hemiGround: "#c0c0c0", cloud: "#e0e0e0", isle: "#808080", glow: "#00ffff",
    particles: ["#ffff00", "#00ffff", "#ff00ff", "#ffffff"], prop: "win98", bloom: 0.25,
  },
  vapor: {
    id: "vapor", name: "VAPORWAVE", skyTop: "#b967ff", skyBottom: "#ff9ee0", fog: "#ff9be0", fogNear: 80, fogFar: 280,
    water: "#01cdfe", ground: "#3b1d6e", road: "#2a1458", roadLine: "#05ffa1", roadEdge: "#ff71ce",
    barrierA: "#ff71ce", barrierB: "#01cdfe", sun: "#ffd1fa", sunIntensity: 1.3, ambient: 0.85, ambientColor: "#f0b0ff",
    hemiSky: "#b967ff", hemiGround: "#2a1458", cloud: "#ffb3ec", isle: "#5a2d9e", glow: "#05ffa1",
    particles: ["#ff71ce", "#01cdfe", "#05ffa1", "#b967ff"], prop: "vapor", bloom: 1.5,
  },
};

export const THEME_LIST: ThemeId[] = ["frutiger", "eco", "aero", "liquid", "y2k", "win98", "vapor", "techno", "aqua", "sunset"];

// ---------------------------------------------------------------------------
// Vehicle customization: 11 shapes, 5 wheels, 3 spoilers, 3 boosters,
// 3 boats, 3 planes and 3 submarines
// ---------------------------------------------------------------------------

export const SHAPES: { id: ShapeId; bonus: { speed: number; handling: number } }[] = [
  { id: "kart", bonus: { speed: 0, handling: 0 } },
  { id: "hover", bonus: { speed: 0.6, handling: 0.4 } },
  { id: "buggy", bonus: { speed: -0.4, handling: 0.9 } },
  { id: "jet", bonus: { speed: 1.4, handling: -0.6 } },
  { id: "cruiser", bonus: { speed: 0.3, handling: 0.2 } },
  { id: "moto", bonus: { speed: 0.9, handling: 0.6 } },
  { id: "ufo", bonus: { speed: 0.2, handling: 1.1 } },
  { id: "coupe", bonus: { speed: 1.0, handling: 0.3 } },
  { id: "van", bonus: { speed: -0.2, handling: 0.5 } },
  { id: "formula", bonus: { speed: 1.2, handling: 0.1 } },
  { id: "bubble", bonus: { speed: 0.4, handling: 0.8 } },
  { id: "rocket", bonus: { speed: 1.6, handling: -0.8 } },
  { id: "mono", bonus: { speed: 1.3, handling: 0.2 } },
  { id: "tank", bonus: { speed: -0.6, handling: -1.1 } },
  { id: "wedge", bonus: { speed: 1.1, handling: 0.9 } },
  { id: "sled", bonus: { speed: 1.4, handling: 0.4 } },
  { id: "orbit", bonus: { speed: 0.5, handling: 1.5 } },
  { id: "dune", bonus: { speed: 0.2, handling: 1.0 } },
  { id: "phantom", bonus: { speed: 0.8, handling: 1.3 } },
];

export const BODY_COLORS = ["#ff4d6d", "#ff9f1c", "#fde047", "#4ade80", "#22d3ee", "#6366f1", "#f472b6", "#ffffff", "#111827", "#a855f7", "#14b8a6"];
export const DECAL_COLORS = ["#ffffff", "#0ea5e9", "#facc15", "#f472b6", "#22c55e", "#111827", "#ff4fd8"];
export const WHEEL_STYLES: WheelStyle[] = ["classic", "sporty", "glow", "chrome", "spike"];
export const SPOILERS: SpoilerId[] = ["none", "wing", "fin"];
export const BOOSTERS: BoosterId[] = ["single", "twin", "neon"];
export const BOATS: BoatId[] = ["cat", "speed", "ski", "yacht"];
export const PLANES: PlaneId[] = ["wing", "bi", "delta", "stealth"];
export const SUBS: SubId[] = ["classic", "pod", "shark", "diver"];

/**
 * Per-craft speed and handling, taken from the second lineage and extended to every
 * craft here. speed scales the top speed in that mode, handling scales turn rate.
 */
export interface CraftStat {
  id: BoatId | PlaneId | SubId;
  speed: number;
  handling: number;
}

export const BOAT_STATS: CraftStat[] = [
  { id: "cat", speed: 0.92, handling: 0.95 },
  { id: "speed", speed: 1.22, handling: 0.9 },
  { id: "ski", speed: 1.1, handling: 1.15 },
  { id: "yacht", speed: 1.12, handling: 1.05 },
];

export const PLANE_STATS: CraftStat[] = [
  { id: "wing", speed: 1.0, handling: 1.0 },
  { id: "bi", speed: 0.9, handling: 1.2 },
  { id: "delta", speed: 1.12, handling: 0.9 },
  { id: "stealth", speed: 1.05, handling: 1.1 },
];

export const SUB_STATS: CraftStat[] = [
  { id: "classic", speed: 1.05, handling: 1.0 },
  { id: "pod", speed: 0.95, handling: 1.05 },
  { id: "shark", speed: 1.18, handling: 0.85 },
  { id: "diver", speed: 1.0, handling: 1.15 },
];

const CRAFT_SPEEDS: Record<string, number> = {};
const CRAFT_HANDLING: Record<string, number> = {};
for (const t of [...BOAT_STATS, ...PLANE_STATS, ...SUB_STATS]) {
  CRAFT_SPEEDS[t.id] = t.speed;
  CRAFT_HANDLING[t.id] = t.handling;
}

/** Craft stat lookup that never throws when a build ships an id without a row. */
export function craftSpeed(id: string | undefined, fallback: number): number {
  return (id !== undefined && CRAFT_SPEEDS[id]) || fallback;
}

export function craftHandling(id: string | undefined, fallback: number): number {
  return (id !== undefined && CRAFT_HANDLING[id]) || fallback;
}

// ---------------------------------------------------------------------------
// Weapons / items
// ---------------------------------------------------------------------------

export const WEAPONS: WeaponId[] = [
  "orb", "missile", "bubble", "slime", "beam", "zap", "mine", "wave", "swap", "magnet", "ghost", "quake",
];

/** drop weights inside item boxes (rarer = stronger) */
export const WEAPON_WEIGHTS: Record<WeaponId, number> = {
  orb: 20, missile: 16, bubble: 12, slime: 10, beam: 9, zap: 9, mine: 7, wave: 5,
  swap: 4, magnet: 8, ghost: 7, quake: 5,
};

export function rollWeapon(): WeaponId {
  const total = Object.values(WEAPON_WEIGHTS).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const w of WEAPONS) {
    r -= WEAPON_WEIGHTS[w];
    if (r <= 0) return w;
  }
  return "orb";
}

export const WEAPON_META: Record<WeaponId, { glyph: string; color: string; glow: string }> = {
  orb: { glyph: "◉", color: "#ffd166", glow: "#fff3bf" },
  missile: { glyph: "➤", color: "#ff4d6d", glow: "#ff9fb0" },
  bubble: { glyph: "◎", color: "#38bdf8", glow: "#bfeaff" },
  slime: { glyph: "❋", color: "#84cc16", glow: "#d9f99d" },
  beam: { glyph: "≡", color: "#c084fc", glow: "#f0abfc" },
  zap: { glyph: "⚡", color: "#ffe066", glow: "#fff6c2" },
  mine: { glyph: "✱", color: "#ff7b3d", glow: "#ffc29b" },
  wave: { glyph: "≋", color: "#22d3ee", glow: "#b5f4ff" },
  swap: { glyph: "⇅", color: "#f472b6", glow: "#ffd1ec" },
  magnet: { glyph: "∪", color: "#fb923c", glow: "#ffd9b0" },
  ghost: { glyph: "◌", color: "#e0e7ff", glow: "#ffffff" },
  quake: { glyph: "☲", color: "#a16207", glow: "#fde68a" },
};

// ---------------------------------------------------------------------------
// Race modes
// ---------------------------------------------------------------------------

export interface GameMode {
  id: "quick" | "trial" | "chaos" | "sprint" | "duel";
  laps: number;
  aiCount: number;
  itemsEnabled: boolean;
  itemFrequency: number;
  rubberband: number;
}

export const MODES: Record<string, GameMode> = {
  quick: { id: "quick", laps: 3, aiCount: 5, itemsEnabled: true, itemFrequency: 1, rubberband: 1 },
  trial: { id: "trial", laps: 3, aiCount: 0, itemsEnabled: false, itemFrequency: 0, rubberband: 0 },
  chaos: { id: "chaos", laps: 4, aiCount: 7, itemsEnabled: true, itemFrequency: 1.7, rubberband: 1.35 },
  sprint: { id: "sprint", laps: 1, aiCount: 7, itemsEnabled: true, itemFrequency: 1.3, rubberband: 1.1 },
  duel: { id: "duel", laps: 5, aiCount: 1, itemsEnabled: true, itemFrequency: 1.2, rubberband: 1.5 },
};

// ---------------------------------------------------------------------------
// Tracks: 10 circuits. zones order is always [water, sky, sub?].
// forks = two-lane sections, shortcuts = alternative jump-paths.
// ---------------------------------------------------------------------------

export interface Zone {
  t0: number;
  t1: number;
  type: "water" | "sky" | "sub";
}

export interface ShortcutDef {
  t0: number;
  t1: number;
  side: 1 | -1;
}

/** A branch is an alternate ribbon that peels off the main road and rejoins it. */
export interface Branch {
  t0: number;
  t1: number;
  pull: number; // lateral displacement at peak (+ = right of travel direction)
}

export interface TrackDef {
  id: string;
  points: [number, number, number][];
  zones: Zone[];
  forks: [number, number][];
  shortcuts: ShortcutDef[];
  branches: Branch[];
  hazards: number;
  difficulty: 1 | 2 | 3;
}

function scaled(pts: [number, number, number][], k: number): [number, number, number][] {
  return pts.map((p) => [p[0] * k, p[1], p[2] * k] as [number, number, number]);
}

/** Star-shaped closed loop with harmonic wobble: long, winding and never self-crossing. */
function radial(n: number, R: number, harm: [number, number, number][], sx = 1, sz = 1): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    let k = 1;
    for (const [f, a, p] of harm) k += a * Math.sin(f * th + p);
    const r = R * k;
    pts.push([Math.sin(th) * r * sx, 0, -Math.cos(th) * r * sz]);
  }
  return pts;
}

const K = 1.4; // classic circuits are stretched to be much longer

export const TRACKS: TrackDef[] = [
  {
    id: "laguna", difficulty: 1, hazards: 3,
    points: scaled([
      [0, 0, -46], [26, 0, -40], [46, 0, -18], [50, 0, 8], [34, 0, 32], [10, 0, 28],
      [-6, 0, 8], [-28, 0, 10], [-46, 0, 32], [-62, 0, 12], [-56, 0, -18], [-30, 0, -36], [-12, 0, -26],
    ], K),
    zones: [{ t0: 0.13, t1: 0.27, type: "water" }, { t0: 0.55, t1: 0.68, type: "sky" }],
    forks: [[0.33, 0.44]],
    shortcuts: [{ t0: 0.72, t1: 0.82, side: 1 }],
    branches: [{ t0: 0.72, t1: 0.93, pull: -26 }],
  },
  {
    id: "vortice", difficulty: 2, hazards: 5,
    points: scaled([
      [0, 0, -62], [30, 0, -58], [52, 0, -44], [40, 0, -22], [56, 0, -4], [64, 0, 20],
      [52, 0, 46], [26, 0, 52], [6, 0, 34], [-8, 0, 20], [-20, 0, 38], [-44, 0, 50],
      [-66, 0, 36], [-58, 0, 8], [-34, 0, -4], [-48, 0, -26], [-38, 0, -52], [-12, 0, -50],
    ], K),
    zones: [{ t0: 0.3, t1: 0.42, type: "water" }, { t0: 0.66, t1: 0.8, type: "sky" }, { t0: 0.86, t1: 0.95, type: "sub" }],
    forks: [[0.06, 0.18], [0.46, 0.56]],
    shortcuts: [{ t0: 0.2, t1: 0.27, side: -1 }, { t0: 0.57, t1: 0.64, side: 1 }],
    branches: [{ t0: 0.1, t1: 0.26, pull: 30 }, { t0: 0.84, t1: 0.98, pull: -28 }],
  },
  {
    id: "canon", difficulty: 3, hazards: 7,
    points: scaled([
      [0, 0, -70], [26, 0, -66], [34, 0, -46], [58, 0, -42], [72, 0, -18], [56, 0, 0],
      [68, 0, 20], [58, 0, 46], [30, 0, 40], [22, 0, 62], [-8, 0, 70], [-28, 0, 52],
      [-14, 0, 32], [-38, 0, 18], [-62, 0, 30], [-78, 0, 8], [-62, 0, -18], [-36, 0, -22],
      [-50, 0, -48], [-22, 0, -62], [-4, 0, -52],
    ], K),
    zones: [{ t0: 0.36, t1: 0.47, type: "water" }, { t0: 0.76, t1: 0.9, type: "sky" }, { t0: 0.26, t1: 0.33, type: "sub" }],
    forks: [[0.1, 0.22], [0.52, 0.64]],
    shortcuts: [{ t0: 0.66, t1: 0.74, side: -1 }, { t0: 0.56, t1: 0.62, side: 1 }],
    branches: [{ t0: 0.02, t1: 0.16, pull: -32 }, { t0: 0.56, t1: 0.72, pull: 30 }],
  },
  {
    id: "celeste", difficulty: 2, hazards: 4,
    points: scaled([
      [0, 0, -58], [34, 0, -54], [62, 0, -32], [68, 0, 2], [52, 0, 30], [30, 0, 52],
      [0, 0, 54], [-22, 0, 44], [-26, 0, 18], [-10, 0, 2], [-34, 0, -12], [-62, 0, 0],
      [-72, 0, -28], [-50, 0, -54], [-20, 0, -50],
    ], K),
    zones: [{ t0: 0.18, t1: 0.3, type: "water" }, { t0: 0.48, t1: 0.72, type: "sky" }],
    forks: [[0.78, 0.88]],
    shortcuts: [{ t0: 0.34, t1: 0.44, side: 1 }],
    branches: [{ t0: 0.34, t1: 0.46, pull: 28 }],
  },
  {
    id: "atlantis", difficulty: 3, hazards: 8,
    points: scaled([
      [0, 0, -74], [34, 0, -70], [56, 0, -56], [44, 0, -34], [70, 0, -22], [80, 0, 4],
      [62, 0, 18], [72, 0, 44], [48, 0, 60], [20, 0, 52], [12, 0, 28], [-6, 0, 16],
      [-18, 0, 36], [-44, 0, 56], [-72, 0, 52], [-88, 0, 28], [-76, 0, 2], [-56, 0, -12],
      [-72, 0, -38], [-58, 0, -62], [-28, 0, -70], [-8, 0, -58],
    ], K),
    zones: [{ t0: 0.14, t1: 0.22, type: "water" }, { t0: 0.58, t1: 0.74, type: "sky" }, { t0: 0.3, t1: 0.38, type: "sub" }],
    forks: [[0.04, 0.12], [0.44, 0.54], [0.84, 0.94]],
    shortcuts: [{ t0: 0.76, t1: 0.83, side: -1 }, { t0: 0.39, t1: 0.43, side: 1 }],
    branches: [{ t0: 0.08, t1: 0.24, pull: 34 }, { t0: 0.44, t1: 0.56, pull: -30 }, { t0: 0.86, t1: 0.99, pull: 26 }],
  },
  {
    id: "aether", difficulty: 3, hazards: 6,
    points: scaled([
      [0, 0, -68], [38, 0, -62], [66, 0, -40], [58, 0, -14], [84, 0, 2], [74, 0, 28],
      [52, 0, 42], [24, 0, 34], [10, 0, 54], [-16, 0, 66], [-42, 0, 56], [-52, 0, 32],
      [-32, 0, 18], [-52, 0, 4], [-78, 0, 16], [-92, 0, -12], [-70, 0, -34], [-44, 0, -32],
      [-54, 0, -58], [-24, 0, -70], [-6, 0, -56],
    ], K),
    zones: [{ t0: 0.28, t1: 0.38, type: "water" }, { t0: 0.55, t1: 0.85, type: "sky" }],
    forks: [[0.08, 0.2], [0.42, 0.5], [0.88, 0.98]],
    shortcuts: [{ t0: 0.21, t1: 0.27, side: 1 }],
    branches: [{ t0: 0.04, t1: 0.2, pull: -34 }, { t0: 0.6, t1: 0.76, pull: 32 }],
  },
  {
    id: "neon", difficulty: 3, hazards: 7,
    points: radial(30, 118, [[2, 0.14, 0.3], [3, 0.12, 1.2], [5, 0.09, 2.1]], 1.15, 0.9),
    zones: [{ t0: 0.22, t1: 0.3, type: "water" }, { t0: 0.62, t1: 0.78, type: "sky" }, { t0: 0.4, t1: 0.48, type: "sub" }],
    forks: [[0.08, 0.16], [0.84, 0.94]],
    shortcuts: [{ t0: 0.32, t1: 0.38, side: 1 }, { t0: 0.52, t1: 0.6, side: -1 }],
    branches: [{ t0: 0.06, t1: 0.2, pull: 36 }, { t0: 0.34, t1: 0.44, pull: -30 }, { t0: 0.74, t1: 0.9, pull: 32 }],
  },
  {
    id: "coral", difficulty: 2, hazards: 4,
    points: radial(28, 105, [[3, 0.16, 0.8], [4, 0.1, 2.4], [6, 0.06, 0.4]], 1.0, 1.1),
    zones: [{ t0: 0.1, t1: 0.2, type: "water" }, { t0: 0.68, t1: 0.8, type: "sky" }, { t0: 0.3, t1: 0.42, type: "sub" }],
    forks: [[0.5, 0.62]],
    shortcuts: [{ t0: 0.22, t1: 0.28, side: -1 }, { t0: 0.84, t1: 0.92, side: 1 }],
    branches: [{ t0: 0.02, t1: 0.16, pull: -38 }, { t0: 0.32, t1: 0.46, pull: 34 }, { t0: 0.56, t1: 0.7, pull: -32 }, { t0: 0.82, t1: 0.97, pull: 30 }],
  },
  {
    id: "glacier", difficulty: 3, hazards: 6,
    points: radial(34, 128, [[2, 0.2, 2], [4, 0.12, 0.6], [7, 0.07, 1.4]], 1.2, 0.95),
    zones: [{ t0: 0.36, t1: 0.44, type: "water" }, { t0: 0.6, t1: 0.72, type: "sky" }],
    forks: [[0.12, 0.24], [0.78, 0.9]],
    shortcuts: [{ t0: 0.26, t1: 0.34, side: 1 }, { t0: 0.48, t1: 0.56, side: -1 }],
    branches: [{ t0: 0.14, t1: 0.3, pull: -28 }, { t0: 0.66, t1: 0.8, pull: 30 }],
  },
  {
    id: "retro", difficulty: 2, hazards: 6,
    points: radial(32, 112, [[4, 0.2, 0], [8, 0.06, 0.5]], 1, 1),
    zones: [{ t0: 0.2, t1: 0.28, type: "water" }, { t0: 0.58, t1: 0.7, type: "sky" }, { t0: 0.74, t1: 0.82, type: "sub" }],
    forks: [[0.06, 0.14], [0.4, 0.5]],
    shortcuts: [{ t0: 0.3, t1: 0.37, side: 1 }, { t0: 0.86, t1: 0.93, side: -1 }],
    branches: [{ t0: 0.24, t1: 0.38, pull: 26 }, { t0: 0.58, t1: 0.74, pull: -26 }],
  },
];

TRACKS.push(
  {
    id: "prisma", difficulty: 3, hazards: 8,
    points: radial(36, 132, [[2, 0.18, 1.1], [3, 0.13, 2.6], [5, 0.08, 0.2], [8, 0.05, 1.8]], 1.1, 1.0),
    zones: [{ t0: 0.16, t1: 0.24, type: "water" }, { t0: 0.52, t1: 0.66, type: "sky" }, { t0: 0.78, t1: 0.88, type: "sub" }],
    forks: [[0.04, 0.13], [0.3, 0.42], [0.68, 0.76]],
    shortcuts: [],
    branches: [{ t0: 0.08, t1: 0.24, pull: 32 }, { t0: 0.44, t1: 0.58, pull: -30 }, { t0: 0.78, t1: 0.94, pull: 28 }],
  },
  {
    id: "nimbus", difficulty: 2, hazards: 5,
    points: radial(30, 120, [[3, 0.17, 1.9], [6, 0.09, 0.7]], 1.25, 0.88),
    zones: [{ t0: 0.26, t1: 0.34, type: "water" }, { t0: 0.5, t1: 0.74, type: "sky" }],
    forks: [[0.08, 0.2], [0.82, 0.94]],
    shortcuts: [],
    branches: [{ t0: 0.2, t1: 0.34, pull: -24 }, { t0: 0.62, t1: 0.78, pull: 26 }],
  },
  {
    id: "abyss", difficulty: 3, hazards: 7,
    points: radial(34, 126, [[2, 0.22, 0.4], [5, 0.1, 2.2], [7, 0.06, 1.1]], 0.95, 1.2),
    zones: [{ t0: 0.12, t1: 0.3, type: "sub" }, { t0: 0.44, t1: 0.52, type: "water" }, { t0: 0.66, t1: 0.78, type: "sky" }],
    forks: [[0.34, 0.42], [0.86, 0.96]],
    shortcuts: [],
    branches: [{ t0: 0.06, t1: 0.22, pull: 34 }, { t0: 0.4, t1: 0.56, pull: -34 }, { t0: 0.72, t1: 0.88, pull: 30 }],
  },
  {
    id: "garden", difficulty: 1, hazards: 4,
    points: radial(28, 108, [[4, 0.15, 2.8], [2, 0.1, 0.9]], 1.05, 1.05),
    zones: [{ t0: 0.2, t1: 0.3, type: "water" }, { t0: 0.6, t1: 0.72, type: "sky" }],
    forks: [[0.42, 0.52]],
    shortcuts: [],
    branches: [{ t0: 0.28, t1: 0.44, pull: 24 }, { t0: 0.66, t1: 0.8, pull: -24 }],
  }
);

// Every circuit gets many alternative routes so the finish can be reached in
// different ways: explicit gates plus auto-generated ones, dodging the zones.
for (const trk of TRACKS) {
  const occupied = (a: number, b: number) =>
    trk.zones.some((z) => !(b < z.t0 - 0.02 || a > z.t1 + 0.02)) ||
    trk.forks.some((f) => !(b < f[0] - 0.02 || a > f[1] + 0.02)) ||
    trk.shortcuts.some((s) => !(b < s.t0 - 0.02 || a > s.t1 + 0.02));
  const want = 7;
  for (let i = 0; i < want * 5 && trk.shortcuts.length < want; i++) {
    const t0 = (i * 0.113 + 0.045) % 1;
    const t1 = (t0 + 0.05) % 1;
    if (t1 < t0) continue;
    if (occupied(t0, t1)) continue;
    trk.shortcuts.push({ t0, t1, side: trk.shortcuts.length % 2 === 0 ? 1 : -1 });
  }
  trk.shortcuts.sort((a, b) => a.t0 - b.t0);
}

/** Live state for mutating hazards (written by Track, read by the simulation). */
export const hazardState: {
  positions: { x: number; z: number; t: number }[];
  lap: number;
} = { positions: [], lap: 0 };

export const TRACK_WIDTH = 14;
export const SKY_ALTITUDE = 9;

// Mutable active zones — rewritten by setActiveTrack() in trackCurve.ts
export const ZONES: Zone[] = [...TRACKS[0].zones];

export function zoneAt(t: number): Zone | null {
  const tt = ((t % 1) + 1) % 1;
  for (const z of ZONES) if (tt >= z.t0 && tt <= z.t1) return z;
  return null;
}

export function zoneProgress(t: number, z: Zone) {
  return (t - z.t0) / (z.t1 - z.t0);
}

// Live snapshot consumed by the minimap (written by the sim each frame).
export const raceSnapshot: {
  racers: { x: number; z: number; color: string; isPlayer: boolean; mode: VehicleMode }[];
  camAngle: number;
  theme: ThemeId;
} = { racers: [], camAngle: 0, theme: "frutiger" };
