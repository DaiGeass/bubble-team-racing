import { CHARACTERS, FUSION_SHOTS, THEMES, type CharacterDef, type EyeStyle, type FormId, type FusionShot, type RoleId, type ShotEffect, type ShotKind, type ThemeDef, type ThemeId, type WeaponId, type ZoneKind, type PadDef } from "./data";
import { design, type DesignSpec, type RouteSpec, type Turtle } from "./trackDesign";
import { registerTrack } from "./rhythm";

// ---------------------------------------------------------------------------
// Mods. A mod is one JSON file that can add circuits (drawn with the same
// turtle commands the built-in ones use), characters and aesthetics. Mods are
// kept in the browser's storage and put into the game as it starts, before
// any screen is drawn. Nothing in a mod is ever run as code: every command is
// checked against a fixed list, and a mod that does not check out is skipped
// with the reason shown in the Mods screen. MODS.md describes the format.
// ---------------------------------------------------------------------------

export type Cmd = [string, ...(string | number)[]];

export interface ModTrack {
  id: string;
  name: string | Record<string, string>;
  theme: string;
  difficulty?: 1 | 2 | 3;
  start?: [number, number, number, number];
  draw: Cmd[];
  zones?: [string, string, ZoneKind][];
  holes?: [string, number][];
  pads?: [string, PadDef["kind"], number?, number?][];
  cannons?: [string, string, number?][];
  portals?: [string, string][];
  sectors?: [string, string][];
  routes?: { from: string; to: string; draw: Cmd[]; kind?: "high" | "low" | "cut" | "side"; width?: number; walls?: boolean; tunnel?: boolean; afloat?: boolean; holes?: [string, number][]; pads?: [string, PadDef["kind"], number?][] }[];
  traffic?: number;
  hazards?: number;
  sea?: number;
  indoor?: boolean;
  warp?: boolean | "soft";
  traps?: boolean;
}

export interface ModCharacter {
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
  shot?: FusionShot;
}

export interface ModTheme extends Partial<Omit<ThemeDef, "id">> {
  id: string;
  name: string;
  base: ThemeId;
}

export interface ModFile {
  format: "btr-mod";
  version: 1;
  id: string;
  name: string;
  author?: string;
  description?: string;
  tracks?: ModTrack[];
  characters?: ModCharacter[];
  themes?: ModTheme[];
}

export interface InstalledMod {
  mod: ModFile;
  enabled: boolean;
}

/** What happened to each mod at start-up: how much of it went in, and what was wrong with the rest. */
export const modReport: Record<string, { tracks: number; characters: number; themes: number; errors: string[] }> = {};
/** Names of modded circuits, for the translation lookup: the same in every language unless the mod says otherwise. */
export const MOD_WORDS: Record<string, Record<string, string>> = {};

const KEY = "btr_mods";

export function loadInstalled(): InstalledMod[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((m) => m && m.mod && typeof m.mod.id === "string") : [];
  } catch {
    return [];
  }
}

export function saveInstalled(list: InstalledMod[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked */
  }
}

const ID = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const COLOUR = /^#[0-9a-fA-F]{6}$/;
const num = (v: unknown, lo: number, hi: number) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
const FORMS: FormId[] = ["drop", "bubble", "leaf", "crystal", "holo", "cloud", "star", "flame", "jelly", "planet", "gear"];
const EYES: EyeStyle[] = ["sparkle", "sharp", "visor", "sleepy"];
const ROLES: RoleId[] = ["speed", "handler", "heavy", "balanced", "trickster", "tech"];
const WEAPONS: WeaponId[] = ["orb", "missile", "bubble", "slime", "beam", "zap", "mine", "wave", "swap", "magnet", "ghost", "quake", "freeze", "steal", "popup", "giant", "warp"];
const KINDS: ShotKind[] = ["bolt", "homing", "fan", "rear", "lance", "nova", "mortar"];
const EFFECTS: ShotEffect[] = ["stun", "spin", "slow", "freeze", "drain", "shove", "lift", "coins", "steal", "blind", "burn", "tug"];

/** Check a parsed file is a mod at all; returns the reason it is not, or null. */
export function checkMod(m: unknown): string | null {
  const mod = m as ModFile;
  if (!mod || typeof mod !== "object") return "not an object";
  if (mod.format !== "btr-mod" || mod.version !== 1) return 'format must be "btr-mod", version 1';
  if (!ID.test(mod.id ?? "")) return "id: lowercase letters, digits, - and _, up to 32";
  if (typeof mod.name !== "string" || !mod.name) return "name missing";
  for (const k of ["tracks", "characters", "themes"] as const) if (mod[k] !== undefined && !Array.isArray(mod[k])) return `${k} must be a list`;
  return null;
}

