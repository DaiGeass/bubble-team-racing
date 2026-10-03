import type { TrackDef } from "./data";
import { design, BYPASS } from "./trackDesign";

// ---------------------------------------------------------------------------
// The eight circuits, one per aesthetic. Each is drawn by hand with the turtle
// in trackDesign.ts: lengths are in world units (a kart covers about 27 a
// second), heights are absolute, and a positive turn is a turn to the left.
// tools/sim.sh check verifies every one of them: closure, bend radius, slopes
// and the headroom wherever one road passes over another.
// ---------------------------------------------------------------------------

export const DESIGNED_TRACKS: TrackDef[] = [
  // FRUTIGER AERO — the gentle one. A hill with a hairpin on top, a jump on the
  // way down, a run across the open sea and a long home straight with a ramp lane.
  design({
    id: "bahia", theme: "frutiger", difficulty: 1, sea: 0, start: [0, 3, 0, 0], hazards: 2,
    draw: (t) =>
      t.go(60).mark("go").go(180)
        .right(90, 60).go(120, 5).right(90, 50, 4)
        .mark("climbA").go(BYPASS + 123, 10).mark("climbB")
        .left(180, 45)
        .go(90, -3).mark("run").go(40, -1).mark("jump").go(130, -8)
        .right(90, 60, -3).go(60, -4)
        .right(90, 70, -3).mark("w0").go(320).mark("w1")
        .right(90, 60, 3)
        .mark("homeA").go(BYPASS + 213).mark("homeB")
        .right(90, 60).go(120),
    zones: [["w0", "w1", "water"]],
    holes: [["jump", 15]],
    pads: [["go", "boost"], ["run", "boost", 1.5], ["homeB", "boost"]],
    routes: [
      { from: "climbA", to: "climbB", draw: (t) => t.bypass("R", 123, 13, 10), pads: [["mid", "boost"]] },
      { from: "homeA", to: "homeB", draw: (t) => t.bypass("R", 213, 8), holes: [["mid", 16]], pads: [["mid", "boost", 1.5]] },
    ],
  }),

  // FRUTIGER ECO — up the hill by switchbacks, over the top and a long way
  // down. The chute off the summit is the fast way and the risky one: no
  // barriers and a gap in the middle.
  design({
    id: "bosque", theme: "eco", difficulty: 2, start: [0, 8, 0, 0], hazards: 3,
    draw: (t) =>
      t.go(50).mark("go").go(170)
        .left(90, 70, 3).go(160, 8)
        .left(180, 40, 5).go(160, 10)
        .right(180, 40, 5)
        .mark("ridgeA").go(BYPASS + 123, 12).mark("ridgeB")
        .left(90, 60, 2).mark("top")
        .go(80, -4).mark("drop1").go(40, -2).mark("j1").go(150, -14)
        .left(90, 80, -5)
        .go(110, -4).mark("j2").go(160, -5).mark("merge")
        .left(90, 80, -5).go(200, -6),
    holes: [["j1", 16], ["j2", 15]],
    pads: [["go", "boost"], ["drop1", "boost", 1.5], ["j2", "boost", 1.5, -22], ["merge", "boost"]],
    routes: [
      { from: "ridgeA", to: "ridgeB", draw: (t) => t.bypass("L", 123, 14, 12), pads: [["mid", "boost"]] },
      {
        from: "top", to: "merge", width: 12, walls: false,
        draw: (t) => t.go(20, -1).left(45, 70, -2.5).go(120, -8).mark("gap").go(60, -8).go(190, -11.4).left(45, 70, -2.5).go(20, -0.6),
        holes: [["gap", 22]],
        pads: [["gap", "boost", 1.6]],
      },
    ],
  }),

  // AQUA — off the pier onto the sea, then down a glass tube to twenty units
  // under the surface, back up, and a cannon over the last corner.
  design({
    id: "arrecife", theme: "aqua", difficulty: 2, sea: 0, start: [0, 4, 0, 0], hazards: 2,
    draw: (t) =>
      t.go(50).mark("go").go(150)
        .right(90, 70, -4).mark("w0")
        .mark("seaA").go(BYPASS + 124).mark("seaB")
        .right(90, 90).mark("w1")
        .go(60, 2).mark("s0").go(120, -14)
        .right(180, 60, -8)
        .go(140)
        .left(90, 60, 6).go(160, 14).mark("s1")
        .mark("c0").go(8).mark("air").left(90, 50, 4).mark("land")
        .mark("backA").go(BYPASS + 124).mark("backB")
        .right(180, 35).go(150),
    zones: [["w0", "w1", "water"], ["s0", "s1", "sub"]],
    holes: [["air", 68]],
    kick: 0,
    cannons: [["c0", "land", 20]],
    pads: [["go", "boost"], ["backB", "boost"]],
    routes: [
      { from: "seaA", to: "seaB", draw: (t) => t.bypass("L", 124, 8), holes: [["mid", 16]], pads: [["mid", "boost", 1.5]] },
      { from: "backA", to: "backB", draw: (t) => t.bypass("L", 124, -3.3), pads: [["mid", "boost"]] },
    ],
  }),

  // TECHNO — two and a quarter turns up a spiral tower, then off the top in a
  // plane, diving through the rings down to the road.
  design({
    id: "torre", theme: "techno", difficulty: 3, start: [0, 8, 0, 0], hazards: 2,
    draw: (t) =>
      t.mark("lineA").go(BYPASS + 124).mark("lineB")
        .left(90, 80, 2).go(100, 2).mark("ramp").go(100, 2)
        .left(810, 60, 40)
        .mark("top").go(80).mark("k0")
        .go(300, -30)
        .left(90, 120, -8)
        .go(150, -6).mark("k1")
        .left(90, 70, -2).go(110),
    zones: [["k0", "k1", "sky"]],
    pads: [["ramp", "boost"], ["top", "boost", 1.5, -200], ["top", "boost", 1.5, -500], ["k1", "boost", 1.45, 20]],
    routes: [
      { from: "lineA", to: "lineB", draw: (t) => t.bypass("L", 124, 10), holes: [["mid", 15]], pads: [["mid", "boost", 1.5]] },
      { from: "lineA", to: "lineB", draw: (t) => t.bypass("R", 124, -6), tunnel: true, pads: [["mid", "boost"]] },
    ],
  }),

  // Y2K — a figure of eight: one corner winds a full extra turn up on itself,
  // and the road comes back across the start straight twenty-two units up.
  // Along the bridge there is a road above and a road below.
  design({
    id: "orbita", theme: "y2k", difficulty: 2, start: [0, 8, 0, 0], hazards: 3,
    draw: (t) =>
      t.go(50).mark("go").go(210)
        .left(90, 60, 2).go(120, 2)
        .mark("coil").left(450, 60, 18)
        .go(120)
        .left(90, 60)
        .mark("bridgeA").go(BYPASS + 183).mark("bridgeB")
        .right(90, 60, -4).go(100, -4).mark("run").go(40, -2).mark("jump").go(60, -2)
        .right(90, 60, -4).go(120, -4)
        .right(90, 60, -2).go(180),
    holes: [["jump", 15]],
    pads: [["go", "boost"], ["coil", "boost"], ["run", "boost", 1.5]],
    routes: [
      { from: "bridgeA", to: "bridgeB", draw: (t) => t.bypass("L", 183, -11), pads: [["mid", "boost"]] },
      { from: "bridgeA", to: "bridgeB", draw: (t) => t.bypass("R", 183, 9), holes: [["mid", 16]], pads: [["mid", "boost", 1.5]] },
    ],
  }),

  // LIQUID GLASS — the waterfall. It starts sixty units up and comes down in
  // three falls, crosses the sea, dives, and a cannon throws you back to the top.
  design({
    id: "cascada", theme: "liquid", difficulty: 3, sea: 0, start: [0, 60, 0, 0], hazards: 2,
    draw: (t) =>
      t.go(40).mark("go").go(120).drop(-14).go(97)
        .left(180, 70, -4)
        .go(100).drop(-14).go(20).mark("cutA").go(97)
        .right(180, 70, -4)
        .go(97).mark("cutB").go(23).drop(-16).go(124, -4)
        .left(90, 80, -4).mark("w0").go(140).mark("w1")
        .left(90, 80)
        .go(60, -2).mark("s0").go(290, -16)
        .left(90, 70)
        .go(140, 8).go(150, 10).mark("s1")
        .go(142, 3).mark("c0").go(8).mark("air")
        .left(90, 70, 57).mark("land").go(30),
    zones: [["w0", "w1", "water"], ["s0", "s1", "sub"]],
    holes: [["air", 104]],
    kick: 0,
    cannons: [["c0", "land", 34]],
    pads: [["go", "boost"], ["w1", "boost"], ["s1", "boost", 1.45, 30]],
    routes: [
      {
        // the inside line of the second hairpin: half the distance, no barriers and a gap
        from: "cutA", to: "cutB", width: 11, walls: false,
        draw: (t) => t.go(18).right(80, 60, -1.5).go(16).mark("gap").go(40, -1).right(100, 60, -1.5).go(18),
        holes: [["gap", 14]],
      },
    ],
  }),

  // WINDOWS 98 — square corners and flat decks, like windows on a desktop. The
  // taskbar straight is three lanes deep: the title bar above, a tunnel below.
  design({
    id: "escritorio", theme: "win98", difficulty: 2, start: [0, 8, 0, 0], hazards: 4,
    draw: (t) =>
      t.go(50).mark("go").go(110).mark("warpIn").go(200).mark("warpOut")
        .left(90, 30).go(300, 10)
        .left(90, 30).go(120)
        .right(90, 30).go(160)
        .left(90, 30)
        .go(110).mark("run").go(40, -2).mark("jump").go(190, -8)
        .left(90, 30)
        .mark("barA").go(BYPASS + 260).mark("barB").go(83)
        .left(90, 30).go(160),
    holes: [["jump", 15]],
    pads: [["go", "boost"], ["run", "boost", 1.5], ["barB", "boost"]],
    portals: [["warpIn", "warpOut"]],
    routes: [
      { from: "barA", to: "barB", draw: (t) => t.bypass("L", 260, 10), holes: [["mid", 16]], pads: [["mid", "boost", 1.5]] },
      { from: "barA", to: "barB", draw: (t) => t.bypass("R", 260, -6), tunnel: true, pads: [["mid", "boost"]] },
    ],
  }),

  // THE FINAL ONE — everything at once: a spiral, a flight down from it, the
  // open sea, a dive, a cannon and a three-lane run to the line. The palette
  // turns into a different aesthetic every lap.
  design({
    id: "fusion", theme: "vapor", difficulty: 3, sea: 0, start: [0, 10, 0, 0], hazards: 4,
    draw: (t) =>
      t.go(50).mark("go").go(110)
        .left(90, 70).go(120, 6)
        .left(450, 55, 20)
        .mark("top").go(60).mark("k0")
        .go(160, -22)
        .left(90, 100, -6)
        .go(80, -4).mark("k1")
        .go(100, -4).mark("w0").go(160).mark("w1")
        .right(90, 80)
        .go(40, -2).mark("s0").go(90, -16)
        .left(180, 60)
        .go(102, 10).go(70, 8).mark("s1")
        .go(55, 4).mark("c0").go(8).mark("air")
        .left(90, 60).mark("land")
        .mark("homeA").go(BYPASS + 98, 6).mark("homeB")
        .right(90, 60),
    zones: [["k0", "k1", "sky"], ["w0", "w1", "water"], ["s0", "s1", "sub"]],
    holes: [["air", 80]],
    kick: 0,
    cannons: [["c0", "land", 30]],
    pads: [["go", "boost"], ["top", "boost", 1.5, -150], ["w1", "boost"], ["homeB", "boost"]],
    routes: [
      { from: "homeA", to: "homeB", draw: (t) => t.bypass("L", 98, 9, 6), pads: [["mid", "boost", 1.5]] },
      { from: "homeA", to: "homeB", draw: (t) => t.bypass("R", 98, -3, 6), pads: [["mid", "boost"]] },
    ],
  }),
];
