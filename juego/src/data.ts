import { DESIGNED_TRACKS } from "./tracks";

// ---------------------------------------------------------------------------
// Core game data: characters, aesthetics, tracks, vehicle parts, weapons
// ---------------------------------------------------------------------------

// Frutiger Aero life-forms instead of animals: glossy droplets, bubbles, crystals...
export type FormId = "drop" | "bubble" | "leaf" | "crystal" | "holo" | "cloud" | "star" | "flame";
export type EyeStyle = "sparkle" | "sharp" | "visor" | "sleepy";
export type RoleId = "speed" | "handler" | "heavy" | "balanced" | "trickster" | "tech";
export type WeaponId =
  | "orb" | "missile" | "bubble" | "slime" | "beam" | "zap" | "mine" | "wave"
  | "swap" | "magnet" | "ghost" | "quake" | "freeze" | "steal" | "popup" | "giant" | "warp";
export type ShapeId =
  | "kart" | "hover" | "buggy" | "jet" | "cruiser" | "moto" | "ufo"
  | "coupe" | "van" | "formula" | "bubble" | "rocket" | "mono"
  | "tank" | "wedge" | "sled" | "orbit" | "dune" | "phantom" | "mech" | "board" | "shell" | "winglet" | "pod";
export type ThemeId =
  | "frutiger" | "aero" | "techno" | "eco" | "aqua" | "sunset"
  | "y2k" | "liquid" | "win98" | "vapor" | "dreamcore" | "cyberpunk" | "noir" | "backrooms" | "liminal" | "eden"
  | "metro" | "tux" | "debian" | "arch" | "mac" | "slime" | "webcore";
export type WheelStyle = "classic" | "sporty" | "glow" | "chrome" | "spike";
export type SpoilerId = "none" | "wing" | "fin";
export type FinishId = "solid" | "gloss" | "matte" | "chrome" | "glass" | "holo";
export type BoosterId = "single" | "twin" | "neon";
export type BoatId = "cat" | "speed" | "ski" | "yacht" | "tug" | "raft" | "hovercraft" | "airboat" | "viking" | "duck";
export type PlaneId = "wing" | "bi" | "delta" | "stealth" | "jetliner" | "twinprop" | "nimbus" | "heli" | "blimp" | "saucer";
export type SubId = "classic" | "pod" | "shark" | "diver" | "dredger" | "sleuth" | "leviathan" | "manta" | "squid" | "bathy" | "torpedo";
export type HoverId = "maglev" | "disc" | "nacelle" | "magboard" | "gyro";
export type VehicleMode = "land" | "boat" | "plane" | "sub" | "hover";

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
  /**
   * Weapon the partner mans while fused. Every character brings a different gun,
   * so fusion is a pairing choice instead of one universal missile stream.
   */
  fusion: WeaponId;
  /** seconds between fusion shots, tuned per character */
  fusionRate: number;
  /** extra shots in the salvo while fused */
  fusionBurst: number;
  /** how wide the salvo fans out, in radians */
  fusionSpread: number;
  /** extra slowdown a direct hit lands, 0..1 */
  fusionKick: number;
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

type RawCharacter = Omit<CharacterDef, "fusion" | "fusionRate" | "fusionBurst" | "fusionSpread" | "fusionKick">;