/** Replay a list of commands on a turtle, refusing anything that is not one of the known ones. */
function run(t: Turtle, cmds: Cmd[], where: string) {
  for (const c of cmds) {
    if (!Array.isArray(c) || typeof c[0] !== "string") throw new Error(`${where}: every command is a list starting with its name`);
    const [op, ...a] = c;
    const n = (i: number, lo: number, hi: number) => {
      if (!num(a[i], lo, hi)) throw new Error(`${where}: ${op} argument ${i + 1} must be a number from ${lo} to ${hi}`);
      return a[i] as number;
    };
    const opt = (i: number, lo: number, hi: number) => (a[i] === undefined ? 0 : n(i, lo, hi));
    const s = (i: number) => {
      if (typeof a[i] !== "string" || !(a[i] as string).length) throw new Error(`${where}: ${op} argument ${i + 1} must be a name`);
      return a[i] as string;
    };
    const lr = (i: number) => {
      if (a[i] !== "L" && a[i] !== "R") throw new Error(`${where}: ${op} side must be "L" or "R"`);
      return a[i] as "L" | "R";
    };
    switch (op) {
      case "go": t.go(n(0, 1, 5000), opt(1, -200, 200)); break;
      case "toY": t.toY(n(0, 1, 5000), n(1, -100, 300)); break;
      case "left": t.left(n(0, 1, 1440), n(1, 20, 2000), opt(2, -200, 200)); break;
      case "right": t.right(n(0, 1, 1440), n(1, 20, 2000), opt(2, -200, 200)); break;
      case "mark": t.mark(s(0)); break;
      case "drop": t.drop(n(0, -40, -2)); break;
      case "weave": t.weave(lr(0), n(1, 5, 80), n(2, 20, 1000), opt(3, -100, 100)); break;
      case "bypass": t.bypass(lr(0), n(1, 20, 3000), n(2, -30, 30), opt(3, -200, 200)); break;
      case "flex": t.flex(s(0), n(1, 20, 5000), opt(2, -200, 200)); break;
      case "cut": t.cut(lr(0), n(1, 10, 1000), a[2] === undefined ? 30 : n(2, 15, 200), opt(3, -100, 100)); break;
      default: throw new Error(`${where}: unknown command "${op}"`);
    }
  }
}

function addTheme(th: ModTheme) {
  if (!ID.test(th.id)) throw new Error(`theme id "${th.id}" not allowed`);
  if (THEMES[th.id as ThemeId] && !(th.id in modThemes)) throw new Error(`theme "${th.id}" already exists`);
  const base = THEMES[th.base];
  if (!base) throw new Error(`theme ${th.id}: unknown base "${th.base}"`);
  const out: ThemeDef = { ...base, id: th.id as ThemeId, name: String(th.name || th.id).slice(0, 30) };
  for (const [k, v] of Object.entries(th)) {
    if (k === "id" || k === "name" || k === "base") continue;
    const cur = (base as unknown as Record<string, unknown>)[k];
    if (typeof cur === "string" && cur.startsWith("#")) {
      if (typeof v !== "string" || !COLOUR.test(v)) throw new Error(`theme ${th.id}: ${k} must be a colour like #66ccff`);
      (out as unknown as Record<string, unknown>)[k] = v;
    } else if (typeof cur === "number" && num(v, 0, 2000)) (out as unknown as Record<string, unknown>)[k] = v;
  }
  THEMES[th.id as ThemeId] = out;
  modThemes[th.id] = true;
}
const modThemes: Record<string, true> = {};

function addCharacter(c: ModCharacter) {
  if (!ID.test(c.id)) throw new Error(`character id "${c.id}" not allowed`);
  if (CHARACTERS.some((x) => x.id === c.id)) throw new Error(`character "${c.id}" already exists`);
  if (!FORMS.includes(c.form) || !EYES.includes(c.eye) || !ROLES.includes(c.role) || !WEAPONS.includes(c.favorite)) throw new Error(`character ${c.id}: form, eye, role or favourite item not known`);
  for (const k of ["primary", "secondary", "accent"] as const) if (!COLOUR.test(c[k] ?? "")) throw new Error(`character ${c.id}: ${k} must be a colour like #66ccff`);
  for (const k of ["speed", "accel", "handling", "weight"] as const) if (!num(c[k], 1, 5)) throw new Error(`character ${c.id}: ${k} must be 1 to 5`);
  const def: CharacterDef = {
    id: c.id, name: String(c.name || c.id).toUpperCase().slice(0, 10), form: c.form, eye: c.eye, primary: c.primary, secondary: c.secondary, accent: c.accent,
    speed: c.speed, accel: c.accel, handling: c.handling, weight: c.weight, role: c.role, favorite: c.favorite,
    fusion: c.favorite, fusionRate: 1, fusionBurst: 1, fusionSpread: 0.2, fusionKick: 0.4,
  };
  if (c.shot) {
    const s = c.shot;
    if (!KINDS.includes(s.kind) || !EFFECTS.includes(s.effect) || !COLOUR.test(s.color ?? "") || !num(s.rate, 0.4, 4) || !num(s.count, 1, 6) || !num(s.power, 0.2, 2)) throw new Error(`character ${c.id}: shot is not valid`);
    FUSION_SHOTS[c.id] = { name: String(s.name || "SHOT").toUpperCase().slice(0, 16), kind: s.kind, effect: s.effect, color: s.color, rate: s.rate, count: s.count, power: s.power };
  }
  CHARACTERS.push(def);
}

