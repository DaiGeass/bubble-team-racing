import type { TrackDef } from "./data";
import { design, BYPASS } from "./trackDesign";

// ---------------------------------------------------------------------------
// The internet-aesthetic circuits: the levels of the Backrooms, weirdcore and
// glitchcore, kidcore and cottagecore, traumacore and nightcore, and a tour of
// the Frutiger family. Every one of them goes through all five crafts in a
// lap: road, boat, submarine, plane and the magnets. Drawn like the others in
// tracks.ts (lengths in world units, a positive turn is to the left); the two
// flexible straights in each one close the drawing on their own.
// ---------------------------------------------------------------------------

export const CORE_TRACKS: TrackDef[] = [
  // NOCLIP — the Levels. The yellow rooms of Level 0, a crack in the wall that
  // drops you into the car park of Level 1, the party of Level Fun on magnets,
  // and then out of the walls altogether: the pools, the deep end, the void
  // above it, and back into the yellow rooms where it started.
  design({
    id: "noclip", warp: false, theme: "backrooms", difficulty: 3, sea: 0, start: [0, 6, 0, 0], hazards: 3,
    draw: (t) =>
      t.go(50).mark("go").go(40).mark("aA").go(BYPASS + 103).mark("aB").go(40).mark("l1").go(50).mark("p1").go(140).mark("pOut").go(40)
        .right(90, 60)
        .go(30).mark("fun").go(30).mark("mA").weave("L", 30, 70).go(20).mark("mB").go(130).go(60, -6).mark("w0")
        .mark("chA").go(BYPASS + 43).mark("chB").go(20)
        .right(90, 60)
        .go(20).mark("s0").go(100, -20).go(20).mark("tA").go(BYPASS + 103, -4).mark("tB").go(30).go(110, 24).mark("s1").flex("f1", 30)
        .right(90, 60).mark("k0")
        .go(150, 30).left(360, 70, 14).go(30).mark("skyA").go(BYPASS + 83).mark("skyB").go(20).go(100, -24).go(60, -14).mark("k1").flex("f2", 20)
        .right(90, 60),
    zones: [["mA", "mB", "mag"], ["w0", "s0", "water"], ["s0", "s1", "sub"], ["s1", "k0", "water"], ["k0", "k1", "sky"]],
    portals: [["p1", "pOut"]],
    sectors: [["l1", "level1"], ["fun", "levelfun"], ["w0", "liminal"], ["s0", "aqua"], ["k0", "dreamcore"], ["k1", "backrooms"]],
    traffic: 2,
    pads: [["go", "boost"], ["aB", "boost"], ["pOut", "boost", 1.4], ["mA", "jump", 11, 60], ["chA", "jump", 11, 120], ["k1", "boost", 1.45, 10]],
    routes: [
      { from: "aA", to: "aB", draw: (t) => t.bypass("L", 103, 0), kind: "side", pads: [["mid", "boost"]] },
      { from: "aA", to: "aB", draw: (t) => t.bypass("R", 103, -4), kind: "low", pads: [["mid", "boost", 1.5]] },
      { from: "chA", to: "chB", draw: (t) => t.bypass("L", 43, 0), afloat: true, kind: "side" },
      { from: "tA", to: "tB", draw: (t) => t.bypass("L", 103, -10, -4), afloat: true, kind: "low" },
      { from: "tA", to: "tB", draw: (t) => t.bypass("R", 103, 9, -4), afloat: true, kind: "high" },
      { from: "skyA", to: "skyB", draw: (t) => t.bypass("L", 83, 12), afloat: true, kind: "high" },
      { from: "skyA", to: "skyB", draw: (t) => t.bypass("R", 83, -12), afloat: true, kind: "low" },
    ],
  }),

  // WEIRDCORE — a lake that is too blue, a dive into a sea of broken pixels,
  // a flight through a sky with eyes in it, a magnetic loop in the glitch, a
  // fall, and a road that splits over and under itself on the way home.
  design({
    id: "rarocore", warp: "soft", theme: "weirdcore", difficulty: 3, sea: 0, start: [0, 4, 0, 0], hazards: 3,
    draw: (t) =>
      t.go(50).mark("go").go(60).go(50, -4).mark("w0").mark("chA").go(BYPASS + 103).mark("chB").go(20)
        .mark("s0").go(90, -20).go(15).mark("tA").go(BYPASS + 43, -4).mark("tB").go(20).go(100, 24).mark("s1").go(30)
        .left(90, 80).mark("k0")
        .go(170, 32).right(360, 80, 14).go(30).mark("skyA").go(BYPASS + 83).mark("skyB").go(20).go(90, -22).mark("k1")
        .left(90, 80)
        .go(40).mark("gl").go(40).mark("mA").left(360, 60, 10).go(30).mark("mB").go(40).drop(-12).go(40).mark("aA").go(BYPASS + 123).mark("aB").flex("f1", 100)
        .left(90, 80, -8)
        .go(40).mark("home").flex("f2", 120, -10)
        .left(90, 80),
    zones: [["w0", "s0", "water"], ["s0", "s1", "sub"], ["s1", "k0", "water"], ["k0", "k1", "sky"], ["mA", "mB", "mag"]],
    sectors: [["s0", "glitchcore"], ["k0", "weirdcore"], ["skyB", "dreamcore"], ["gl", "glitchcore"], ["aA", "weirdcore"], ["home", "glitchcore"]],
    traffic: 2,
    pads: [["go", "boost"], ["chA", "jump", 11, 140], ["k1", "boost", 1.45, 20], ["mB", "boost", 1.3], ["aB", "boost"], ["home", "boost"]],
    routes: [
      { from: "chA", to: "chB", draw: (t) => t.bypass("L", 103, 0), afloat: true, kind: "side" },
      { from: "chA", to: "chB", draw: (t) => t.bypass("R", 103, 0), afloat: true, kind: "side" },
      { from: "tA", to: "tB", draw: (t) => t.bypass("R", 43, -8, -4), afloat: true, kind: "low" },
      { from: "skyA", to: "skyB", draw: (t) => t.bypass("L", 83, 12), afloat: true, kind: "high" },
      { from: "skyA", to: "skyB", draw: (t) => t.bypass("R", 83, -12), afloat: true, kind: "low" },
      { from: "aA", to: "aB", draw: (t) => t.bypass("L", 123, 12), kind: "high", holes: [["mid", 14]], pads: [["mid", "boost", 1.6]] },
      { from: "aA", to: "aB", draw: (t) => t.bypass("R", 123, -6), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
    ],
  }),

  // THE TOY BOX — round a stack of building blocks on magnets, down through a
  // cottage garden to the duck pond, under it, and up over the whole of it in
  // a paper plane.
  design({
    id: "juguetes", warp: "soft", theme: "kidcore", difficulty: 2, sea: 0, start: [0, 8, 0, 0], hazards: 3,
    draw: (t) =>
      t.go(50).mark("go").go(40).mark("aA").go(BYPASS + 123).mark("aB").go(30).mark("mA").right(360, 60, 12).go(30).mark("mB").go(140)
        .right(90, 80)
        .go(40).mark("co").go(40).mark("bA").go(BYPASS + 83, -8).mark("bB").go(30).go(60, -12).mark("w0").go(40)
        .mark("chA").go(BYPASS + 63).mark("chB").flex("f1", 40)
        .right(90, 80)
        .go(20).mark("s0").go(100, -20).go(20).mark("tA").go(BYPASS + 63, -4).mark("tB").go(30).go(110, 24).mark("s1").flex("f2", 20)
        .right(90, 80).mark("k0")
        .go(160, 30).left(360, 80, 12).go(30).mark("skyA").go(BYPASS + 63).mark("skyB").go(20).go(80, -26).mark("k1").go(60, -8).go(120)
        .right(90, 80),
    zones: [["mA", "mB", "mag"], ["w0", "s0", "water"], ["s0", "s1", "sub"], ["s1", "k0", "water"], ["k0", "k1", "sky"]],
    sectors: [["mA", "kidcore"], ["co", "cottagecore"], ["s0", "aqua"], ["s1", "cottagecore"], ["k0", "kidcore"], ["k1", "cottagecore"]],
    traffic: 3,
    pads: [["go", "boost"], ["aB", "boost"], ["mA", "jump", 11, 80], ["bB", "boost"], ["chA", "jump", 11, 100], ["k1", "boost", 1.4, 20]],
    routes: [
      { from: "aA", to: "aB", draw: (t) => t.bypass("L", 123, 12), kind: "high", holes: [["mid", 14]], pads: [["mid", "boost", 1.6]] },
      { from: "aA", to: "aB", draw: (t) => t.bypass("R", 123, 0), kind: "side", pads: [["mid", "jump", 10]] },
      { from: "bA", to: "bB", draw: (t) => t.bypass("L", 83, -6, -8), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
      { from: "bA", to: "bB", draw: (t) => t.bypass("R", 83, 0, -8), kind: "side", pads: [["mid", "boost"]] },
      { from: "chA", to: "chB", draw: (t) => t.bypass("L", 63, 0), afloat: true, kind: "side" },
      { from: "tA", to: "tB", draw: (t) => t.bypass("L", 63, 8, -4), afloat: true, kind: "high" },
      { from: "skyA", to: "skyB", draw: (t) => t.bypass("R", 63, 10), afloat: true, kind: "high" },
    ],
  }),

  // NEON PLUSH — a pastel bedroom sea at dusk, down past the soft toys into a
  // trench lit like a club, up into a night sky of neon, and home on magnets
  // through a city that pulses with the music.
  design({
    id: "peluche", warp: "soft", theme: "traumacore", difficulty: 3, sea: 0, start: [0, 6, 0, 0], hazards: 3,
    draw: (t) =>
      t.go(50).mark("go").go(110).go(60, -6).mark("w0").mark("chA").go(BYPASS + 143).mark("chB").flex("f2", 20)
        .left(90, 90)
        .go(20).mark("s0").go(100, -20).go(20).mark("tA").go(BYPASS + 83, -4).mark("tB").go(30).go(110, 24).mark("s1").flex("f1", 20)
        .left(90, 90).mark("k0")
        .go(190, 34).right(360, 90, 16).go(40).mark("skyA").go(BYPASS + 83).mark("skyB").go(30).go(80, -20)
        .left(90, 90, -10).mark("k1")
        .go(40).mark("nc").go(40).mark("mA").weave("R", 30, 80, -6).go(30).mark("mB").go(30).mark("dA").go(BYPASS + 123, -8).mark("dB").go(40)
        .left(90, 90),
    zones: [["w0", "s0", "water"], ["s0", "s1", "sub"], ["s1", "k0", "water"], ["k0", "k1", "sky"], ["mA", "mB", "mag"]],
    sectors: [["s0", "nightcore"], ["s1", "traumacore"], ["k0", "nightcore"], ["skyB", "traumacore"], ["nc", "nightcore"], ["dB", "traumacore"]],
    traffic: 2,
    pads: [["go", "boost"], ["chA", "jump", 12, 150], ["chA", "jump", 12, 280], ["nc", "boost", 1.4], ["mA", "jump", 12, 90], ["dB", "boost"]],
    routes: [
      { from: "chA", to: "chB", draw: (t) => t.bypass("L", 143, 0), afloat: true, kind: "side" },
      { from: "tA", to: "tB", draw: (t) => t.bypass("L", 83, -10, -4), afloat: true, kind: "low" },
      { from: "tA", to: "tB", draw: (t) => t.bypass("R", 83, 9, -4), afloat: true, kind: "high" },
      { from: "skyA", to: "skyB", draw: (t) => t.bypass("L", 83, 12), afloat: true, kind: "high" },
      { from: "skyA", to: "skyB", draw: (t) => t.bypass("R", 83, -12), afloat: true, kind: "low" },
      { from: "dA", to: "dB", draw: (t) => t.bypass("L", 123, 12, -8), kind: "high", holes: [["mid", 14]], pads: [["mid", "boost", 1.6]] },
      { from: "dA", to: "dB", draw: (t) => t.bypass("R", 123, -6, -8), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
    ],
  }),

  // FRUTIGER TOUR — the whole family in one lap: the green of Frutiger Eco, the
  // sea of Frutiger Aero, the deep blue under it, the glass sky of Aero Glass,
  // the night of Frutiger Aurora and the circuit boards of Techno on magnets.
  design({
    id: "frutigertour", warp: "soft", theme: "aurora", difficulty: 2, sea: 0, start: [0, 8, 0, 0], hazards: 2,
    draw: (t) =>
      t.go(50).mark("go").go(40).mark("aA").go(BYPASS + 103).mark("aB").go(30).mark("eco").go(40).go(60, -8).mark("w0")
        .mark("chA").go(BYPASS + 83).mark("chB").flex("f2", 20)
        .left(90, 100)
        .go(20).mark("s0").go(100, -22).go(20).mark("tA").go(BYPASS + 103, -4).mark("tB").go(30).go(110, 26).mark("s1").flex("f1", 30)
        .left(90, 100).mark("k0")
        .go(200, 36).right(360, 90, 14).go(40).mark("skyA").go(BYPASS + 103).mark("skyB").go(180).go(90, -22).mark("k1")
        .left(90, 100, -6)
        .go(30).mark("tech").go(40).mark("mA").left(360, 60, 10).go(30).mark("mB").go(40).drop(-14).go(30).mark("dA").go(BYPASS + 83, -6).mark("dB").go(140, -4)
        .left(90, 100),
    zones: [["w0", "s0", "water"], ["s0", "s1", "sub"], ["s1", "k0", "water"], ["k0", "k1", "sky"], ["mA", "mB", "mag"]],
    sectors: [["eco", "eco"], ["w0", "frutiger"], ["s0", "aqua"], ["k0", "aero"], ["k1", "aurora"], ["tech", "techno"], ["dB", "aurora"]],
    traffic: 3,
    pads: [["go", "boost"], ["aB", "boost"], ["chA", "jump", 11, 120], ["k1", "boost", 1.45, 20], ["mA", "jump", 11, 60], ["dB", "boost"]],
    routes: [
      { from: "aA", to: "aB", draw: (t) => t.bypass("L", 103, 14), kind: "high", holes: [["mid", 16]], pads: [["mid", "boost", 1.6]] },
      { from: "aA", to: "aB", draw: (t) => t.bypass("R", 103, -6), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
      { from: "chA", to: "chB", draw: (t) => t.bypass("L", 83, 0), afloat: true, kind: "side" },
      { from: "tA", to: "tB", draw: (t) => t.bypass("L", 103, -10, -4), afloat: true, kind: "low" },
      { from: "tA", to: "tB", draw: (t) => t.bypass("R", 103, 9, -4), afloat: true, kind: "high" },
      { from: "skyA", to: "skyB", draw: (t) => t.bypass("L", 103, 12), afloat: true, kind: "high" },
      { from: "skyA", to: "skyB", draw: (t) => t.bypass("R", 103, -12), afloat: true, kind: "low" },
      { from: "dA", to: "dB", draw: (t) => t.bypass("L", 83, 0, -6), kind: "side", pads: [["mid", "boost"]] },
    ],
  }),
];
