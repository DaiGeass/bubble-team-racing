import type { PartEffect, VehicleMode } from "./data";

// ---------------------------------------------------------------------------
// Every character drives a little differently on top of its stats: a perk is
// a small, always-on edge. Some work everywhere (a longer turbo, a quicker
// drift), some only in the craft the character is at home in (a sailor is
// faster on the water, a diver under it).
// ---------------------------------------------------------------------------

export type PerkId =
  | "sprinter" | "launcher" | "drifter" | "charger" | "afterburn" | "punch" | "anchor"
  | "nimble" | "allround" | "sailor" | "diver" | "pilot" | "maglev";

export interface Perk {
  id: PerkId;
  /** what it changes everywhere, multiplied into the kart's parts */
  fx: PartEffect;
  /** the craft it is at home in, and how much faster it goes there */
  home?: VehicleMode;
  homeSpeed?: number;
}

export const PERKS: Record<PerkId, Perk> = {
  sprinter: { id: "sprinter", fx: { speed: 1.025, accel: 0.97 } },
  launcher: { id: "launcher", fx: { accel: 1.1 } },
  drifter: { id: "drifter", fx: { drift: 1.25 } },
  charger: { id: "charger", fx: { turbo: 1.3 } },
  afterburn: { id: "afterburn", fx: { boostTime: 1.25 } },
  punch: { id: "punch", fx: { boostPower: 1.06 } },
  anchor: { id: "anchor", fx: { grip: 0.7 } },
  nimble: { id: "nimble", fx: { turn: 1.07 } },
  allround: { id: "allround", fx: { speed: 1.008, accel: 1.03, turn: 1.02 } },
  sailor: { id: "sailor", fx: { turn: 1.02 }, home: "boat", homeSpeed: 1.06 },
  diver: { id: "diver", fx: { grip: 0.9 }, home: "sub", homeSpeed: 1.06 },
  pilot: { id: "pilot", fx: { accel: 1.02 }, home: "plane", homeSpeed: 1.06 },
  maglev: { id: "maglev", fx: { drift: 1.08 }, home: "hover", homeSpeed: 1.06 },
};

export const PERK_IDS = Object.keys(PERKS) as PerkId[];

/** Who has what. A character missing from here (a mod) gets one from its id. */
const CHARACTER_PERKS: Record<string, PerkId> = {
  nova: "allround", blip: "launcher", mochi: "drifter", kori: "sprinter", zepp: "nimble", pixl: "charger",
  fizz: "sailor", brum: "anchor", lumo: "nimble", tiko: "afterburn", sola: "pilot", nixe: "charger",
  yuki: "drifter", taro: "allround", vexa: "punch", rook: "anchor", pepa: "launcher", kiko: "sailor",
  onyx: "sprinter", pipi: "launcher", aquos: "diver", ember: "afterburn", mist: "pilot", terra: "anchor",
  prism: "maglev", cobalt: "punch", kiwi: "drifter", magma: "punch", zuri: "nimble", jade: "diver",
  volt: "maglev", nimbo: "pilot", coral: "diver", byte: "maglev", ash: "afterburn", tuxi: "sailor",
  medu: "diver", orbi: "pilot", cog: "anchor", luna: "maglev", ripp: "sailor", bolt: "charger",
  saya: "drifter", gale: "sprinter",
};

export function perkFor(charId: string): Perk {
  const known = CHARACTER_PERKS[charId];
  if (known) return PERKS[known];
  let h = 0;
  for (let i = 0; i < charId.length; i++) h = (h * 31 + charId.charCodeAt(i)) >>> 0;
  return PERKS[PERK_IDS[h % PERK_IDS.length]];
}

/** The speed a character gets in the craft it is riding, from its perk. */
export function perkModeSpeed(charId: string, mode: VehicleMode): number {
  const p = perkFor(charId);
  return p.home === mode ? (p.homeSpeed ?? 1) : 1;
}