const RAW_CHARACTERS: RawCharacter[] = [
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

/**
 * Fusion guns. The list is walked per character so every roster slot gets a
 * different turret; the rate makes a heavy hitter slower than a glass cannon.
 */
/**
 * Every character mans a different turret while fused, so fusion is a pairing
 * decision instead of a shared missile stream. `burst` adds shots to the salvo,
 * `spread` fans them out, `kick` is the extra slowdown a direct hit applies.
 * All 28 entries are distinct: nobody shares a rate and a pattern.
 */
interface FusionSpec {
  w: WeaponId;
  rate: number;
  burst: number;
  spread: number;
  kick: number;
}

const FUSION_SPECS: FusionSpec[] = [
  { w: "missile", rate: 0.85, burst: 0, spread: 0, kick: 0.2 },
  { w: "orb", rate: 0.7, burst: 1, spread: 0.12, kick: 0.15 },
  { w: "beam", rate: 1.05, burst: 0, spread: 0, kick: 0.55 },
  { w: "zap", rate: 0.95, burst: 1, spread: 0.05, kick: 0.4 },
  { w: "wave", rate: 1.15, burst: 1, spread: 0.3, kick: 0.25 },
  { w: "bubble", rate: 0.8, burst: 2, spread: 0.22, kick: 0.1 },
  { w: "mine", rate: 1.25, burst: 0, spread: 0, kick: 0.35 },
  { w: "slime", rate: 1.0, burst: 1, spread: 0.18, kick: 0.3 },
  { w: "quake", rate: 1.35, burst: 0, spread: 0.4, kick: 0.6 },
  { w: "magnet", rate: 0.9, burst: 1, spread: 0.08, kick: 0.2 },
  { w: "ghost", rate: 1.1, burst: 2, spread: 0.34, kick: 0.12 },
  { w: "swap", rate: 1.2, burst: 0, spread: 0.1, kick: 0.45 },
  { w: "missile", rate: 0.75, burst: 2, spread: 0.26, kick: 0.28 },
  { w: "orb", rate: 0.92, burst: 0, spread: 0.06, kick: 0.5 },
  { w: "bubble", rate: 0.68, burst: 1, spread: 0.4, kick: 0.18 },
  { w: "zap", rate: 1.18, burst: 2, spread: 0.02, kick: 0.35 },
  { w: "beam", rate: 0.88, burst: 0, spread: 0.14, kick: 0.62 },
  { w: "slime", rate: 1.32, burst: 1, spread: 0.32, kick: 0.22 },
  { w: "mine", rate: 0.78, burst: 2, spread: 0.16, kick: 0.3 },
  { w: "wave", rate: 0.98, burst: 0, spread: 0.28, kick: 0.42 },
  { w: "ghost", rate: 1.42, burst: 1, spread: 0.1, kick: 0.08 },
  { w: "quake", rate: 1.06, burst: 0, spread: 0.36, kick: 0.55 },
  { w: "magnet", rate: 0.83, burst: 2, spread: 0.2, kick: 0.16 },
  { w: "swap", rate: 1.28, burst: 1, spread: 0.12, kick: 0.48 },
  { w: "missile", rate: 1.15, burst: 0, spread: 0.24, kick: 0.52 },
  { w: "beam", rate: 0.72, burst: 1, spread: 0.1, kick: 0.4 },
  { w: "bubble", rate: 1.24, burst: 2, spread: 0.38, kick: 0.14 },
  { w: "zap", rate: 0.87, burst: 0, spread: 0.04, kick: 0.58 },
  { w: "slime", rate: 1.12, burst: 1, spread: 0.26, kick: 0.26 },
];

export function fusionSpec(charId: string): FusionSpec {
  const i = RAW_CHARACTERS.findIndex((c) => c.id === charId);
  return FUSION_SPECS[(i >= 0 ? i : 0) % FUSION_SPECS.length];
}

export const CHARACTERS: CharacterDef[] = RAW_CHARACTERS.map((c, i) => {
  const f = fixEarColors[c.id];
  const gun = FUSION_SPECS[i % FUSION_SPECS.length];
  return {
    ...c,
    primary: f?.primary ?? vivid(c.primary, 0.55, 0.66),
    secondary: f?.secondary ?? c.secondary,
    accent: f?.accent ?? vivid(c.accent, 0.3, 0.44),
    fusion: gun.w,
    fusionRate: gun.rate,
    fusionBurst: gun.burst,
    fusionSpread: gun.spread,
    fusionKick: gun.kick,
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
  prop: "palm" | "crystal" | "circuit" | "tree" | "coral" | "cactus" | "y2k" | "win98" | "liquid" | "vapor" | "door" | "lamp" | "eden";
  bloom: number;
  /** dark themes need light text in menus */
  dark?: boolean;
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
    id: "techno", name: "TECHNO", skyTop: "#1a2260", skyBottom: "#4a2fa8", fog: "#2c2070", fogNear: 70, fogFar: 260,
    water: "#123a7a", ground: "#262c66", road: "#2c3470", roadLine: "#00ffc6", roadEdge: "#7c5cff",
    barrierA: "#00e5ff", barrierB: "#ff3ea5", sun: "#8fb0ff", sunIntensity: 1.6, ambient: 1.15, ambientColor: "#8ea2ff",
    hemiSky: "#3b2a9b", hemiGround: "#2a2f6a", cloud: "#4a46a0", isle: "#2e3690", glow: "#00ffc6",
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
    water: "#01cdfe", ground: "#4b2a86", road: "#4a2a88", roadLine: "#05ffa1", roadEdge: "#ff71ce",
    barrierA: "#ff71ce", barrierB: "#01cdfe", sun: "#ffd1fa", sunIntensity: 1.3, ambient: 1.05, ambientColor: "#f0b0ff",
    hemiSky: "#b967ff", hemiGround: "#4a2a88", cloud: "#ffb3ec", isle: "#5a2d9e", glow: "#05ffa1",
    particles: ["#ff71ce", "#01cdfe", "#05ffa1", "#b967ff"], prop: "vapor", bloom: 1.5,
  },
  dreamcore: {
    id: "dreamcore", name: "DREAMCORE", skyTop: "#a99bf0", skyBottom: "#e3d2ff", fog: "#cfc0f5", fogNear: 70, fogFar: 280,
    water: "#b9c9ff", ground: "#e6d9ff", road: "#f5eeff", roadLine: "#ffe1f5", roadEdge: "#ffffff",
    barrierA: "#ffd1ec", barrierB: "#c9e6ff", sun: "#fff0f9", sunIntensity: 1.8, ambient: 1.0, ambientColor: "#ffffff",
    hemiSky: "#d9c9ff", hemiGround: "#f0e6ff", cloud: "#ffffff", isle: "#d9c9ff", glow: "#ffe1f5",
    particles: ["#ffffff", "#ffe1f5", "#c9e6ff", "#d9c9ff"], prop: "door", bloom: 0.7,
  },
  // the yellow rooms: wallpaper, damp carpet and the hum of the lights
  backrooms: {
    id: "backrooms", name: "BACKROOMS", skyTop: "#d9c36a", skyBottom: "#efe2a0", fog: "#d8c670", fogNear: 26, fogFar: 180,
    water: "#c9d38a", ground: "#b9a653", road: "#cdbb6e", roadLine: "#efe4a6", roadEdge: "#a8954a",
    barrierA: "#e3d27c", barrierB: "#c9b458", sun: "#fff6c9", sunIntensity: 1.5, ambient: 1.15, ambientColor: "#fff3b8",
    hemiSky: "#fff2a8", hemiGround: "#a89444", cloud: "#f3ecc4", isle: "#b9a653", glow: "#fff7c2",
    particles: ["#fff7c2", "#e3d27c", "#ffffff", "#c9b458"], prop: "door", bloom: 0.6,
  },
  // somewhere between places: white tile, still water, nobody
  liminal: {
    id: "liminal", name: "LIMINAL", skyTop: "#cfeaf2", skyBottom: "#f4fbfd", fog: "#dff3f7", fogNear: 30, fogFar: 210,
    water: "#5fd0e6", ground: "#e6f1f4", road: "#f4f9fb", roadLine: "#9fdcec", roadEdge: "#ffffff",
    barrierA: "#ffffff", barrierB: "#bfe9f3", sun: "#ffffff", sunIntensity: 1.7, ambient: 1.2, ambientColor: "#ffffff",
    hemiSky: "#e8f8fc", hemiGround: "#cfeaf2", cloud: "#ffffff", isle: "#e6f2f5", glow: "#9fe8ff",
    particles: ["#ffffff", "#9fe8ff", "#bfe9f3", "#5fd0e6"], prop: "lamp", bloom: 0.7,
  },
  // the garden that goes on for ever, under a sky that is too blue, and everything in it has eyes
  eden: {
    id: "eden", name: "WEIRDCORE", skyTop: "#4aa3ff", skyBottom: "#d6f0ff", fog: "#cfeaff", fogNear: 90, fogFar: 340,
    water: "#6fd3ff", ground: "#5fd35a", road: "#fdf6e3", roadLine: "#ff8fd0", roadEdge: "#ffffff",
    barrierA: "#ff9de1", barrierB: "#fff07a", sun: "#ffffff", sunIntensity: 1.9, ambient: 1.1, ambientColor: "#ffffff",
    hemiSky: "#cfeaff", hemiGround: "#7be36f", cloud: "#ffffff", isle: "#49c24a", glow: "#fff07a",
    particles: ["#ff9de1", "#fff07a", "#9be7ff", "#ffffff"], prop: "eden", bloom: 0.8,
  },
  // ---- places the internet remembers: a subway, three operating systems, a swamp of gel and a home page ----
  metro: {
    id: "metro", name: "METRO", skyTop: "#cfd6de", skyBottom: "#eef2f6", fog: "#dfe5ec", fogNear: 30, fogFar: 210,
    water: "#5aa7d6", ground: "#9aa4b1", road: "#737c8a", roadLine: "#ffd21f", roadEdge: "#f4f1e8",
    barrierA: "#f4f1e8", barrierB: "#e2572b", sun: "#ffffff", sunIntensity: 1.75, ambient: 1.1, ambientColor: "#ffffff",
    hemiSky: "#eef2f6", hemiGround: "#9aa4b1", cloud: "#e9edf2", isle: "#aab3bf", glow: "#fff4c9",
    particles: ["#ffd21f", "#e2572b", "#ffffff", "#5aa7d6"], prop: "lamp", bloom: 0.75,
  },
  tux: {
    id: "tux", name: "TUX", skyTop: "#8fd3ff", skyBottom: "#f2fbff", fog: "#e6f6ff", fogNear: 90, fogFar: 340,
    water: "#3fb6e8", ground: "#f4fbff", road: "#e9f6ff", roadLine: "#ffc21f", roadEdge: "#ffffff",
    barrierA: "#1f2a3a", barrierB: "#ffc21f", sun: "#ffffff", sunIntensity: 1.75, ambient: 1.1, ambientColor: "#ffffff",
    hemiSky: "#f2fbff", hemiGround: "#f4fbff", cloud: "#ffffff", isle: "#ffffff", glow: "#9be7ff",
    particles: ["#ffffff", "#ffc21f", "#9be7ff", "#1f2a3a"], prop: "crystal", bloom: 0.75,
  },
  debian: {
    id: "debian", name: "SWIRL", skyTop: "#ffd6e3", skyBottom: "#fff5f8", fog: "#ffe9f0", fogNear: 80, fogFar: 320,
    water: "#ff9fbe", ground: "#f7f1f3", road: "#ffffff", roadLine: "#d70a53", roadEdge: "#d70a53",
    barrierA: "#d70a53", barrierB: "#ffffff", sun: "#ffffff", sunIntensity: 1.75, ambient: 1.1, ambientColor: "#ffffff",
    hemiSky: "#fff5f8", hemiGround: "#f7f1f3", cloud: "#ffffff", isle: "#f0d5dd", glow: "#ff5c93",
    particles: ["#d70a53", "#ffffff", "#ff9fbe", "#ff5c93"], prop: "y2k", bloom: 0.75,
  },
  arch: {
    id: "arch", name: "ARCH", skyTop: "#1793d1", skyBottom: "#cdeeff", fog: "#bfe6fa", fogNear: 90, fogFar: 340,
    water: "#1793d1", ground: "#cfd9e0", road: "#f3f7fa", roadLine: "#1793d1", roadEdge: "#333c47",
    barrierA: "#1793d1", barrierB: "#333c47", sun: "#ffffff", sunIntensity: 1.75, ambient: 1.1, ambientColor: "#ffffff",
    hemiSky: "#cdeeff", hemiGround: "#cfd9e0", cloud: "#ffffff", isle: "#b9c7d1", glow: "#6fd0ff",
    particles: ["#1793d1", "#ffffff", "#6fd0ff", "#333c47"], prop: "crystal", bloom: 0.75,
  },
  mac: {
    id: "mac", name: "AQUA", skyTop: "#6fb4f0", skyBottom: "#eaf4ff", fog: "#d9eafc", fogNear: 80, fogFar: 320,
    water: "#2f8fe8", ground: "#dfe5ec", road: "#f2f4f7", roadLine: "#2f8fe8", roadEdge: "#c7ced8",
    barrierA: "#c7ced8", barrierB: "#5aa9f5", sun: "#ffffff", sunIntensity: 1.75, ambient: 1.1, ambientColor: "#ffffff",
    hemiSky: "#eaf4ff", hemiGround: "#dfe5ec", cloud: "#ffffff", isle: "#cfd6df", glow: "#8fc8ff",
    particles: ["#ff5f57", "#febc2e", "#28c840", "#5aa9f5"], prop: "liquid", bloom: 0.75,
  },
  slime: {
    id: "slime", name: "SLIME AERO", skyTop: "#9df57a", skyBottom: "#f1ffd9", fog: "#d9ffb8", fogNear: 80, fogFar: 300,
    water: "#5fe03a", ground: "#8fe85f", road: "#f4ffe6", roadLine: "#39d353", roadEdge: "#ffffff",
    barrierA: "#39d353", barrierB: "#c8ff5a", sun: "#ffffff", sunIntensity: 1.75, ambient: 1.1, ambientColor: "#ffffff",
    hemiSky: "#f1ffd9", hemiGround: "#8fe85f", cloud: "#ffffff", isle: "#58c93c", glow: "#c8ff5a",
    particles: ["#c8ff5a", "#39d353", "#ffffff", "#9df57a"], prop: "liquid", bloom: 0.75,
  },
  webcore: {
    id: "webcore", name: "WEBCORE", skyTop: "#00a0a0", skyBottom: "#b8f0f0", fog: "#9fe0e0", fogNear: 80, fogFar: 300,
    water: "#0000ee", ground: "#c0c0c0", road: "#ffffcc", roadLine: "#ff00ff", roadEdge: "#0000ee",
    barrierA: "#ff00ff", barrierB: "#00ff66", sun: "#ffffff", sunIntensity: 1.75, ambient: 1.1, ambientColor: "#ffffff",
    hemiSky: "#b8f0f0", hemiGround: "#c0c0c0", cloud: "#ffffff", isle: "#a0a0a0", glow: "#ffff00",
    particles: ["#ff00ff", "#ffff00", "#00ff66", "#0000ee"], prop: "win98", bloom: 0.75,
  },
  cyberpunk: {
    id: "cyberpunk", name: "CYBERPUNK", skyTop: "#141a3c", skyBottom: "#2a2466", fog: "#1c1c4a", fogNear: 80, fogFar: 280,
    water: "#102040", ground: "#22243a", road: "#2a2452", roadLine: "#39ff14", roadEdge: "#7c9cff",
    barrierA: "#ff3366", barrierB: "#39ff14", sun: "#b8ffd0", sunIntensity: 1.6, ambient: 1.25, ambientColor: "#4d7cff",
    hemiSky: "#3a3f8a", hemiGround: "#2a2a40", cloud: "#3a3470", isle: "#2c2a55", glow: "#39ff14",
    particles: ["#39ff14", "#7c9cff", "#ff3366", "#ffffff"], prop: "circuit", bloom: 1.2, dark: true,
  },
  noir: {
    id: "noir", name: "NOIR", skyTop: "#3a3a40", skyBottom: "#6a6a72", fog: "#4a4a50", fogNear: 70, fogFar: 260,
    water: "#0f141f", ground: "#3a3a3e", road: "#48484c", roadLine: "#d8d8d8", roadEdge: "#f5f5f5",
    barrierA: "#d8d8d8", barrierB: "#a0a0a0", sun: "#ffffff", sunIntensity: 1.5, ambient: 1.1, ambientColor: "#ffffff",
    hemiSky: "#6a6a72", hemiGround: "#3a3a3e", cloud: "#7a7a80", isle: "#4a4a4e", glow: "#ffffff",
    particles: ["#ffffff", "#d8d8d8", "#a0a0a0", "#f5f5f5"], prop: "tree", bloom: 0.4, dark: true,
  },
};

export const THEME_LIST: ThemeId[] = ["frutiger", "eco", "aero", "liquid", "y2k", "win98", "vapor", "techno", "aqua", "sunset", "dreamcore", "cyberpunk", "noir"];

// ---------------------------------------------------------------------------
// Vehicle customization: 23 shapes, 5 wheels, 3 spoilers, 3 boosters,
// 10 boats, 10 aircraft and 11 submarines
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
  { id: "shell", bonus: { speed: -0.3, handling: 1.4 } },
  { id: "board", bonus: { speed: 0.7, handling: 1.2 } },
  { id: "winglet", bonus: { speed: 1.5, handling: 0.0 } },
  { id: "pod", bonus: { speed: 1.7, handling: -0.9 } },
];

export const BODY_COLORS = ["#ff4d6d", "#ff9f1c", "#fde047", "#4ade80", "#22d3ee", "#6366f1", "#f472b6", "#ffffff", "#111827", "#a855f7", "#14b8a6"];
export const DECAL_COLORS = ["#ffffff", "#0ea5e9", "#facc15", "#f472b6", "#22c55e", "#111827", "#ff4fd8"];
export const WHEEL_STYLES: WheelStyle[] = ["classic", "sporty", "glow", "chrome", "spike"];
export const SPOILERS: SpoilerId[] = ["none", "wing", "fin"];
export const FINISHES: FinishId[] = ["solid", "gloss", "matte", "chrome", "glass", "holo"];
export const FINISH_META: Record<FinishId, { swatch: string; labelKey: string }> = {
  solid: { swatch: "#8fa3c8", labelKey: "fin_solid" },
  gloss: { swatch: "#2f7fd1", labelKey: "fin_gloss" },
  matte: { swatch: "#4b5563", labelKey: "fin_matte" },
  chrome: { swatch: "#dfe9f5", labelKey: "fin_chrome" },
  glass: { swatch: "#9fe8ff", labelKey: "fin_glass" },
  holo: { swatch: "#ff9ee0", labelKey: "fin_holo" },
};
export const BOOSTERS: BoosterId[] = ["single", "twin", "neon"];
export const BOATS: BoatId[] = ["cat", "speed", "ski", "yacht", "tug", "raft", "hovercraft", "airboat", "viking", "duck"];
export const PLANES: PlaneId[] = ["wing", "bi", "delta", "stealth", "jetliner", "twinprop", "nimbus", "heli", "blimp", "saucer"];
export const HOVERS: HoverId[] = ["maglev", "disc", "nacelle", "magboard", "gyro"];
export const SUBS: SubId[] = ["classic", "pod", "shark", "diver", "dredger", "sleuth", "leviathan", "manta", "squid", "bathy", "torpedo"];

/**
 * Per-craft speed and handling, taken from the second lineage and extended to every
 * craft here. speed scales the top speed in that mode, handling scales turn rate.
 */
export interface CraftStat {
  id: BoatId | PlaneId | SubId | HoverId;
  speed: number;
  handling: number;
}

export const BOAT_STATS: CraftStat[] = [
  { id: "cat", speed: 0.92, handling: 0.95 },
  { id: "speed", speed: 1.22, handling: 0.9 },
  { id: "ski", speed: 1.1, handling: 1.15 },
  { id: "yacht", speed: 1.12, handling: 1.05 },
  { id: "tug", speed: 0.82, handling: 1.0 },
  { id: "raft", speed: 0.95, handling: 1.4 },
  { id: "hovercraft", speed: 1.3, handling: 1.15 },
  { id: "airboat", speed: 1.26, handling: 0.84 },
  { id: "viking", speed: 0.88, handling: 1.08 },
  { id: "duck", speed: 0.9, handling: 1.32 },
];

export const PLANE_STATS: CraftStat[] = [
  { id: "wing", speed: 1.0, handling: 1.0 },
  { id: "bi", speed: 0.9, handling: 1.2 },
  { id: "delta", speed: 1.12, handling: 0.9 },
  { id: "stealth", speed: 1.05, handling: 1.1 },
  { id: "jetliner", speed: 1.35, handling: 0.82 },
  { id: "twinprop", speed: 0.85, handling: 1.3 },
  { id: "nimbus", speed: 1.18, handling: 1.22 },
  { id: "heli", speed: 0.88, handling: 1.36 },
  { id: "blimp", speed: 0.8, handling: 1.12 },
  { id: "saucer", speed: 1.08, handling: 1.26 },
];

export const SUB_STATS: CraftStat[] = [
  { id: "classic", speed: 1.05, handling: 1.0 },
  { id: "pod", speed: 0.95, handling: 1.05 },
  { id: "shark", speed: 1.18, handling: 0.85 },
  { id: "diver", speed: 1.0, handling: 1.15 },
  { id: "dredger", speed: 0.8, handling: 0.95 },
  { id: "sleuth", speed: 0.92, handling: 1.35 },
  { id: "leviathan", speed: 1.4, handling: 0.72 },
  { id: "manta", speed: 1.06, handling: 1.28 },
  { id: "squid", speed: 1.14, handling: 1.1 },
  { id: "bathy", speed: 0.84, handling: 1.2 },
  { id: "torpedo", speed: 1.36, handling: 0.76 },
];

export const HOVER_STATS: CraftStat[] = [
  { id: "maglev", speed: 1.0, handling: 1.0 },
  { id: "disc", speed: 0.92, handling: 1.3 },
  { id: "nacelle", speed: 1.2, handling: 0.82 },
  { id: "magboard", speed: 1.08, handling: 1.15 },
  { id: "gyro", speed: 0.96, handling: 1.22 },
];

const CRAFT_SPEEDS: Record<string, number> = {};
const CRAFT_HANDLING: Record<string, number> = {};
for (const t of [...BOAT_STATS, ...PLANE_STATS, ...SUB_STATS, ...HOVER_STATS]) {
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
  "freeze", "steal", "popup", "giant", "warp",
];

/** drop weights inside item boxes (rarer = stronger) */
export const WEAPON_WEIGHTS: Record<WeaponId, number> = {
  orb: 20, missile: 16, bubble: 12, slime: 10, beam: 9, zap: 9, mine: 7, wave: 5,
  swap: 4, magnet: 8, ghost: 7, quake: 5, freeze: 7, steal: 6, popup: 6, giant: 4, warp: 5,
};

/**
 * How an item's odds lean with race position: positive favours whoever is at
 * the back, negative whoever is in front. The leader gets things to defend
 * with, the tail of the field gets things to catch up with.
 */
const WEAPON_LEAN: Record<WeaponId, number> = {
  orb: 0.5, missile: 0.9, bubble: -0.8, slime: -0.9, beam: 0.6, zap: 1, mine: -1, wave: 0,
  swap: 1, magnet: 0.3, ghost: 0.2, quake: 0.8, freeze: 0.7, steal: 0.5, popup: 0.4, giant: 1, warp: 1,
};

/** Draw an item. `behind` is 0 for the leader and 1 for the last racer. */
export function rollWeapon(behind = 0.5): WeaponId {
  const lean = (behind - 0.5) * 2;
  const weight = (w: WeaponId) => WEAPON_WEIGHTS[w] * Math.max(0.08, 1 + WEAPON_LEAN[w] * lean);
  let total = 0;
  for (const w of WEAPONS) total += weight(w);
  let r = Math.random() * total;
  for (const w of WEAPONS) {
    r -= weight(w);
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
  zap: { glyph: "ϟ", color: "#ffe066", glow: "#fff6c2" },
  mine: { glyph: "✱", color: "#ff7b3d", glow: "#ffc29b" },
  wave: { glyph: "≋", color: "#22d3ee", glow: "#b5f4ff" },
  swap: { glyph: "⇅", color: "#f472b6", glow: "#ffd1ec" },
  magnet: { glyph: "∪", color: "#fb923c", glow: "#ffd9b0" },
  ghost: { glyph: "◌", color: "#e0e7ff", glow: "#ffffff" },
  quake: { glyph: "☲", color: "#a16207", glow: "#fde68a" },
  freeze: { glyph: "❄", color: "#7dd3fc", glow: "#e0f2fe" },
  steal: { glyph: "⤺", color: "#a78bfa", glow: "#ddd6fe" },
  popup: { glyph: "▣", color: "#94a3b8", glow: "#e2e8f0" },
  giant: { glyph: "⬆", color: "#f97316", glow: "#fed7aa" },
  warp: { glyph: "⟫", color: "#2dd4bf", glow: "#99f6e4" },
};

// ---------------------------------------------------------------------------
// Fusion turrets: one shot per character, and no two alike. `kind` is how it
// leaves the turret, `effect` what it does to whoever it hits.
// ---------------------------------------------------------------------------

/**
 * bolt: straight shots at the target. homing: a shot that follows it. fan: a
 * spread. rear: fired backwards at whoever is chasing. lance: an instant beam.
 * nova: a burst all around the kart. mortar: dropped in the target's path.
 */
export type ShotKind = "bolt" | "homing" | "fan" | "rear" | "lance" | "nova" | "mortar";
/**
 * stun: stops it briefly. spin: spins it out. slow: drags it. freeze: stops it
 * dead. drain: takes its speed for the shooter. shove: knocks it sideways.
 * lift: throws it in the air. coins: takes its coins. steal: takes its item.
 * blind: covers its view. burn: saps its speed for a while. tug: hauls it back.
 */
export type ShotEffect = "stun" | "spin" | "slow" | "freeze" | "drain" | "shove" | "lift" | "coins" | "steal" | "blind" | "burn" | "tug";

export interface FusionShot {
  name: string;
  kind: ShotKind;
  effect: ShotEffect;
  color: string;
  /** seconds between volleys */
  rate: number;
  /** shots per volley */
  count: number;
  /** strength of the effect, about 0.6 to 1.4 */
  power: number;
}

export const FUSION_SHOTS: Record<string, FusionShot> = {
  nova: { name: "SPLASH", kind: "bolt", effect: "slow", color: "#22d3ee", rate: 0.7, count: 2, power: 0.8 },
  blip: { name: "STARSHOT", kind: "homing", effect: "spin", color: "#fde047", rate: 1.2, count: 1, power: 1 },
  mochi: { name: "MOCHI BOMB", kind: "mortar", effect: "slow", color: "#f9a8d4", rate: 1.3, count: 1, power: 1.3 },
  kori: { name: "ICE LANCE", kind: "lance", effect: "freeze", color: "#a5b4fc", rate: 1.6, count: 1, power: 1 },
  zepp: { name: "LEAF STORM", kind: "fan", effect: "shove", color: "#4ade80", rate: 1.2, count: 5, power: 0.9 },
  pixl: { name: "GLITCH", kind: "homing", effect: "blind", color: "#c084fc", rate: 1.7, count: 1, power: 1 },
  fizz: { name: "BUBBLE TRAP", kind: "bolt", effect: "lift", color: "#38bdf8", rate: 1.1, count: 1, power: 1 },
  brum: { name: "FIREBALL", kind: "bolt", effect: "burn", color: "#fb923c", rate: 0.95, count: 1, power: 1.1 },
  lumo: { name: "PRISM BEAM", kind: "lance", effect: "drain", color: "#67e8f9", rate: 1.2, count: 1, power: 1 },
  tiko: { name: "FLAME FAN", kind: "fan", effect: "burn", color: "#f87171", rate: 1.0, count: 3, power: 0.8 },
  sola: { name: "SOLAR FLARE", kind: "nova", effect: "blind", color: "#fbbf24", rate: 2.0, count: 1, power: 1.1 },
  nixe: { name: "DATA LEECH", kind: "homing", effect: "steal", color: "#34d399", rate: 1.9, count: 1, power: 1 },
  yuki: { name: "SNOWBALL", kind: "bolt", effect: "freeze", color: "#c7e4ff", rate: 1.4, count: 1, power: 0.8 },
  taro: { name: "ACORN", kind: "mortar", effect: "spin", color: "#fdba74", rate: 1.5, count: 1, power: 1 },
  vexa: { name: "SHARD BURST", kind: "fan", effect: "stun", color: "#f472b6", rate: 1.1, count: 3, power: 0.9 },
  rook: { name: "THUNDERCLOUD", kind: "nova", effect: "stun", color: "#a78bfa", rate: 2.2, count: 1, power: 1.2 },
  pepa: { name: "POP", kind: "rear", effect: "shove", color: "#c4b5fd", rate: 0.9, count: 2, power: 1 },
  kiko: { name: "TIDE PULL", kind: "lance", effect: "tug", color: "#5eead4", rate: 1.3, count: 1, power: 1 },
  onyx: { name: "GRAVITY WELL", kind: "nova", effect: "tug", color: "#4f6bff", rate: 2.0, count: 1, power: 1.1 },
  pipi: { name: "COIN SNATCH", kind: "homing", effect: "coins", color: "#fb7185", rate: 1.0, count: 1, power: 1 },
  aquos: { name: "WAKE", kind: "rear", effect: "slow", color: "#0ea5e9", rate: 1.0, count: 2, power: 1 },
  ember: { name: "METEOR", kind: "mortar", effect: "burn", color: "#f59e0b", rate: 1.4, count: 1, power: 1.2 },
  mist: { name: "FOG BANK", kind: "rear", effect: "blind", color: "#a5f3fc", rate: 1.8, count: 1, power: 1 },
  terra: { name: "ROCKSLIDE", kind: "rear", effect: "spin", color: "#84cc16", rate: 1.5, count: 3, power: 0.9 },
  prism: { name: "RAINBOW RAIL", kind: "lance", effect: "lift", color: "#e879f9", rate: 1.3, count: 1, power: 1 },
  cobalt: { name: "TWIN CANNON", kind: "bolt", effect: "spin", color: "#2b5cff", rate: 0.85, count: 2, power: 0.8 },
  kiwi: { name: "SEED SPRAY", kind: "fan", effect: "coins", color: "#c6ff4f", rate: 1.0, count: 4, power: 0.8 },
  magma: { name: "ERUPTION", kind: "nova", effect: "burn", color: "#ff2d00", rate: 1.9, count: 1, power: 1.3 },
};

/**
 * The shot a character fires, as the craft it is riding fires it. The effect
 * and the colour are the character's; how it leaves the turret is the craft's.
 */
export function fusionShot(charId: string, mode: VehicleMode = "land"): FusionShot {
  const base = FUSION_SHOTS[charId] ?? FUSION_SHOTS.nova;
  const round = base.kind === "nova";
  switch (mode) {
    case "boat":
      // a broadside: more of them, spread wide, each a little weaker
      return { ...base, kind: round || base.kind === "lance" ? base.kind : "fan", count: base.count + 2, power: base.power * 0.8 };
    case "plane":
      // from the air everything is guided, and slower to load
      return { ...base, kind: round || base.kind === "lance" ? base.kind : "homing", rate: base.rate * 1.2 };
    case "sub":
      // a torpedo: one, slow to load, finds its target and hits hard
      return { ...base, kind: round ? "nova" : "homing", count: 1, power: base.power * 1.45, rate: base.rate * 1.5 };
    case "hover":
      // a magnetic pulse: instant, lighter, and ready again at once
      return { ...base, kind: round ? "nova" : "lance", count: 1, power: base.power * 0.8, rate: base.rate * 0.7 };
    default:
      return base;
  }
}

// ---------------------------------------------------------------------------
// What each garage part does. Nothing in the garage is only for looks except
// the paint and the finish.
// ---------------------------------------------------------------------------

export interface PartEffect {
  /** top speed, acceleration and turning, as multipliers */
  speed?: number;
  accel?: number;
  turn?: number;
  /** how fast a drift charges its mini-turbo */
  drift?: number;
  /** how fast the turbo bar fills */
  turbo?: number;
  /** how long and how strong a boost is */
  boostTime?: number;
  boostPower?: number;
  /** share of the slowdown from slime, mines and hits that gets through */
  grip?: number;
}

export const WHEEL_EFFECTS: Record<WheelStyle, PartEffect> = {
  classic: {},
  sporty: { accel: 1.08 },
  glow: { turbo: 1.25 },
  chrome: { speed: 1.03 },
  spike: { turn: 1.06, grip: 0.6 },
};

export const SPOILER_EFFECTS: Record<SpoilerId, PartEffect> = {
  none: { speed: 1.015 },
  wing: { turn: 1.08, speed: 0.985 },
  fin: { drift: 1.2 },
};

export const BOOSTER_EFFECTS: Record<BoosterId, PartEffect> = {
  single: { boostTime: 1.15 },
  twin: { boostPower: 1.06 },
  neon: { turbo: 1.3 },
};

/** The effect of a part as short labels for the garage: [name of the stat as an i18n key, signed percentage]. */
export function partLabels(e: PartEffect): [string, string][] {
  const out: [string, string][] = [];
  const pct = (v: number) => `${v >= 1 ? "+" : "−"}${Math.abs(Math.round((v - 1) * 1000) / 10)}%`;
  if (e.speed) out.push(["speed", pct(e.speed)]);
  if (e.accel) out.push(["accel", pct(e.accel)]);
  if (e.turn) out.push(["handling", pct(e.turn)]);
  if (e.drift) out.push(["drift", pct(e.drift)]);
  if (e.turbo) out.push(["turboBtn", pct(e.turbo)]);
  if (e.boostTime) out.push(["turboBtn", pct(e.boostTime)]);
  if (e.boostPower) out.push(["turboBtn", pct(e.boostPower)]);
  if (e.grip) out.push(["weight", pct(2 - e.grip)]);
  return out;
}

// ---------------------------------------------------------------------------
// Race modes
// ---------------------------------------------------------------------------

export interface GameMode {
  id: "quick" | "trial" | "chaos" | "sprint" | "duel" | "endurance";
  laps: number;
  aiCount: number;
  itemsEnabled: boolean;
  itemFrequency: number;
  rubberband: number;
}

// ---------------------------------------------------------------------------
// AI skill tiers: the opponents are tuned from a rolling beginner up to a
// rubberband cheat that still brakes for corners.
// ---------------------------------------------------------------------------

export type AiSkillId = "rookie" | "amateur" | "pro" | "ace";

/**
 * A difficulty level. Every level drives properly: takes the inside of a bend,
 * goes round traffic and hazards, drifts, fires its turbo on a straight and
 * uses each item for what it is for. What changes with the level is how hard
 * it pushes, how much it gets out of each of those, and how it treats you.
 */
export interface AiProfile {
  id: AiSkillId;
  name: string;
  /** top speed and acceleration, as a share of the kart's own */
  pace: number;
  accel: number;
  /** how much of the road's width it uses to straighten a bend, 0..1 */
  line: number;
  /** how sharp a bend has to be (radians over the next 55 units) before it drifts */
  driftFrom: number;
  /** seconds it holds a drift: under 0.85 it only ever gets the small mini-turbo */
  driftHold: number;
  /** turbo bar level at which it fires */
  turboAt: number;
  /** seconds it takes to decide what to do with an item */
  itemDelay: number;
  /** seconds a racer who has just been hit is left alone */
  mercy: number;
  /** chance to take an alternate route at a junction, and a risky cut with no barriers */
  routeUse: number;
  cutUse: number;
  /** speed it gains while you are ahead of it, and gives up while you are behind */
  catchUp: number;
  wait: number;
  /** seconds late off the line */
  reaction: number;
  /** hesitations per second: a lift of the throttle, never a swerve */
  hesitate: number;
  /** chance per second to fuse with its partner when it has someone to shoot at */
  fuse: number;
}

export const AI_PROFILES: Record<AiSkillId, AiProfile> = {
  rookie: { id: "rookie", name: "FÁCIL", pace: 0.9, accel: 0.9, line: 0.55, driftFrom: 0.9, driftHold: 0.5, turboAt: 1, itemDelay: 2.2, mercy: 10, routeUse: 0.35, cutUse: 0.03, catchUp: 0.02, wait: 0.14, reaction: 0.7, hesitate: 0.05, fuse: 0.03 },
  amateur: { id: "amateur", name: "NORMAL", pace: 0.96, accel: 0.96, line: 0.7, driftFrom: 0.7, driftHold: 0.95, turboAt: 0.8, itemDelay: 1.3, mercy: 5, routeUse: 0.5, cutUse: 0.12, catchUp: 0.07, wait: 0.08, reaction: 0.4, hesitate: 0.025, fuse: 0.08 },
  pro: { id: "pro", name: "DIFÍCIL", pace: 1, accel: 1, line: 0.82, driftFrom: 0.55, driftHold: 1.2, turboAt: 0.6, itemDelay: 0.7, mercy: 1.5, routeUse: 0.65, cutUse: 0.3, catchUp: 0.12, wait: 0.03, reaction: 0.15, hesitate: 0.008, fuse: 0.15 },
  ace: { id: "ace", name: "EXPERTO", pace: 1.05, accel: 1.06, line: 0.9, driftFrom: 0.45, driftHold: 1.5, turboAt: 0.45, itemDelay: 0.4, mercy: 0, routeUse: 0.75, cutUse: 0.5, catchUp: 0.18, wait: 0, reaction: 0, hesitate: 0, fuse: 0.25 },
};

export const AI_SKILL_LIST: AiSkillId[] = ["rookie", "amateur", "pro", "ace"];

export type ModeId = "quick" | "trial" | "chaos" | "sprint" | "duel" | "endurance";

export const MODES: Record<ModeId, GameMode> = {
  quick: { id: "quick", laps: 3, aiCount: 5, itemsEnabled: true, itemFrequency: 1, rubberband: 1 },
  trial: { id: "trial", laps: 3, aiCount: 0, itemsEnabled: false, itemFrequency: 0, rubberband: 0 },
  chaos: { id: "chaos", laps: 4, aiCount: 7, itemsEnabled: true, itemFrequency: 1.7, rubberband: 1.35 },
  sprint: { id: "sprint", laps: 1, aiCount: 7, itemsEnabled: true, itemFrequency: 1.3, rubberband: 1.1 },
  duel: { id: "duel", laps: 5, aiCount: 1, itemsEnabled: true, itemFrequency: 1.2, rubberband: 1.5 },
  endurance: { id: "endurance", laps: 8, aiCount: 8, itemsEnabled: true, itemFrequency: 1.5, rubberband: 1.25 },
};

// ---------------------------------------------------------------------------
// Tracks: 10 circuits. zones order is always [water, sky, sub?].
// forks = two-lane sections, branches = real side roads that peel off and rejoin.
// ---------------------------------------------------------------------------

export interface Zone {
  t0: number;
  t1: number;
  type: ZoneKind;
}

/** "mag" is a magnetic stretch: the road is still there, and everything on it levitates */
export type ZoneKind = "water" | "sky" | "sub" | "mag";


/** A branch is an alternate ribbon that peels off the main road and rejoins it. */
export interface Branch {
  t0: number;
  t1: number;
  pull: number; // lateral displacement at peak (+ = right of travel direction)
  /** how much the side road climbs at its peak; it merges level with the main road */
  rise?: number;
  /** scenery flavour of this side road; defaults to the circuit's biome */
  biome?: string;
}

/**
 * A real hole in the road: a built-up launch ramp, a cliff edge, a pit floor and
 * a far wall. Slow enough and you drop in; fast enough and you clear it.
 */
export interface GapDef {
  t0: number;
  t1: number;
  /** how high the ramp climbs before the lip */
  ramp: number;
  /** how far below the tarmac the pit floor sits */
  pit: number;
}

export interface TrapDef {
  t: number;
  side: number;
  kind: "spike" | "bar";
  speed: number;
  phase: number;
  active: boolean;
}

/**
 * An alternate road with its own shape in 3D. It leaves the main loop at lap
 * progress t0 and rejoins it at t1; in between it can climb over the main road,
 * dive under it or take a different way round.
 */
export interface RouteDef {
  t0: number;
  t1: number;
  /** control points between the two junctions, in world units */
  points: [number, number, number][];
  /** full width of the tarmac, 14 by default */
  width?: number;
  /** false leaves the edges open: run wide and you fall */
  walls?: boolean;
  /** stretches with no tarmac at all, as fractions of the route */
  holes?: [number, number][];
  /** height of the launch lip before each hole */
  kick?: number;
  /** covered road, dressed with arches */
  tunnel?: boolean;
  /** internal: an old lateral side road converted on load */
  legacy?: Branch;
  /** what the road is, for its colour, its signpost and the map: over, under, a risky cut, a lane beside */
  kind?: RouteKind;
  /** not a road: a second channel on the sea, flight line in the air or tunnel under water, like the stretch it leaves */
  afloat?: boolean;
}

export type RouteKind = "high" | "low" | "cut" | "side";

/** A stretch of the lap with its own aesthetic, starting at lap progress t0. */
export interface SectorDef {
  t0: number;
  theme: ThemeId;
}

/** Something on the tarmac that acts on whoever drives over it. */
export interface PadDef {
  /** lap progress on the main loop, or fraction of the route when `route` is set */
  t: number;
  /** index into `routes`; the main loop when omitted */
  route?: number;
  /** metres off the centre line */
  lat?: number;
  kind: "boost" | "jump" | "cannon";
  /** boost: speed multiplier. jump: upward speed in units per second */
  power?: number;
  /** cannon: lap progress on the main loop where it sets you down, and how high the shot arcs */
  toT?: number;
  lift?: number;
}

export interface PortalDef {
  tIn: number;
  tOut: number;
  side: number;
  cd: number;
}

/** Landscape flavour of a stretch of circuit. A lap changes scenery as it goes. */
export type BiomeId =
  | "meadow" | "forest" | "desert" | "snow" | "coast"
  | "volcano" | "city" | "ruins" | "reef" | "cloud";

export interface BiomeStyle {
  name: string;
  /** ground colour right beside the road */
  ground: string;
  /** ground colour out at the horizon */
  far: string;
  /** what grows here */
  prop: "rock" | "tuft" | "crystal" | "tree" | "pine" | "cactus" | "coral" | "tower";
  propColor: string;
  /** 0..1, how busy the verge is */
  density: number;
  /** fog and horizon tint for this stretch */
  fog: string;
  fogNear?: number;
  fogFar?: number;
  skyTop?: string;
  skyBottom?: string;
}

export const BIOMES: Record<BiomeId, BiomeStyle> = {
  meadow: { name: "Pradera", ground: "#6fbf4a", far: "#3f8f34", prop: "tuft", propColor: "#8fd85f", density: 0.7, fog: "#bfe6a8", fogNear: 80, fogFar: 290, skyTop: "#8fe0a8", skyBottom: "#f4ffe0" },
  forest: { name: "Bosque", ground: "#3d7a34", far: "#20491f", prop: "tree", propColor: "#2f6b2a", density: 1, fog: "#9ec98d", fogNear: 70, fogFar: 280, skyTop: "#7fb87f", skyBottom: "#e2f2e0" },
  desert: { name: "Desierto", ground: "#dcb46a", far: "#b98b45", prop: "cactus", propColor: "#4f8f4a", density: 0.5, fog: "#f0d9a6", fogNear: 90, fogFar: 320, skyTop: "#f3c07a", skyBottom: "#ffe6c2" },
  snow: { name: "Nieve", ground: "#e8f2f8", far: "#b9cede", prop: "pine", propColor: "#2f6b52", density: 0.6, fog: "#dcecf7", fogNear: 90, fogFar: 340, skyTop: "#d9eaff", skyBottom: "#f5fbff" },
  coast: { name: "Costa", ground: "#e8d7a8", far: "#c9b384", prop: "rock", propColor: "#b9a37c", density: 0.6, fog: "#cfe9f2", fogNear: 80, fogFar: 290, skyTop: "#a9d8e8", skyBottom: "#e6f4f8" },
  volcano: { name: "Volcán", ground: "#4a3b38", far: "#241b1a", prop: "rock", propColor: "#6b4a42", density: 0.8, fog: "#8a5a48", fogNear: 60, fogFar: 240, skyTop: "#5a403a", skyBottom: "#8a5848" },
  city: { name: "Ciudad", ground: "#8e97a8", far: "#5c6474", prop: "tower", propColor: "#7b8698", density: 0.9, fog: "#b9c6d8", fogNear: 70, fogFar: 280, skyTop: "#c9d6e6", skyBottom: "#eef3f8" },
  ruins: { name: "Ruinas", ground: "#a99b86", far: "#7b7160", prop: "crystal", propColor: "#9ad6d0", density: 0.7, fog: "#c9bda6", fogNear: 80, fogFar: 290, skyTop: "#d8ccc2", skyBottom: "#f0eae2" },
  reef: { name: "Arrecife", ground: "#2f7f96", far: "#14566b", prop: "coral", propColor: "#ff8fb1", density: 1, fog: "#4fb3c9", fogNear: 70, fogFar: 250, skyTop: "#4fd8e8", skyBottom: "#d9fbff" },
  cloud: { name: "Nubes", ground: "#dfe9f7", far: "#b9c9e6", prop: "crystal", propColor: "#ffffff", density: 0.4, fog: "#e6eefc", fogNear: 90, fogFar: 340, skyTop: "#f2f7ff", skyBottom: "#ffffff" },
};

export interface BiomeDef {
  id: BiomeId;
  t0: number;
  t1: number;
}

export interface TrackDef {
  id: string;
  points: [number, number, number][];
  zones: Zone[];
  forks: [number, number][];
  branches: Branch[];
  hazards: number;
  difficulty: 1 | 2 | 3;
  relief?: ReliefDef;
  /** aesthetic this circuit is built around; the garage pick can still override it */
  theme: ThemeId;
  /** stretches of landscape; a lap changes place as it goes */
  biomes?: BiomeDef[];
  /** nothing under the circuit: a sky or open-water circuit with no terrain ribbon */
  noGround?: boolean;
  /** every road runs down a corridor, with walls and a ceiling */
  indoor?: boolean;
  portals?: PortalDef[];
  traps?: TrapDef[];
  gaps?: GapDef[];
  /** hand-built alternate roads; when present the old `branches` are ignored */
  routes?: RouteDef[];
  /** full width of the main road, TRACK_WIDTH by default */
  width?: number;
  /** wider stretches of the main road: [t0, t1, halfWidth] */
  widths?: [number, number, number][];
  /** stretches of the main road with no barriers */
  open?: [number, number][];
  /** stretches of the main road with no tarmac: jumps */
  holes?: [number, number][];
  /** height of the launch lip before each hole */
  kick?: number;
  pads?: PadDef[];
  /** drawn at real scale by hand: skip the length normalisation and the generators */
  designed?: boolean;
  /** height of a flat floor under an elevated circuit; the road stands on pillars */
  floor?: number;
  /** height of the sea. Boat stretches ride on it, submarine stretches go under it */
  sea?: number;
  /** the aesthetics the lap passes through, in order; the first starts at the line */
  sectors?: SectorDef[];
  /** slow traffic on the plain stretches of road */
  traffic?: number;
}

/** Vertical profile of a circuit, written as harmonics of the loop angle. */
export interface ReliefDef {
  /** peak height of the terrain the road rides on, in world units */
  amp: number;
  /** [frequency, amplitude, phase] triples, amplitudes normalised so the sum spans about -1..1 */
  waves: [number, number, number][];
}

/** Height of the terrain at loop angle th. Never negative: the road stays above the sea. */
export function reliefY(th: number, relief?: ReliefDef): number {
  if (!relief) return 0;
  let sum = 0;
  for (const [f, a, p] of relief.waves) sum += a * Math.sin(f * th + p);
  const clamped = Math.min(1, Math.max(-1, sum));
  return relief.amp * (0.5 + 0.5 * clamped);
}

/** Default scenery chain per aesthetic: every lap crosses four different places. */
const THEME_BIOMES: Record<ThemeId, BiomeId[]> = {
  frutiger: ["meadow", "forest", "coast", "meadow"],
  eco: ["forest", "meadow", "snow", "forest"],
  aero: ["cloud", "city", "meadow", "cloud"],
  techno: ["city", "ruins", "volcano", "city"],
  aqua: ["coast", "reef", "meadow", "coast"],
  sunset: ["desert", "coast", "meadow", "desert"],
  y2k: ["city", "cloud", "meadow", "city"],
  liquid: ["coast", "reef", "cloud", "coast"],
  win98: ["city", "meadow", "city", "meadow"],
  vapor: ["city", "ruins", "cloud", "city"],
  dreamcore: ["cloud", "meadow", "ruins", "cloud"],
  cyberpunk: ["city", "volcano", "ruins", "city"],
  noir: ["city", "ruins", "snow", "city"],
  backrooms: ["ruins", "city", "ruins", "city"],
  liminal: ["cloud", "coast", "cloud", "snow"],
  eden: ["meadow", "meadow", "forest", "meadow"],
  metro: ["city", "ruins", "city", "ruins"],
  tux: ["snow", "coast", "snow", "cloud"],
  debian: ["cloud", "meadow", "cloud", "ruins"],
  arch: ["snow", "city", "snow", "cloud"],
  mac: ["cloud", "coast", "city", "cloud"],
  slime: ["meadow", "reef", "coast", "meadow"],
  webcore: ["city", "meadow", "city", "ruins"],
};

/** Biome of the stretch at t, and how far we are into the next one. */
export function biomeMix(t: number): { a: BiomeStyle; b: BiomeStyle; u: number } {
  const trk = getActiveTrackForBiomes();
  const tt = ((t % 1) + 1) % 1;
  const list = trk.biomes ?? [];
  if (!list.length) {
    const one = BIOMES.meadow;
    return { a: one, b: one, u: 0 };
  }
  for (let i = 0; i < list.length; i++) {
    const z = list[i];
    if (tt < z.t0 || tt > z.t1) continue;
    const next = list[(i + 1) % list.length];
    const span = Math.max(1e-4, z.t1 - z.t0);
    // the last 12% of a stretch is the hand-over to the next one
    const u = tt > z.t1 - span * 0.12 ? Math.min(1, (tt - (z.t1 - span * 0.12)) / (span * 0.12)) : 0;
    return { a: BIOMES[z.id], b: BIOMES[next.id], u };
  }
  return { a: BIOMES[list[0].id], b: BIOMES[list[0].id], u: 0 };
}

let biomeTrack: TrackDef | null = null;
/** biomeMix needs the live track; the scene sets it when a circuit loads */
export function setBiomeTrack(trk: TrackDef) {
  biomeTrack = trk;
}
function getActiveTrackForBiomes(): TrackDef {
  if (biomeTrack && !biomeTrack.biomes) biomeTrack.biomes = defaultBiomes(biomeTrack.theme);
  return biomeTrack ?? { biomes: [], theme: "eco" } as unknown as TrackDef;
}

/** Four stretches of scenery from the circuit's aesthetic, rotated per circuit. */
export function defaultBiomes(theme: ThemeId, phase = 0): BiomeDef[] {
  const chain = THEME_BIOMES[theme] ?? THEME_BIOMES.eco;
  const n = chain.length;
  return chain.map((_, i) => {
    const k = (i + phase) % n;
    const t0 = (k / n + phase * 0.07) % 1;
    return { id: chain[k], t0, t1: (t0 + 1 / n) % 1 || 1 };
  }).sort((a, b) => a.t0 - b.t0);
}

// The circuits themselves are drawn in tracks.ts with the designer in trackDesign.ts.
export const TRACKS: TrackDef[] = DESIGNED_TRACKS;

/**
 * Per-lap mutation. A race never looks the same twice: every lap rotates the
 * palette by a different step and re-lights the scene, so the track you learned
 * on lap one is a different place on lap three.
 */
export function mutateTheme(base: ThemeDef, lap: number): ThemeDef {
  const step = ((lap % MUTATION_STEPS) + MUTATION_STEPS) % MUTATION_STEPS;
  if (step === 0) return base;
  const hue = (step / MUTATION_STEPS) * 360;
  // a lap may be a little dimmer than the first, never dark
  const dim = 0.95 + 0.05 * Math.cos((step / MUTATION_STEPS) * Math.PI * 2);
  const rot = (c: string, d: number) => shiftColor(c, hue, d, dim);
  return {
    ...base,
    skyTop: rot(base.skyTop, -0.05),
    skyBottom: rot(base.skyBottom, 0.1),
    fog: rot(base.fog, 0.05),
    water: rot(base.water, 0.16),
    ground: rot(base.ground, -0.12),
    road: rot(base.road, 0.06),
    roadLine: rot(base.roadLine, 0.2),
    roadEdge: rot(base.roadEdge, 0.04),
    barrierA: rot(base.barrierA, 0.22),
    barrierB: rot(base.barrierB, 0.3),
    sun: rot(base.sun, 0.08),
    sunIntensity: base.sunIntensity * dim,
    ambient: base.ambient * dim,
    ambientColor: rot(base.ambientColor, 0.04),
    hemiSky: rot(base.hemiSky, 0.12),
    hemiGround: rot(base.hemiGround, -0.1),
    cloud: rot(base.cloud, 0.02),
    isle: rot(base.isle, -0.08),
    glow: rot(base.glow, 0.26),
    particles: base.particles.map((c, i) => rot(c, 0.18 + i * 0.14)),
    prop: MUTATION_PROPS[step % MUTATION_PROPS.length],
    bloom: base.bloom * dim,
  };
}

const themeCache = new Map<string, ThemeDef>();
/** An aesthetic as it looks on a given lap. Cached: this is asked for every frame. */
export function themeOnLap(id: ThemeId, lap: number): ThemeDef {
  const step = ((lap % MUTATION_STEPS) + MUTATION_STEPS) % MUTATION_STEPS;
  const key = id + ":" + step;
  let t = themeCache.get(key);
  if (!t) themeCache.set(key, (t = mutateTheme(THEMES[id], step)));
  return t;
}

/** The landscape that goes with each aesthetic, for the ground clutter of its stretch. */
export const THEME_BIOME: Record<ThemeId, BiomeId> = {
  frutiger: "meadow", eco: "forest", aero: "cloud", techno: "city", aqua: "reef", sunset: "desert",
  y2k: "city", liquid: "coast", win98: "city", vapor: "ruins", dreamcore: "cloud", cyberpunk: "volcano", noir: "ruins",
  backrooms: "ruins", liminal: "cloud", eden: "meadow",
  metro: "city", tux: "snow", debian: "cloud", arch: "snow", mac: "cloud", slime: "meadow", webcore: "city",
};

const MUTATION_STEPS = 6;
const MUTATION_PROPS: ThemeDef["prop"][] = ["palm", "crystal", "tree", "cactus", "coral", "y2k", "circuit", "liquid", "vapor"];

/**
 * Rotates hue and nudges saturation, working on #rrggbb. The colour keeps the
 * brightness the eye sees: a teal sky turned to blue is lightened until it is
 * as bright as the teal was, instead of going to near black.
 */
function shiftColor(hex: string, hue: number, sat: number, dim: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const luma = (x: number, y: number, z: number) => 0.2126 * x + 0.7152 * y + 0.0722 * z;
  const [h, s0, l] = hexToHsl(hex.startsWith("#") ? hex : "#" + hex);
  const h2 = (((h + hue / 360) % 1) + 1) % 1;
  const s2 = Math.max(0, Math.min(1, s0 + sat));
  const rgbOf = (light: number) => {
    const out = hslToHex(h2, s2, light);
    const k = parseInt(out.slice(1), 16);
    return [((k >> 16) & 255) / 255, ((k >> 8) & 255) / 255, (k & 255) / 255];
  };
  const want = luma(r, g, b) * dim;
  // walk the lightness until the result looks as bright as the original did
  let lo = 0;
  let hi = 1;
  let light = l;
  for (let i = 0; i < 14; i++) {
    light = (lo + hi) / 2;
    const c = rgbOf(light);
    if (luma(c[0], c[1], c[2]) < want) lo = light;
    else hi = light;
  }
  return hslToHex(h2, s2, light);
}

/** Live state for mutating hazards (written by Track, read by the simulation). */
export const hazardState: {
  positions: { x: number; y: number; z: number; t: number }[];
  lap: number;
} = { positions: [], lap: 0 };

export const TRACK_WIDTH = 20;
export const SKY_ALTITUDE = 9;

// Mutable active zones — rewritten by setActiveTrack() in trackCurve.ts
export const ZONES: Zone[] = [...TRACKS[0].zones];

/** First zone of a given kind. Circuits do not all declare their zones in the same order. */
export function zoneOfKind(kind: ZoneKind): Zone | null {
  return ZONES.find((z) => z.type === kind) ?? null;
}

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
  racers: { x: number; y: number; z: number; color: string; isPlayer: boolean; mode: VehicleMode; t: number }[];
  camAngle: number;
  theme: ThemeDef;
} = { racers: [], camAngle: 0, theme: THEMES.frutiger };