function addTrack(tr: ModTrack, modId: string) {
  if (!ID.test(tr.id)) throw new Error(`track id "${tr.id}" not allowed`);
  if (!Array.isArray(tr.draw) || !tr.draw.length) throw new Error(`track ${tr.id}: draw is empty`);
  if (!THEMES[tr.theme as ThemeId]) throw new Error(`track ${tr.id}: unknown theme "${tr.theme}"`);
  const id = `mod-${modId}-${tr.id}`;
  const routes: RouteSpec[] = (tr.routes ?? []).map((r, i) => ({
    from: r.from, to: r.to, kind: r.kind, width: r.width, walls: r.walls, tunnel: r.tunnel, afloat: r.afloat, holes: r.holes, pads: r.pads,
    draw: (t: Turtle) => run(t, r.draw, `track ${tr.id} route ${i + 1}`),
  }));
  const spec: DesignSpec = {
    id,
    theme: tr.theme as ThemeId,
    difficulty: tr.difficulty ?? 2,
    start: tr.start ?? [0, 10, 0, 0],
    draw: (t: Turtle) => run(t, tr.draw, `track ${tr.id}`),
    zones: tr.zones, holes: tr.holes, pads: tr.pads, cannons: tr.cannons, portals: tr.portals,
    sectors: tr.sectors as [string, ThemeId][] | undefined, routes, traffic: tr.traffic, hazards: tr.hazards,
    sea: tr.sea, indoor: tr.indoor, warp: tr.warp, traps: tr.traps,
  };
  const def = design(spec);
  if (!def.points.every((p) => p.every(Number.isFinite))) throw new Error(`track ${tr.id}: the drawing does not give a usable road`);
  registerTrack(def);
  const names = typeof tr.name === "string" ? { en: tr.name } : tr.name ?? {};
  for (const [lang, word] of Object.entries(names)) (MOD_WORDS[lang] ??= {})[`trk_${id}`] = String(word).slice(0, 40);
}

/** Put every enabled mod into the game. Called once, before the first screen. */
export function applyMods() {
  for (const { mod, enabled } of loadInstalled()) {
    const report = (modReport[mod.id] = { tracks: 0, characters: 0, themes: 0, errors: [] as string[] });
    if (!enabled) continue;
    const bad = checkMod(mod);
    if (bad) {
      report.errors.push(bad);
      continue;
    }
    // aesthetics first, the circuits may use them
    for (const th of mod.themes ?? []) {
      try {
        addTheme(th);
        report.themes++;
      } catch (e) {
        report.errors.push((e as Error).message);
      }
    }
    for (const c of mod.characters ?? []) {
      try {
        addCharacter(c);
        report.characters++;
      } catch (e) {
        report.errors.push((e as Error).message);
      }
    }
    for (const tr of mod.tracks ?? []) {
      try {
        addTrack(tr, mod.id);
        report.tracks++;
      } catch (e) {
        report.errors.push((e as Error).message);
      }
    }
  }
}

/** A complete small mod, offered for download as a starting point. */
export const EXAMPLE_MOD: ModFile = {
  format: "btr-mod",
  version: 1,
  id: "ejemplo",
  name: "Mod de ejemplo",
  author: "Bubble Team",
  description: "Un circuito en forma de ocho alargado, una estética y un personaje.",
  themes: [{ id: "atardecer-menta", name: "ATARDECER MENTA", base: "sunset", skyTop: "#7fe3c4", skyBottom: "#fff1d6", barrierA: "#2dd4bf", barrierB: "#fb923c", glow: "#99f6e4" }],
  characters: [
    { id: "menta", name: "MENTA", form: "leaf", eye: "sparkle", primary: "#2dd4bf", secondary: "#f0fdfa", accent: "#0f766e", speed: 4, accel: 3, handling: 4, weight: 2, role: "balanced", favorite: "magnet", shot: { name: "HOJA FRESCA", kind: "fan", effect: "slow", color: "#2dd4bf", rate: 1.1, count: 3, power: 0.9 } },
  ],
  tracks: [
    {
      id: "pista-menta",
      name: { es: "Pista Menta", en: "Mint Track" },
      theme: "atardecer-menta",
      difficulty: 2,
      draw: [["go", 40], ["mark", "go"], ["go", 20], ["mark", "aA"], ["go", 300], ["mark", "aB"], ["flex", "f1", 80], ["left", 90, 80, 4], ["mark", "top"], ["flex", "f2", 200], ["mark", "t2"], ["left", 90, 80, 4], ["go", 460, -4], ["left", 90, 80, -4], ["go", 200], ["left", 90, 80]],
      zones: [["top", "t2", "mag"]],
      pads: [["go", "boost"], ["aB", "boost"], ["top", "jump", 11, 20]],
      routes: [{ from: "aA", to: "aB", draw: [["bypass", "L", 123, 9]], kind: "high", holes: [["mid", 12]], pads: [["mid", "boost", 1.5]] }],
    },
  ],
};
