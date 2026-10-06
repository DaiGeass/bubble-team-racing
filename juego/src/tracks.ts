import type { TrackDef } from "./data";
import { design, BYPASS } from "./trackDesign";

// ---------------------------------------------------------------------------
// The circuits: one per aesthetic, one built around each kind of vehicle, and three big ones. Each is drawn by hand with the turtle
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
        .right(90, 60).go(40, 5).right(90, 50, 4)
        .mark("climbA").go(BYPASS + 123, 10).mark("climbB")
        .left(180, 45)
        .go(90, -3).mark("run").go(40, -1).mark("jump").go(130, -8)
        .right(90, 60, -3).go(60, -4)
        .right(90, 70, -3).mark("w0").go(240).mark("w1")
        .right(90, 60, 3)
        .mark("homeA").go(BYPASS + 133).mark("homeB")
        .right(90, 60).go(40),
    zones: [["w0", "w1", "water"]],
    holes: [["jump", 11]],
    pads: [["go", "boost"], ["run", "boost", 1.5], ["homeB", "boost"]],
    sectors: [["climbA", "eco"], ["w0", "aqua"], ["homeA", "frutiger"]],
    traffic: 3,
    routes: [
      { from: "climbA", to: "climbB", draw: (t) => t.bypass("L", 123, -4, 10), kind: "low", tunnel: true, pads: [["mid", "boost"]] },
      { from: "climbA", to: "climbB", draw: (t) => t.bypass("R", 123, 10, 10), kind: "high", pads: [["mid", "boost"]] },
      { from: "homeA", to: "homeB", draw: (t) => t.bypass("R", 133, 8), kind: "high", holes: [["mid", 16]], pads: [["mid", "boost", 1.5]] },
      { from: "w0", to: "w1", draw: (t) => t.bypass("L", 63, 0), afloat: true, kind: "side" },
    ],
  }),

  // FRUTIGER ECO — up the hill by switchbacks, over the top and a long way
  // down. The chute off the summit is the fast way and the risky one: no
  // barriers and a gap in the middle.
  design({
    id: "bosque", theme: "eco", difficulty: 2, start: [0, 8, 0, 0], hazards: 3,
    draw: (t) =>
      t.mark("sA").go(50).mark("go").go(170).mark("sB")
        .left(90, 70, 3).go(100, 5).mark("hairA").go(60, 3)
        .left(180, 40, 5).go(60, 3.75).mark("hairB").go(100, 6.25)
        .right(180, 40, 5)
        .mark("ridgeA").go(BYPASS + 123, 12).mark("ridgeB")
        .left(90, 60, 2).mark("top")
        .go(80, -4).mark("drop1").go(40, -2).mark("j1").go(150, -14)
        .left(90, 80, -5)
        .go(110, -4).mark("j2").go(160, -5).mark("merge")
        .left(90, 80, -5).go(200, -6),
    holes: [["j1", 12], ["j2", 11]],
    pads: [["go", "boost"], ["drop1", "boost", 1.5], ["j2", "boost", 1.5, -22], ["merge", "boost"]],
    sectors: [["ridgeA", "sunset"], ["merge", "frutiger"]],
    traffic: 3,
    routes: [
      { from: "hairA", to: "hairB", width: 13, walls: false, draw: (t) => t.go(18, 0.9).left(50, 40, 1.5).left(80, 40, 6.1).left(50, 40, 2.2).go(18, 1.05) },
      { from: "ridgeA", to: "ridgeB", draw: (t) => t.bypass("L", 123, 10, 12), kind: "high", pads: [["mid", "boost"]] },
      {
        from: "top", to: "merge", width: 12, walls: false,
        draw: (t) => t.go(20, -1).left(45, 70, -2.5).go(120, -8).mark("gap").go(60, -8).go(190, -11.4).left(45, 70, -2.5).go(20, -0.6),
        holes: [["gap", 17]],
        pads: [["gap", "boost", 1.6]],
      },
      { from: "sA", to: "sB", draw: (t) => t.bypass("R", 43, 0), kind: "side", pads: [["mid", "boost"]] },
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
    sectors: [["s0", "liquid"], ["s1", "aero"]],
    traffic: 2,
    routes: [
      { from: "seaA", to: "seaB", draw: (t) => t.bypass("R", 124, 3), kind: "side", pads: [["mid", "boost"]] },
      { from: "seaA", to: "seaB", draw: (t) => t.bypass("L", 124, 8), kind: "high", holes: [["mid", 16]], pads: [["mid", "boost", 1.5]] },
      { from: "backA", to: "backB", draw: (t) => t.bypass("L", 124, -3.3), kind: "low", pads: [["mid", "boost"]] },
    ],
  }),

  // TECHNO — two and a quarter turns up a spiral tower, then off the top in a
  // plane, diving through the rings down to the road.
  design({
    id: "torre", theme: "techno", difficulty: 3, start: [0, 8, 0, 0], hazards: 2,
    draw: (t) =>
      t.mark("lineA").go(BYPASS + 124).mark("lineB")
        .left(90, 80, 2).mark("rA").go(100, 2).mark("ramp").go(100, 2).mark("rB")
        .left(810, 60, 40)
        .mark("top").go(80).mark("k0")
        .go(300, -30)
        .left(90, 120, -8)
        .go(150, -6).mark("k1")
        .left(90, 70, -2).go(110),
    zones: [["rB", "top", "mag"], ["k0", "k1", "sky"]],
    sectors: [["ramp", "cyberpunk"], ["k0", "vapor"], ["k1", "techno"]],
    traffic: 3,
    pads: [["ramp", "boost"], ["top", "boost", 1.5, -200], ["top", "boost", 1.5, -500], ["k1", "boost", 1.45, 20]],
    routes: [
      { from: "lineA", to: "lineB", draw: (t) => t.bypass("L", 124, 10), kind: "high", holes: [["mid", 15]], pads: [["mid", "boost", 1.5]] },
      { from: "lineA", to: "lineB", draw: (t) => t.bypass("R", 124, -6), kind: "low", tunnel: true, pads: [["mid", "boost"]] },
      { from: "rA", to: "rB", draw: (t) => t.bypass("R", 23, 0, 4), kind: "side", pads: [["mid", "boost"]] },
    ],
  }),

  // Y2K — a figure of eight: one corner winds a full extra turn up on itself,
  // and the road comes back across the start straight twenty-two units up.
  // Along the bridge there is a road above and a road below.
  design({
    id: "orbita", theme: "y2k", difficulty: 2, start: [0, 8, 0, 0], hazards: 3,
    draw: (t) =>
      t.mark("line").go(50).mark("go").go(210).mark("lineB")
        .left(90, 60, 2).go(120, 2)
        .mark("coil").left(450, 60, 18).mark("coilB")
        .go(120)
        .left(90, 60)
        .mark("bridgeA").go(BYPASS + 183).mark("bridgeB")
        .right(90, 60, -4).go(100, -4).mark("run").go(40, -2).mark("jump").go(60, -2)
        .right(90, 60, -4).go(20, -0.67).mark("x1").go(100, -3.33)
        .right(90, 60, -2).go(100).mark("x2").go(80),
    zones: [["coil", "coilB", "mag"]],
    holes: [["jump", 9]],
    pads: [["go", "boost"], ["coil", "boost"], ["run", "boost", 1.5]],
    sectors: [["coil", "vapor"], ["bridgeB", "liquid"], ["jump", "y2k"]],
    traffic: 3,
    routes: [
      { from: "line", to: "lineB", draw: (t) => t.bypass("R", 83, -4), kind: "low", tunnel: true, pads: [["mid", "boost"]] },
      { from: "bridgeA", to: "bridgeB", draw: (t) => t.bypass("L", 183, -11), kind: "low", pads: [["mid", "boost"]] },
      { from: "bridgeA", to: "bridgeB", draw: (t) => t.bypass("R", 183, 9), kind: "high", holes: [["mid", 16]], pads: [["mid", "boost", 1.5]] },
      { from: "x1", to: "x2", width: 11, walls: false, draw: (t) => t.cut("R", 158.4, 30, -5.33), holes: [["mid", 10]], pads: [["mid", "boost", 1.5]] },
    ],
  }),

  // LIQUID GLASS — the waterfall. It starts sixty units up and comes down in
  // three falls, crosses the sea, dives, and a cannon throws you back to the top.
  design({
    id: "cascada", theme: "liquid", difficulty: 3, sea: 0, start: [0, 60, 0, 0], hazards: 2,
    draw: (t) =>
      t.go(40).mark("go").go(120).drop(-14).go(37).mark("inA").go(60)
        .left(180, 70, -4)
        .go(60).mark("inB").go(40).drop(-14).go(20).mark("cutA").go(97)
        .right(180, 70, -4)
        .go(97).mark("cutB").go(23).drop(-16).go(124, -4)
        .left(90, 80, -4).mark("w0").go(140).mark("w1")
        .left(90, 80)
        .go(60, -2).mark("s0").mark("tA").go(290, -16).mark("tB")
        .left(90, 70)
        .go(140, 8).go(150, 10).mark("s1")
        .go(142, 3).mark("c0").go(8).mark("air")
        .left(90, 70, 57).mark("land").go(30),
    zones: [["w0", "w1", "water"], ["s0", "s1", "sub"]],
    holes: [["air", 104]],
    kick: 0,
    cannons: [["c0", "land", 34]],
    pads: [["go", "boost"], ["w1", "boost"], ["s1", "boost", 1.45, 30]],
    sectors: [["w0", "aqua"], ["s0", "dreamcore"], ["land", "liquid"]],
    traffic: 2,
    routes: [
      { from: "inA", to: "inB", width: 11, walls: false, draw: (t) => t.go(18).left(180, 70, -4).go(18) },
      {
        // the inside line of the second hairpin: half the distance, no barriers and a gap
        from: "cutA", to: "cutB", width: 11, walls: false,
        draw: (t) => t.go(18).right(80, 60, -1.5).go(16).mark("gap").go(40, -1).right(100, 60, -1.5).go(18),
        holes: [["gap", 14]],
      },
      { from: "tA", to: "tB", draw: (t) => t.bypass("L", 113, -8, -16), afloat: true, kind: "low" },
      { from: "tA", to: "tB", draw: (t) => t.bypass("R", 113, 8, -16), afloat: true, kind: "high" },
    ],
  }),

  // WINDOWS 98 — square corners and flat decks, like windows on a desktop. The
  // taskbar straight is three lanes deep: the title bar above, a tunnel below.
  design({
    id: "escritorio", theme: "win98", difficulty: 2, start: [0, 8, 0, 0], hazards: 4,
    draw: (t) =>
      t.go(50).mark("go").go(110).mark("warpIn").go(200).mark("warpOut")
        .left(90, 30).mark("upA").go(300, 10).mark("upB")
        .left(90, 30).go(120)
        .right(90, 30).go(60).mark("x1").go(100)
        .left(90, 30)
        .go(100).mark("x2").go(10).mark("run").go(40, -2).mark("jump").go(190, -8)
        .left(90, 30)
        .mark("barA").go(BYPASS + 260).mark("barB").go(83)
        .left(90, 30).go(160),
    holes: [["jump", 9]],
    pads: [["go", "boost"], ["run", "boost", 1.5], ["barB", "boost"]],
    portals: [["warpIn", "warpOut"]],
    sectors: [["warpOut", "y2k"], ["run", "noir"], ["barA", "win98"]],
    traffic: 4,
    routes: [
      { from: "barA", to: "barB", draw: (t) => t.bypass("L", 260, 20), kind: "high", holes: [["mid", 18]], pads: [["mid", "boost", 1.7]] },
      { from: "barA", to: "barB", draw: (t) => t.bypass("R", 260, -10), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
      { from: "upA", to: "upB", draw: (t) => t.bypass("L", 123, 8, 10), kind: "high", pads: [["mid", "boost", 1.5]] },
      { from: "upA", to: "upB", draw: (t) => t.bypass("R", 123, -5, 10), kind: "low", tunnel: true, pads: [["mid", "boost"]] },
      // dragged across the corner of the desktop: no barriers
      { from: "x1", to: "x2", width: 11, walls: false, draw: (t) => t.cut("L", 130, 20), pads: [["mid", "boost", 1.5]] },
    ],
  }),

  // THE FINAL ONE — everything at once: a spiral, a flight down from it, the
  // open sea, a dive, a cannon and a three-lane run to the line. The palette
  // turns into a different aesthetic every lap.
  design({
    id: "fusion", theme: "vapor", difficulty: 3, sea: 0, start: [0, 10, 0, 0], hazards: 4,
    draw: (t) =>
      t.go(50).mark("go").go(70)
        .left(90, 70).go(120, 6)
        .left(450, 55, 20)
        .mark("top").go(60).mark("k0")
        .go(110, -22)
        .left(90, 100, -6)
        .go(80, -4).mark("k1")
        .go(100, -4).mark("w0").go(160).mark("w1")
        .right(90, 80)
        .go(20, -2).mark("s0").go(70, -16)
        .left(180, 60)
        .go(52, 10).go(70, 8).mark("s1")
        .go(55, 4).mark("c0").go(8).mark("air")
        .left(90, 60).mark("land")
        .mark("homeA").go(BYPASS + 98, 6).mark("homeB")
        .right(90, 60),
    zones: [["k0", "k1", "sky"], ["w0", "w1", "water"], ["s0", "s1", "sub"]],
    holes: [["air", 80]],
    kick: 0,
    cannons: [["c0", "land", 30]],
    sectors: [["go", "techno"], ["k0", "aero"], ["w0", "aqua"], ["s0", "liquid"], ["land", "y2k"], ["homeB", "win98"]],
    traffic: 2,
    pads: [["go", "boost"], ["top", "boost", 1.5, -150], ["w1", "boost"], ["homeB", "boost"]],
    routes: [
      { from: "homeA", to: "homeB", draw: (t) => t.bypass("L", 98, 9, 6), kind: "high", pads: [["mid", "boost", 1.5]] },
      { from: "homeA", to: "homeB", draw: (t) => t.bypass("R", 98, -3, 6), kind: "low", pads: [["mid", "boost"]] },
    ],
  }),

  // ARCHIPELAGO — the boat circuit. Off the pier onto the open sea, where the
  // lane splits into two channels and a ramp; across an island; down a tube
  // that forks into three tunnels; and off the water in a plane over the
  // last side of the lap.
  design({
    id: "archipielago", theme: "aqua", difficulty: 2, sea: 0, start: [0, 4, 0, 0], hazards: 2,
    draw: (t) =>
      t.go(50).mark("go").go(110)
        .right(90, 80, -4).mark("w0")
        .mark("chA").go(BYPASS + 223).mark("chB")
        .go(60, 3).mark("w1").go(120).go(60, -3).mark("w2").go(60)
        .right(90, 80)
        .go(70).mark("s0").go(100, -22).go(15).mark("tA").go(BYPASS + 23).mark("tB").go(15).go(100, 22).mark("s1")
        .right(90, 80).mark("k0")
        .go(250, 30).left(360, 80, 18).weave("L", 25, 118).go(250, -44).mark("k1")
        .right(90, 80)
        .mark("homeA").go(BYPASS + 153).mark("homeB").go(10),
    zones: [["w0", "w1", "water"], ["w2", "s0", "water"], ["s0", "s1", "sub"], ["s1", "k0", "water"], ["k0", "k1", "sky"]],
    sectors: [["w1", "frutiger"], ["s0", "liquid"], ["k0", "aero"], ["k1", "sunset"]],
    traffic: 2,
    // waves on the main channel: they throw the boat into the air
    pads: [["go", "boost"], ["chA", "jump", 12, 150], ["chA", "jump", 12, 300], ["k1", "boost", 1.45, 20], ["homeB", "boost"]],
    routes: [
      { from: "chA", to: "chB", draw: (t) => t.bypass("L", 223, 0), afloat: true, kind: "side" },
      { from: "chA", to: "chB", draw: (t) => t.bypass("R", 223, 15), kind: "high", holes: [["mid", 18]], pads: [["mid", "boost", 1.7]] },
      { from: "tA", to: "tB", draw: (t) => t.bypass("L", 23, 0), afloat: true, kind: "side" },
      { from: "tA", to: "tB", draw: (t) => t.bypass("R", 23, 0), afloat: true, kind: "side" },
      { from: "homeA", to: "homeB", draw: (t) => t.bypass("L", 153, 9), kind: "high", pads: [["mid", "boost", 1.5]] },
      { from: "homeA", to: "homeB", draw: (t) => t.bypass("R", 153, -3), kind: "low", pads: [["mid", "boost"]] },
    ],
  }),

  // JET STREAM — the plane circuit. A runway, and then two thirds of the lap in
  // the air: a climb of fifty units, a dive, a stretch where the flight line
  // splits into a high one and a low one, another climb and the glide home.
  design({
    id: "corriente", theme: "aero", difficulty: 2, start: [0, 8, 0, 0], hazards: 2,
    draw: (t) =>
      t.go(50).mark("go").go(110).mark("k0")
        .weave("R", 30, 150, 40).left(360, 100, 28).left(90, 140, 10)
        .go(280, -48).go(20).mark("skyA").go(BYPASS + 123).mark("skyB")
        .left(90, 140, -10)
        .weave("L", 30, 115, 22).mark("dive").weave("R", 30, 115, -30)
        .left(90, 140, -6)
        .go(200, -6).mark("k1").mark("runA").go(BYPASS + 223).mark("runB")
        .left(90, 140),
    zones: [["k0", "k1", "sky"]],
    sectors: [["k0", "dreamcore"], ["skyA", "vapor"], ["dive", "sunset"], ["k1", "aero"]],
    traffic: 2,
    pads: [["go", "boost", 1.5], ["k1", "boost", 1.45, 20], ["runB", "boost"]],
    routes: [
      { from: "skyA", to: "skyB", draw: (t) => t.bypass("L", 123, 12), afloat: true, kind: "high" },
      { from: "skyA", to: "skyB", draw: (t) => t.bypass("R", 123, -12), afloat: true, kind: "low" },
      { from: "runA", to: "runB", draw: (t) => t.bypass("L", 223, 18), kind: "high", holes: [["mid", 18]], pads: [["mid", "boost", 1.7]] },
      { from: "runA", to: "runB", draw: (t) => t.bypass("R", 223, -5), kind: "low", tunnel: true, pads: [["mid", "boost"]] },
    ],
  }),

  // ABYSSAL TRENCH — the submarine circuit. Forty units under the sea along
  // two sides of the lap, with the tube forking into a deep tunnel and a
  // shallow one, then up to the surface and home across an island.
  design({
    id: "fosa", theme: "aqua", difficulty: 3, sea: 0, start: [0, 4, 0, 0], hazards: 2,
    draw: (t) =>
      t.go(50).mark("go").go(110)
        .right(90, 80, -4).mark("w0")
        .go(120).mark("s0").go(100, -8).right(360, 70, -22).go(20).mark("tA").go(BYPASS + 123, -6).mark("tB").go(160, -4)
        .right(90, 80)
        .weave("L", 30, 100, 10).weave("R", 30, 100, 12).go(100, 18).mark("s1")
        .right(90, 80)
        .weave("R", 30, 100).mark("w1").go(60, 4).mark("landA").go(BYPASS + 263).mark("landB")
        .right(90, 80)
        .go(340),
    zones: [["w0", "s0", "water"], ["s0", "s1", "sub"], ["s1", "w1", "water"]],
    sectors: [["s0", "liquid"], ["tA", "cyberpunk"], ["s1", "aqua"], ["w1", "frutiger"]],
    traffic: 3,
    pads: [["go", "boost"], ["w1", "jump", 12, -110], ["landB", "boost"]],
    routes: [
      { from: "tA", to: "tB", draw: (t) => t.bypass("L", 123, -10, -6), afloat: true, kind: "low" },
      { from: "tA", to: "tB", draw: (t) => t.bypass("R", 123, 9, -6), afloat: true, kind: "high" },
      { from: "landA", to: "landB", draw: (t) => t.bypass("L", 263, 9), kind: "high", holes: [["mid", 16]], pads: [["mid", "boost", 1.5]] },
      { from: "landA", to: "landB", draw: (t) => t.bypass("R", 263, -3), kind: "low", pads: [["mid", "boost"]] },
    ],
  }),

  // CHROME CLOVER — four straights and four full loops. Every loop climbs and
  // brings the road back across the straight it came from, a floor higher, so
  // the lap is one long descent that keeps passing over itself.
  design({
    id: "trebol", theme: "y2k", difficulty: 3, start: [0, 28, 0, 0], hazards: 3,
    draw: (t) => {
      t.mark("a1").go(BYPASS + 73, -16).mark("b1").go(70, -4).left(270, 70, 20);
      t.go(110, -7).mark("run").go(40, -3).mark("jump").go(170, -10).left(270, 70, 20);
      t.mark("a3").go(BYPASS + 73, -16).mark("b3").go(70, -4).left(270, 70, 20);
      t.go(160, -10).mark("last").go(160, -10).left(270, 70, 20);
    },
    holes: [["jump", 11]],
    sectors: [["run", "vapor"], ["a3", "liquid"], ["last", "dreamcore"]],
    traffic: 3,
    pads: [["a1", "boost", 1.45, 30], ["run", "boost", 1.5], ["last", "boost"]],
    routes: [
      { from: "a1", to: "b1", draw: (t) => t.bypass("R", 73, -4, -16), kind: "low", tunnel: true, pads: [["mid", "boost"]] },
      { from: "a3", to: "b3", draw: (t) => t.bypass("R", 73, 4, -16), kind: "high", pads: [["mid", "boost", 1.5]] },
    ],
  }),

  // CRATER — starts on the rim, forty units up, and goes down the inside of
  // the crater in two full turns. Three lanes across the floor, and a cannon
  // back up to the rim.
  design({
    id: "crater", theme: "sunset", difficulty: 3, start: [0, 40, 0, 0], hazards: 2,
    draw: (t) =>
      t.go(50).mark("go").go(150).mark("spiral")
        .right(720, 70, -36).mark("pit")
        .go(150)
        .left(180, 90)
        .mark("floorA").go(BYPASS + 171).mark("floorB")
        .mark("c0").go(8).mark("air")
        .left(180, 90, 36).mark("land").go(6),
    zones: [["spiral", "pit", "mag"]],
    holes: [["air", 270]],
    kick: 0,
    cannons: [["c0", "land", 40]],
    sectors: [["spiral", "vapor"], ["pit", "cyberpunk"], ["floorB", "sunset"]],
    traffic: 2,
    pads: [["go", "boost"], ["pit", "boost", 1.5, -250], ["pit", "boost", 1.5, -560]],
    routes: [
      { from: "floorA", to: "floorB", draw: (t) => t.bypass("L", 171, 9), kind: "high", holes: [["mid", 12]], pads: [["mid", "boost", 1.5]] },
      { from: "floorA", to: "floorB", draw: (t) => t.bypass("R", 171, -2.5), kind: "low", pads: [["mid", "boost"]] },
    ],
  }),

  // ROLLER COASTER — a long climb to forty-eight units, two falls of sixteen
  // on the way back down, a jump between them and a weave through the valley.
  design({
    id: "montana", theme: "sunset", difficulty: 2, start: [0, 8, 0, 0], hazards: 3,
    draw: (t) =>
      t.mark("sA").go(50).mark("go").go(210).mark("sB")
        .left(90, 90, 6)
        .mark("climbA").go(BYPASS + 323, 34).mark("climbB").go(15)
        .left(90, 90)
        .go(60).drop(-16).go(100).mark("j1").go(60).drop(-16)
        .left(90, 90, -4)
        .weave("R", 30, 150, -4).go(75).mark("run").go(40).mark("j2").go(100)
        .left(90, 90)
        .go(32),
    holes: [["j1", 10], ["j2", 8]],
    sectors: [["climbA", "dreamcore"], ["j1", "vapor"], ["run", "sunset"]],
    traffic: 3,
    pads: [["go", "boost"], ["climbB", "boost"], ["run", "boost", 1.5]],
    routes: [
      { from: "climbA", to: "climbB", draw: (t) => t.bypass("L", 323, -5, 34), kind: "low", tunnel: true, pads: [["mid", "boost"]] },
      { from: "climbA", to: "climbB", draw: (t) => t.bypass("R", 323, 16, 34), kind: "high", holes: [["mid", 14]], pads: [["mid", "boost", 1.7]] },
      { from: "sA", to: "sB", draw: (t) => t.bypass("R", 83, -4), kind: "low", tunnel: true, pads: [["mid", "boost"]] },
    ],
  }),

  // METROPOLIS — the big land circuit. A long climb with a road over it and a
  // tunnel under it, a helix, a jump and a fall, three lanes down the far
  // side and a ramp lane home: there is a choice to make on every side.
  design({
    id: "metropolis", theme: "cyberpunk", difficulty: 3, start: [0, 10, 0, 0], hazards: 4,
    draw: (t) =>
      t.go(50).mark("go").go(100)
        .mark("aA").go(BYPASS + 223, 14).mark("aB").go(60)
        .right(90, 80, 2)
        .go(60).mark("hA").left(360, 60, 14).mark("helix")
        .go(120).mark("run").go(40).mark("j1").go(40).drop(-14).go(100)
        .right(90, 80)
        .mark("cA").go(BYPASS + 253, -10).mark("cB")
        .weave("L", 30, 90, -6)
        .right(90, 80)
        .go(93).mark("dA").go(BYPASS + 123).mark("dB")
        .right(90, 80),
    zones: [["hA", "helix", "mag"]],
    holes: [["j1", 9]],
    sectors: [["aB", "techno"], ["helix", "y2k"], ["cA", "vapor"], ["dA", "cyberpunk"]],
    traffic: 4,
    pads: [["go", "boost"], ["aB", "boost"], ["run", "boost", 1.5], ["cB", "boost"], ["dB", "boost"]],
    routes: [
      { from: "aA", to: "aB", draw: (t) => t.bypass("L", 223, 16, 14), kind: "high", holes: [["mid", 14]], pads: [["mid", "boost", 1.6]] },
      { from: "aA", to: "aB", draw: (t) => t.bypass("R", 223, -5, 14), kind: "low", tunnel: true, pads: [["mid", "boost"]] },
      { from: "cA", to: "cB", draw: (t) => t.bypass("L", 253, 18, -10), kind: "high", holes: [["mid", 18]], pads: [["mid", "boost", 1.7]] },
      { from: "cA", to: "cB", draw: (t) => t.bypass("R", 253, -9, -10), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
      { from: "dA", to: "dB", draw: (t) => t.bypass("R", 123, 8), kind: "high", holes: [["mid", 14]], pads: [["mid", "boost", 1.5]] },
      // straight across the first corner: no barriers and a gap in the middle
      { from: "aB", to: "hA", width: 11, walls: false, draw: (t) => t.cut("R", 130, 30, 2), holes: [["mid", 10]], pads: [["mid", "boost", 1.5]] },
    ],
  }),

  // GRAND ODYSSEY — every craft in one lap, a side each: out to sea by boat,
  // down a forking tube by submarine, up in a corkscrew by plane with the
  // flight line splitting in two, and home by road on three lanes.
  design({
    id: "odisea", theme: "dreamcore", difficulty: 3, sea: 0, start: [0, 6, 0, 0], hazards: 3,
    draw: (t) =>
      t.go(50).mark("go").go(110).go(60, -6).mark("w0")
        .mark("chA").go(BYPASS + 183).mark("chB").go(20)
        .right(90, 90)
        .go(20).mark("s0").go(100, -20).go(20).mark("tA").go(BYPASS + 103, -4).mark("tB").go(30).go(110, 24).mark("s1")
        .right(90, 90).mark("k0")
        .go(190, 34).left(360, 90, 16).go(40).mark("skyA").go(BYPASS + 83).mark("skyB").go(30).go(80, -20)
        .right(90, 90, -10)
        .go(160, -14).mark("k1").mark("dA").go(BYPASS + 223).mark("dB")
        .right(90, 90),
    zones: [["w0", "s0", "water"], ["s0", "s1", "sub"], ["s1", "k0", "water"], ["k0", "k1", "sky"]],
    sectors: [["w0", "aqua"], ["s0", "liquid"], ["tA", "cyberpunk"], ["s1", "aero"], ["skyA", "vapor"], ["k1", "dreamcore"]],
    traffic: 2,
    pads: [["go", "boost"], ["chA", "jump", 12, 150], ["chA", "jump", 12, 280], ["k1", "boost", 1.45, 20], ["dB", "boost"]],
    routes: [
      { from: "chA", to: "chB", draw: (t) => t.bypass("L", 183, 0), afloat: true, kind: "side" },
      { from: "chA", to: "chB", draw: (t) => t.bypass("R", 183, 7), kind: "high", holes: [["mid", 16]], pads: [["mid", "boost", 1.5]] },
      { from: "tA", to: "tB", draw: (t) => t.bypass("L", 103, -10, -4), afloat: true, kind: "low" },
      { from: "tA", to: "tB", draw: (t) => t.bypass("R", 103, 9, -4), afloat: true, kind: "high" },
      { from: "skyA", to: "skyB", draw: (t) => t.bypass("L", 83, 12), afloat: true, kind: "high" },
      { from: "skyA", to: "skyB", draw: (t) => t.bypass("R", 83, -12), afloat: true, kind: "low" },
      { from: "dA", to: "dB", draw: (t) => t.bypass("L", 223, 18), kind: "high", holes: [["mid", 18]], pads: [["mid", "boost", 1.7]] },
      { from: "dA", to: "dB", draw: (t) => t.bypass("R", 223, -9), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
    ],
  }),

  // CLOUD SUMMIT — the tall one. Two full turns up the mountain to fifty
  // units, along the ridge on three levels, down the far face in two falls
  // with a springboard between them, and a cannon over the last corner.
  design({
    id: "cumbre", theme: "eco", difficulty: 3, start: [0, 8, 0, 0], hazards: 3,
    draw: (t) =>
      t.go(44).mark("go").go(130)
        .right(720, 65, 40).mark("up").go(120, 6)
        .left(90, 80, 4)
        .mark("bA").go(BYPASS + 173).mark("bB").go(20).mark("c0x").go(30)
        .left(90, 80)
        .go(30).mark("c1").go(20).drop(-15).go(60).mark("run").go(40).mark("j1").go(48).drop(-15).go(33)
        .left(90, 80, -4)
        .weave("R", 30, 100, -8)
        .go(132, -8).mark("c0").go(8).mark("air").go(60)
        .left(90, 80).mark("land").go(6),
    holes: [["air", 180]],
    kick: 0,
    cannons: [["c0", "land", 30]],
    sectors: [["up", "sunset"], ["bA", "dreamcore"], ["run", "vapor"], ["land", "eco"]],
    traffic: 3,
    pads: [["go", "boost"], ["up", "boost", 1.5, -400], ["bB", "boost"], ["run", "boost", 1.5], ["j1", "jump", 13]],
    routes: [
      { from: "bA", to: "bB", draw: (t) => t.bypass("L", 173, 9), kind: "high", holes: [["mid", 12]], pads: [["mid", "boost", 1.5]] },
      { from: "bA", to: "bB", draw: (t) => t.bypass("R", 173, -4), kind: "low", tunnel: true, pads: [["mid", "boost"]] },
      // off the end of the ridge on the diagonal, straight at the first fall
      { from: "c0x", to: "c1", width: 11, walls: false, draw: (t) => t.cut("L", 101.8, 20), pads: [["mid", "boost", 1.5]] },
    ],
  }),

  // THE KNOT — a figure of eight. One loop climbs, the lap crosses over its
  // own start straight on a bridge with a gap in it, and the other loop comes
  // back down. Miss the gap and you land on the road below, a little behind.
  design({
    id: "nudo", theme: "vapor", difficulty: 2, start: [0, 8, -150, 0], hazards: 3,
    draw: (t) =>
      t.mark("sA").go(50).mark("go").go(250).mark("sB")
        .left(270, 150, 13).mark("over")
        .go(110).mark("run").go(34).mark("gap").go(156).mark("overB")
        .right(270, 150, -13),
    holes: [["gap", 12]],
    sectors: [["over", "y2k"], ["gap", "sunset"]],
    traffic: 3,
    pads: [["go", "boost"], ["run", "boost", 1.5], ["over", "boost", 1.4, -350], ["gap", "boost", 1.4, 500]],
    routes: [
      { from: "sA", to: "sB", draw: (t) => t.bypass("R", 123, -4), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
      { from: "sA", to: "sB", draw: (t) => t.bypass("L", 123, 0), kind: "side", pads: [["mid", "boost"]] },
      { from: "over", to: "overB", draw: (t) => t.bypass("L", 123, 5), kind: "high", pads: [["mid", "boost"]] },
    ],
  }),

  // STAR LIFT — two turns up a tower to fifty units and off the top in a
  // plane: the flight line splits into a high one and a low one, sweeps round
  // two sides of the lap on the way down and lands on a three-lane runway.
  design({
    id: "ascensor", theme: "techno", difficulty: 3, start: [0, 8, 0, 0], hazards: 3,
    draw: (t) =>
      t.go(50).mark("go").go(130)
        .right(720, 65, 44).mark("top").go(120, 4)
        .left(90, 100).mark("k0")
        .go(120, 14).mark("skyA").go(BYPASS + 123).mark("skyB").go(30).go(150, -20)
        .left(90, 100, -8)
        .weave("R", 30, 150, -16)
        .left(90, 100, -8)
        .go(140, -10).mark("k1").mark("dA").go(BYPASS + 223).mark("dB").go(60)
        .left(90, 100),
    zones: [["k0", "k1", "sky"]],
    sectors: [["top", "y2k"], ["k0", "dreamcore"], ["skyB", "aero"], ["k1", "techno"]],
    traffic: 3,
    pads: [["go", "boost"], ["top", "boost", 1.5, -420], ["top", "boost", 1.5, -40], ["k1", "boost", 1.45, 20], ["dB", "boost"]],
    routes: [
      { from: "skyA", to: "skyB", draw: (t) => t.bypass("L", 123, 12), afloat: true, kind: "high" },
      { from: "skyA", to: "skyB", draw: (t) => t.bypass("R", 123, -12), afloat: true, kind: "low" },
      { from: "dA", to: "dB", draw: (t) => t.bypass("L", 223, 20), kind: "high", holes: [["mid", 18]], pads: [["mid", "boost", 1.7]] },
      { from: "dA", to: "dB", draw: (t) => t.bypass("R", 223, -9), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
    ],
  }),

  // ATLANTIS — the long way down. Out over the sea on two channels and a ramp,
  // under in a spiral to forty units, a weave along the bottom, a tube that
  // forks, and a long climb back to the surface and the pier.
  design({
    id: "atlantida", theme: "liquid", difficulty: 3, sea: 0, start: [0, 4, 0, 0], hazards: 2,
    draw: (t) =>
      t.go(50).mark("go").go(90).go(60, -4).mark("w0")
        .mark("chA").go(BYPASS + 263).mark("chB")
        .right(90, 90)
        .go(20).mark("s0").go(100, -18).right(360, 70, -18).go(20).mark("deep").go(140, -4).weave("L", 30, 110)
        .right(90, 90)
        .mark("tA").go(BYPASS + 183).mark("tB").go(30).go(200, 40).mark("s1").go(50)
        .right(90, 90)
        .go(40).mark("w1").go(60, 4).mark("dA").go(BYPASS + 223).mark("dB")
        .right(90, 90),
    zones: [["w0", "s0", "water"], ["s0", "s1", "sub"], ["s1", "w1", "water"]],
    sectors: [["w0", "aqua"], ["s0", "liquid"], ["deep", "cyberpunk"], ["tA", "vapor"], ["s1", "aqua"], ["w1", "frutiger"]],
    traffic: 2,
    pads: [["go", "boost"], ["chA", "jump", 12, 150], ["chA", "jump", 12, 320], ["dB", "boost"]],
    routes: [
      { from: "chA", to: "chB", draw: (t) => t.bypass("L", 263, 0), afloat: true, kind: "side" },
      { from: "chA", to: "chB", draw: (t) => t.bypass("R", 263, 7), kind: "high", holes: [["mid", 16]], pads: [["mid", "boost", 1.5]] },
      { from: "tA", to: "tB", draw: (t) => t.bypass("L", 183, -10), afloat: true, kind: "low" },
      { from: "tA", to: "tB", draw: (t) => t.bypass("R", 183, 9), afloat: true, kind: "high" },
      { from: "dA", to: "dB", draw: (t) => t.bypass("L", 223, 18), kind: "high", holes: [["mid", 18]], pads: [["mid", "boost", 1.7]] },
      { from: "dA", to: "dB", draw: (t) => t.bypass("R", 223, -8), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
    ],
  }),

  // THE BACKROOMS — indoors, on one level, and every corridor looks like the
  // last one. Five ways to go wrong, two holes in the wall that put you
  // somewhere else, and strip lights on their way out.
  design({
    id: "backrooms", theme: "backrooms", difficulty: 2, indoor: true, start: [0, 8, 0, 0], hazards: 4,
    draw: (t) =>
      t.go(50).mark("go").go(60).mark("aA").go(BYPASS + 143).mark("aB").go(30)
        .right(90, 30)
        .go(40).mark("p1").go(120).mark("bA").go(BYPASS + 63).mark("bB").go(40)
        .right(90, 30)
        .weave("L", 30, 60).go(20).mark("cA").go(BYPASS + 123).mark("cB").go(20)
        .right(90, 30)
        .go(60).mark("p2").go(100).weave("R", 25, 70).mark("p3").go(161.7)
        .right(90, 30),
    portals: [["p1", "bA"], ["p2", "p3"]],
    sectors: [["cA", "liminal"], ["p2", "backrooms"]],
    traffic: 3,
    pads: [["go", "boost"], ["aB", "boost"], ["bB", "boost"], ["cB", "boost"]],
    routes: [
      { from: "aA", to: "aB", draw: (t) => t.bypass("L", 143, 0), kind: "side", pads: [["mid", "boost"]] },
      { from: "aA", to: "aB", draw: (t) => t.bypass("R", 143, -4), kind: "low", pads: [["mid", "boost", 1.5]] },
      { from: "bA", to: "bB", draw: (t) => t.bypass("R", 63, 0), kind: "side" },
      { from: "cA", to: "cB", draw: (t) => t.bypass("L", 123, 0), kind: "side", pads: [["mid", "boost"]] },
      { from: "cA", to: "cB", draw: (t) => t.bypass("R", 123, -4), kind: "low", pads: [["mid", "boost", 1.5]] },
    ],
  }),

  // POOLROOMS — white tile and still water, indoors. Two pools to cross by
  // boat, a slide down to a drained one that you float across on magnets, and
  // a diving board over the first.
  design({
    id: "piscinas", theme: "liminal", difficulty: 2, indoor: true, start: [0, 12, 0, 0], hazards: 2,
    draw: (t) =>
      t.go(50).mark("go").go(40).mark("chA").go(BYPASS + 83).mark("chB").go(50, -3).mark("w0").go(100)
        .left(90, 50)
        .go(60).mark("w1").go(40, 3).go(40).drop(-12).go(60).mark("mA").go(190).mark("mB")
        .left(90, 50)
        .mark("cA").go(BYPASS + 223, 6).mark("cB").go(100, 3)
        .left(90, 50)
        .go(60).mark("w2").go(200).mark("w3").go(60, 3).go(100)
        .left(90, 50),
    zones: [["w0", "w1", "water"], ["mA", "mB", "mag"], ["w2", "w3", "water"]],
    sectors: [["mA", "aqua"], ["cA", "liminal"], ["w2", "dreamcore"], ["w3", "liminal"]],
    traffic: 2,
    pads: [["go", "boost"], ["mA", "jump", 11, 60], ["cB", "boost"], ["w3", "boost"]],
    routes: [
      { from: "chA", to: "chB", draw: (t) => t.bypass("L", 83, 0), kind: "side", pads: [["mid", "boost"]] },
      { from: "chA", to: "chB", draw: (t) => t.bypass("R", 83, 6), kind: "high", holes: [["mid", 12]], pads: [["mid", "boost", 1.5]] },
      { from: "cA", to: "cB", draw: (t) => t.bypass("L", 223, 8, 6), kind: "high", pads: [["mid", "boost", 1.5]] },
      { from: "cA", to: "cB", draw: (t) => t.bypass("R", 223, -4, 6), kind: "low", pads: [["mid", "boost"]] },
    ],
  }),

  // LUCID DREAM — nothing holds: the road winds up on itself and you float up
  // it, doors stand open in the air, a hole in the wall puts you further on,
  // and near the end the road simply stops and a cannon takes you over.
  design({
    id: "sueno", theme: "dreamcore", difficulty: 3, start: [0, 20, 0, 0], hazards: 3,
    draw: (t) =>
      t.go(50).mark("go").go(110).mark("mA").right(360, 70, 16).go(140).mark("mB")
        .mark("aA").go(BYPASS + 83).mark("aB")
        .left(90, 80)
        .go(60).drop(-12).go(60).mark("run").go(40).mark("j1").go(110).mark("p1").go(140).mark("pOut").go(40)
        .left(90, 80, -4)
        .mark("m2A").weave("R", 30, 120, 6).go(40).mark("m2B")
        .mark("cA").go(BYPASS + 103, -6).mark("cB")
        .left(90, 80)
        .go(100).mark("c0").go(8).mark("air").go(150).mark("land").go(212).mark("eB").go(10)
        .left(90, 80),
    zones: [["mA", "mB", "mag"], ["m2A", "m2B", "mag"]],
    holes: [["air", 140]],
    kick: 0,
    cannons: [["c0", "land", 34]],
    portals: [["p1", "pOut"]],
    sectors: [["mA", "vapor"], ["aA", "dreamcore"], ["run", "liminal"], ["m2A", "aero"], ["c0", "dreamcore"]],
    traffic: 2,
    pads: [["go", "boost"], ["run", "boost", 1.5], ["j1", "jump", 13], ["m2A", "jump", 12, 130], ["cB", "boost"]],
    routes: [
      { from: "aA", to: "aB", draw: (t) => t.bypass("L", 83, 7), kind: "high", holes: [["mid", 12]], pads: [["mid", "boost", 1.5]] },
      { from: "aA", to: "aB", draw: (t) => t.bypass("R", 83, -4), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
      { from: "cA", to: "cB", draw: (t) => t.bypass("L", 103, 0, -6), kind: "side", pads: [["mid", "boost"]] },
      { from: "cA", to: "cB", draw: (t) => t.bypass("R", 103, 8, -6), kind: "high", holes: [["mid", 12]], pads: [["mid", "boost", 1.5]] },
      { from: "land", to: "eB", draw: (t) => t.bypass("L", 35, 0), kind: "side", pads: [["mid", "boost"]] },
    ],
  }),

  // FURY VOLCANO — up the outside of the cone on three levels, two turns
  // round the crater floating on magnets, down the far side in three falls,
  // and a cannon over the lava to finish.
  design({
    id: "volcan", theme: "sunset", difficulty: 3, start: [0, 8, 0, 0], hazards: 3,
    draw: (t) =>
      t.go(50).mark("go").go(90).mark("aA").go(BYPASS + 123, 12).mark("aB").go(60, 4)
        .left(90, 80, 4)
        .mark("mA").right(720, 60, 36).mark("mB").go(60).mark("bA").go(BYPASS + 123).mark("bB").go(30).mark("v1").go(30)
        .left(90, 80)
        .go(30).mark("c1").go(30).drop(-15).go(70).mark("run").go(40).mark("j1").go(60).drop(-15).go(60).drop(-14).go(58).mark("c2").go(50, -2)
        .left(90, 80, -4)
        .go(50, -2).mark("c3").go(50, -4).mark("c0").go(8).mark("air").go(150).mark("land").go(162)
        .left(90, 80),
    zones: [["mA", "mB", "mag"]],
    holes: [["air", 140]],
    kick: 0,
    cannons: [["c0", "land", 36]],
    sectors: [["mA", "cyberpunk"], ["bA", "vapor"], ["run", "cyberpunk"], ["c0", "sunset"]],
    traffic: 3,
    pads: [["go", "boost"], ["aB", "boost"], ["bB", "boost"], ["run", "boost", 1.5], ["j1", "jump", 13]],
    routes: [
      { from: "aA", to: "aB", draw: (t) => t.bypass("L", 123, 9, 12), kind: "high", pads: [["mid", "boost", 1.5]] },
      { from: "aA", to: "aB", draw: (t) => t.bypass("R", 123, -4, 12), kind: "low", tunnel: true, pads: [["mid", "boost"]] },
      { from: "bA", to: "bB", draw: (t) => t.bypass("L", 123, 9), kind: "high", holes: [["mid", 12]], pads: [["mid", "boost", 1.5]] },
      { from: "bA", to: "bB", draw: (t) => t.bypass("R", 123, -5), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
      // across the corner off the rim, with a gap
      { from: "v1", to: "c1", width: 11, walls: false, draw: (t) => t.cut("L", 101.8, 20), pads: [["mid", "boost", 1.5]] },
      // and across the last corner, down the slope to the cannon
      { from: "c2", to: "c3", width: 11, walls: false, draw: (t) => t.cut("L", 130.1, 20, -8), holes: [["mid", 10]], pads: [["mid", "boost", 1.5]] },
    ],
  }),

  // THE MALL — indoors, on two floors, with nobody in it. A lift that takes
  // you straight up, a moving walkway you float along, a mezzanine with a gap
  // in it and a fall back down to the ground floor.
  design({
    id: "centro", theme: "liminal", difficulty: 2, indoor: true, start: [0, 8, 0, 0], hazards: 3,
    draw: (t) =>
      t.go(50).mark("go").go(50).mark("aA").go(BYPASS + 223).mark("aB").go(20)
        .right(90, 40)
        .go(40).mark("up").go(140, 10).go(40).mark("p1").go(180)
        .right(90, 40)
        .go(20).mark("cA").go(BYPASS + 223).mark("cB").go(60).mark("x1").go(40)
        .right(90, 40)
        .go(40).mark("x2").go(20).drop(-10).go(60).mark("mA").go(160).mark("mB").go(93)
        .right(90, 40),
    zones: [["mA", "mB", "mag"]],
    portals: [["up", "p1"]],
    sectors: [["up", "win98"], ["cA", "liminal"], ["mA", "aqua"], ["mB", "liminal"]],
    traffic: 3,
    pads: [["go", "boost"], ["aB", "boost"], ["cB", "boost"], ["mA", "boost", 1.4, 20]],
    routes: [
      { from: "aA", to: "aB", draw: (t) => t.bypass("L", 223, 0), kind: "side", pads: [["mid", "boost"]] },
      { from: "aA", to: "aB", draw: (t) => t.bypass("R", 223, -4), kind: "low", pads: [["mid", "boost", 1.5]] },
      { from: "cA", to: "cB", draw: (t) => t.bypass("L", 223, 14), kind: "high", holes: [["mid", 14]], pads: [["mid", "boost", 1.6]] },
      { from: "cA", to: "cB", draw: (t) => t.bypass("R", 223, 0), kind: "side", pads: [["mid", "boost"]] },
      // a service corridor across the corner
      { from: "x1", to: "x2", width: 11, draw: (t) => t.cut("R", 59.4, 20), kind: "cut", pads: [["mid", "boost", 1.5]] },
    ],
  }),

  // AURORA GLACIER — a fjord by boat on two channels, an ice sheet you slide
  // across on magnets, up off the ice in a plane with the flight line split
  // in two, and down onto a three-lane road home.
  design({
    id: "glaciar", theme: "aero", difficulty: 2, sea: 0, start: [0, 6, 0, 0], hazards: 2,
    draw: (t) =>
      t.go(50).mark("go").go(110).go(60, -6).mark("w0").mark("chA").go(BYPASS + 183).mark("chB").go(20)
        .left(90, 90)
        .go(40).mark("w1").go(60, 6).mark("mA").weave("L", 30, 110, 8).go(60).mark("mB").go(140, 6)
        .left(90, 90, 4).mark("k0")
        .go(130, 26).go(30).mark("skyA").go(BYPASS + 123).mark("skyB").go(30).go(110, -24)
        .left(90, 90, -8)
        .go(140, -12).mark("k1").mark("dA").go(BYPASS + 203).mark("dB")
        .left(90, 90),
    zones: [["w0", "w1", "water"], ["mA", "mB", "mag"], ["k0", "k1", "sky"]],
    sectors: [["w0", "aqua"], ["mA", "dreamcore"], ["k0", "aero"], ["skyB", "vapor"], ["k1", "frutiger"]],
    traffic: 2,
    pads: [["go", "boost"], ["chA", "jump", 12, 160], ["mA", "jump", 11, 120], ["k1", "boost", 1.45, 20], ["dB", "boost"]],
    routes: [
      { from: "chA", to: "chB", draw: (t) => t.bypass("L", 183, 0), afloat: true, kind: "side" },
      { from: "chA", to: "chB", draw: (t) => t.bypass("R", 183, 7), kind: "high", holes: [["mid", 16]], pads: [["mid", "boost", 1.5]] },
      { from: "skyA", to: "skyB", draw: (t) => t.bypass("L", 123, 12), afloat: true, kind: "high" },
      { from: "skyA", to: "skyB", draw: (t) => t.bypass("R", 123, -12), afloat: true, kind: "low" },
      { from: "dA", to: "dB", draw: (t) => t.bypass("L", 203, 16), kind: "high", holes: [["mid", 16]], pads: [["mid", "boost", 1.7]] },
      { from: "dA", to: "dB", draw: (t) => t.bypass("R", 203, -8), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
    ],
  }),

  // ORBITAL STATION — half of it is flown and half of it is floated: a
  // magnetic ring up to the docks, out through space in a plane, a magnetic
  // weave along the hull and a jump across the gap in it.
  design({
    id: "estacion", theme: "y2k", difficulty: 3, start: [0, 30, 0, 0], hazards: 3,
    draw: (t) =>
      t.go(50).mark("go").go(70).mark("mA").left(360, 70, 14).go(100).mark("mB").mark("aA").go(BYPASS + 163).mark("aB")
        .right(90, 80)
        .go(30).mark("k0").go(70, 18).go(30).mark("skyA").go(BYPASS + 103).mark("skyB").go(30).go(20, -8)
        .right(90, 80, -10)
        .go(120, -14).mark("k1").go(40).mark("m2A").weave("L", 30, 100).go(40).mark("m2B").go(100).mark("x1").go(60)
        .right(90, 80)
        .go(60).mark("run").go(40).mark("gap").go(60).mark("dA").go(BYPASS + 123).mark("dB")
        .right(90, 80),
    zones: [["mA", "mB", "mag"], ["k0", "k1", "sky"], ["m2A", "m2B", "mag"]],
    holes: [["gap", 9]],
    sectors: [["mA", "techno"], ["k0", "vapor"], ["m2A", "cyberpunk"], ["run", "y2k"]],
    traffic: 2,
    pads: [["go", "boost"], ["aB", "boost"], ["k1", "boost", 1.45, 20], ["run", "boost", 1.5], ["dB", "boost"]],
    routes: [
      { from: "aA", to: "aB", draw: (t) => t.bypass("L", 163, 9), kind: "high", holes: [["mid", 12]], pads: [["mid", "boost", 1.5]] },
      { from: "aA", to: "aB", draw: (t) => t.bypass("R", 163, -4), kind: "low", tunnel: true, pads: [["mid", "boost"]] },
      { from: "skyA", to: "skyB", draw: (t) => t.bypass("L", 103, 12), afloat: true, kind: "high" },
      { from: "skyA", to: "skyB", draw: (t) => t.bypass("R", 103, -12), afloat: true, kind: "low" },
      { from: "dA", to: "dB", draw: (t) => t.bypass("L", 123, -6), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
      { from: "dA", to: "dB", draw: (t) => t.bypass("R", 123, 8), kind: "high", pads: [["mid", "boost", 1.5]] },
      // off the hull and across open space to the run-up
      { from: "x1", to: "run", width: 11, walls: false, draw: (t) => t.cut("R", 130), holes: [["mid", 10]], pads: [["mid", "boost", 1.5]] },
    ],
  }),

  // THE GARDEN OF EYES — the last one, and everything at once. Eleven other
  // ways round: over and under both halves of the first straight, across
  // three corners on the diagonal, a magnetic helix, a hole in the hedge that
  // skips the weave, and a cannon over the flower beds. Whichever way you go,
  // you are being watched.
  design({
    id: "eden", theme: "eden", difficulty: 3, start: [0, 12, 0, 0], hazards: 4,
    draw: (t) =>
      t.go(50).mark("go").go(40)
        .mark("a1A").go(BYPASS + 123).mark("a1B").go(20).mark("a2A").go(BYPASS + 123).mark("a2B")
        .go(50).mark("k1a").go(30)
        .left(90, 80, 4)
        .go(30).mark("k1b").go(40).mark("mA").right(360, 60, 14).go(40).mark("mB").go(20)
        .mark("bA").go(BYPASS + 173).mark("bB").go(50).mark("k2a").go(30)
        .left(90, 80)
        .go(30).mark("k2b").go(40).mark("p1").weave("R", 30, 85).mark("pOut").go(70)
        .mark("cA").go(BYPASS + 223, -10).mark("cB").go(50).mark("k3a").go(30)
        .left(90, 80, -4)
        .go(30).mark("k3b").go(40).mark("m2A").weave("R", 30, 80, -4).go(30).mark("m2B")
        .go(40).mark("c0").go(8).mark("air").go(120).mark("land").go(132)
        .left(90, 80),
    zones: [["mA", "mB", "mag"], ["m2A", "m2B", "mag"]],
    holes: [["air", 110]],
    kick: 0,
    cannons: [["c0", "land", 30]],
    portals: [["p1", "pOut"]],
    sectors: [["mA", "dreamcore"], ["bA", "eden"], ["p1", "liminal"], ["cA", "eden"], ["m2A", "vapor"], ["land", "eden"]],
    traffic: 4,
    pads: [
      ["go", "boost"], ["a1B", "jump", 11, 8], ["a2B", "boost"], ["mA", "jump", 12, 150], ["bB", "boost"],
      ["pOut", "jump", 12, 30], ["cB", "boost", 1.5], ["m2A", "jump", 12, 90], ["land", "boost", 1.5, 20],
    ],
    routes: [
      { from: "a1A", to: "a1B", draw: (t) => t.bypass("L", 123, 12), kind: "high", holes: [["mid", 14]], pads: [["mid", "boost", 1.6]] },
      { from: "a1A", to: "a1B", draw: (t) => t.bypass("R", 123, -6), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
      { from: "a2A", to: "a2B", draw: (t) => t.bypass("L", 123, -6), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
      { from: "a2A", to: "a2B", draw: (t) => t.bypass("R", 123, 12), kind: "high", holes: [["mid", 14]], pads: [["mid", "boost", 1.6]] },
      { from: "k1a", to: "k1b", width: 11, walls: false, draw: (t) => t.cut("L", 101.8, 20, 4), pads: [["mid", "boost", 1.5]] },
      { from: "bA", to: "bB", draw: (t) => t.bypass("L", 173, 14), kind: "high", holes: [["mid", 16]], pads: [["mid", "boost", 1.6]] },
      { from: "bA", to: "bB", draw: (t) => t.bypass("R", 173, -7), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
      { from: "k2a", to: "k2b", width: 11, walls: false, draw: (t) => t.cut("L", 101.8, 20), holes: [["mid", 10]], pads: [["mid", "boost", 1.5]] },
      { from: "cA", to: "cB", draw: (t) => t.bypass("L", 223, 18, -10), kind: "high", holes: [["mid", 18]], pads: [["mid", "boost", 1.7]] },
      { from: "cA", to: "cB", draw: (t) => t.bypass("R", 223, -9, -10), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
      { from: "k3a", to: "k3b", width: 11, walls: false, draw: (t) => t.cut("L", 101.8, 20, -4), pads: [["mid", "boost", 1.5]] },
    ],
  }),

  // GHOST LINE — the subway after the last train. Tunnels on one level and a
  // half, a stretch of live rail you float along, a service door that puts
  // you further down the line, and more trains than there should be.
  design({
    id: "metro", theme: "metro", difficulty: 2, indoor: true, start: [0, 8, 0, 0], hazards: 3,
    draw: (t) =>
      t.go(50).mark("go").go(50).mark("aA").go(BYPASS + 223).mark("aB").go(60)
        .right(90, 40)
        .go(40).mark("mA").go(160).mark("mB").go(40, -6).mark("p1").go(140).mark("pOut").go(60)
        .right(90, 40)
        .go(40).mark("cA").go(BYPASS + 263).mark("cB").go(80)
        .right(90, 40)
        .go(60, 6).mark("dA").go(BYPASS + 123).mark("dB").go(80)
        .right(90, 40),
    zones: [["mA", "mB", "mag"]],
    portals: [["p1", "pOut"]],
    sectors: [["mA", "liminal"], ["p1", "metro"], ["cA", "backrooms"], ["dA", "metro"]],
    traffic: 5,
    pads: [["go", "boost"], ["aB", "boost"], ["mA", "boost", 1.4, 20], ["cB", "boost"], ["dB", "boost"]],
    routes: [
      { from: "aA", to: "aB", draw: (t) => t.bypass("L", 223, 0), kind: "side", pads: [["mid", "boost"]] },
      { from: "aA", to: "aB", draw: (t) => t.bypass("R", 223, -6), kind: "low", pads: [["mid", "boost", 1.5]] },
      { from: "cA", to: "cB", draw: (t) => t.bypass("L", 263, -8), kind: "low", pads: [["mid", "boost", 1.5]] },
      { from: "cA", to: "cB", draw: (t) => t.bypass("R", 263, 10), kind: "high", holes: [["mid", 14]], pads: [["mid", "boost", 1.6]] },
      { from: "dA", to: "dB", draw: (t) => t.bypass("L", 123, 0), kind: "side", pads: [["mid", "boost"]] },
      { from: "dA", to: "dB", draw: (t) => t.bypass("R", 123, -5), kind: "low", pads: [["mid", "boost"]] },
    ],
  }),

  // TUX ANTARCTICA — ice, open water and penguins the size of houses. Round
  // the bay by boat, up a frozen helix on magnets, off a shelf of ice and
  // home along a sheet that will not let you turn.
  design({
    id: "tux", theme: "tux", difficulty: 2, sea: 0, start: [0, 6, 0, 0], hazards: 2,
    draw: (t) =>
      t.go(50).mark("go").go(70).mark("aA").go(BYPASS + 223).mark("aB").go(80, -6).mark("w0")
        .left(90, 90)
        .go(140).mark("w1").go(60, 6).mark("mA").go(40).right(360, 70, 14).go(60).mark("mB").go(220, -6)
        .left(90, 90)
        .go(60).drop(-12).go(70).mark("cA").go(BYPASS + 183).mark("cB").go(80)
        .left(90, 90, 4)
        .go(60).mark("m2A").weave("R", 30, 90).go(40).mark("m2B").go(240)
        .left(90, 90),
    zones: [["w0", "w1", "water"], ["mA", "mB", "mag"], ["m2A", "m2B", "mag"]],
    sectors: [["w0", "aqua"], ["mA", "tux"], ["cA", "aero"], ["m2A", "tux"]],
    traffic: 2,
    pads: [["go", "boost"], ["aB", "boost"], ["mB", "boost", 1.5, 40], ["cB", "boost"], ["m2A", "jump", 11, 100], ["m2B", "boost", 1.5, 30]],
    routes: [
      { from: "aA", to: "aB", draw: (t) => t.bypass("L", 223, 16), kind: "high", holes: [["mid", 16]], pads: [["mid", "boost", 1.7]] },
      { from: "aA", to: "aB", draw: (t) => t.bypass("R", 223, -8), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
      { from: "cA", to: "cB", draw: (t) => t.bypass("L", 183, 0), kind: "side", pads: [["mid", "boost"]] },
      { from: "cA", to: "cB", draw: (t) => t.bypass("R", 183, 12), kind: "high", holes: [["mid", 14]], pads: [["mid", "boost", 1.6]] },
    ],
  }),

  // THE SWIRL — it winds in on itself four times: up a turn on magnets,
  // down one, up one, down one, with a road over and a road under on every
  // straight between.
  design({
    id: "debian", theme: "debian", difficulty: 3, start: [0, 8, 0, 0], hazards: 3,
    draw: (t) =>
      t.go(50).mark("go").go(60).mark("mA").right(360, 60, 15).mark("mB").go(40).mark("aA").go(BYPASS + 123).mark("aB").go(50)
        .left(90, 80)
        .go(60).right(360, 55, -14).go(60).mark("bA").go(BYPASS + 123).mark("bB")
        .left(90, 80)
        .go(50).mark("m2A").right(360, 60, 14).go(50).mark("m2B").go(40).mark("cA").go(BYPASS + 123).mark("cB").go(60)
        .left(90, 80, -1)
        .go(60).right(360, 55, -14).go(30).mark("dA").go(BYPASS + 123).mark("dB").go(30)
        .left(90, 80),
    zones: [["mA", "mB", "mag"], ["m2A", "m2B", "mag"]],
    sectors: [["mA", "vapor"], ["aA", "debian"], ["m2A", "dreamcore"], ["cA", "debian"]],
    traffic: 3,
    pads: [["go", "boost"], ["aB", "boost"], ["bB", "boost"], ["cB", "boost"], ["dB", "boost"]],
    routes: [
      { from: "aA", to: "aB", draw: (t) => t.bypass("L", 123, 12), kind: "high", holes: [["mid", 14]], pads: [["mid", "boost", 1.6]] },
      { from: "aA", to: "aB", draw: (t) => t.bypass("R", 123, -6), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
      { from: "bA", to: "bB", draw: (t) => t.bypass("L", 123, 0), kind: "side", pads: [["mid", "boost"]] },
      { from: "bA", to: "bB", draw: (t) => t.bypass("R", 123, 10), kind: "high", pads: [["mid", "boost", 1.5]] },
      { from: "cA", to: "cB", draw: (t) => t.bypass("L", 123, -6), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
      { from: "cA", to: "cB", draw: (t) => t.bypass("R", 123, 12), kind: "high", holes: [["mid", 14]], pads: [["mid", "boost", 1.6]] },
      { from: "dA", to: "dB", draw: (t) => t.bypass("L", 123, 12), kind: "high", holes: [["mid", 14]], pads: [["mid", "boost", 1.6]] },
      { from: "dA", to: "dB", draw: (t) => t.bypass("R", 123, -6), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
    ],
  }),

  // ARCH PEAK — it only ever goes up, until it does not. A long climb on
  // three levels, two more turns to the summit on magnets, and then all of it
  // back in one glide.
  design({
    id: "arch", theme: "arch", difficulty: 3, start: [0, 8, 0, 0], hazards: 3,
    draw: (t) =>
      t.go(50).mark("go").go(50).mark("aA").go(BYPASS + 223, 30).mark("aB").go(60, 4.5)
        .left(90, 90, 7.5)
        .go(60).mark("mA").right(720, 60, 30).mark("mB").go(60).mark("k0").go(120, 10).go(240)
        .left(90, 90, -10)
        .go(30).mark("skyA").go(BYPASS + 123).mark("skyB").go(30).go(200, -40)
        .left(90, 90, -10)
        .go(90, -22).go(30).mark("k1").mark("dA").go(BYPASS + 183).mark("dB")
        .left(90, 90),
    zones: [["mA", "mB", "mag"], ["k0", "k1", "sky"]],
    sectors: [["mA", "techno"], ["k0", "aero"], ["skyB", "dreamcore"], ["k1", "arch"]],
    traffic: 3,
    pads: [["go", "boost"], ["aB", "boost"], ["mB", "boost", 1.5], ["k1", "boost", 1.45, 20], ["dB", "boost"]],
    routes: [
      { from: "aA", to: "aB", draw: (t) => t.bypass("L", 223, 16, 30), kind: "high", holes: [["mid", 14]], pads: [["mid", "boost", 1.7]] },
      { from: "aA", to: "aB", draw: (t) => t.bypass("R", 223, -8, 30), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
      { from: "skyA", to: "skyB", draw: (t) => t.bypass("L", 123, 12), afloat: true, kind: "high" },
      { from: "skyA", to: "skyB", draw: (t) => t.bypass("R", 123, -12), afloat: true, kind: "low" },
      { from: "dA", to: "dB", draw: (t) => t.bypass("L", 183, 16), kind: "high", holes: [["mid", 16]], pads: [["mid", "boost", 1.7]] },
      { from: "dA", to: "dB", draw: (t) => t.bypass("R", 183, -8), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
    ],
  }),

  // AQUA DOCK — brushed metal and blue gel. A dock road on three levels, out
  // across the water on two channels, down a tube that forks and back up to
  // a road with a bridge twenty units over it.
  design({
    id: "mac", theme: "mac", difficulty: 2, sea: 0, start: [0, 4, 0, 0], hazards: 2,
    draw: (t) =>
      t.go(50).mark("go").go(90).mark("aA").go(BYPASS + 183).mark("aB").go(40).go(60, -4).mark("w0")
        .right(90, 90)
        .go(60).mark("chA").go(BYPASS + 123).mark("chB").go(40).mark("s0").go(100, -20)
        .right(90, 90)
        .go(20).mark("tA").go(BYPASS + 183, -4).mark("tB").go(30).go(120, 24).mark("s1").go(70)
        .right(90, 90)
        .go(40).mark("w1").go(60, 4).mark("dA").go(BYPASS + 223).mark("dB")
        .right(90, 90),
    zones: [["w0", "s0", "water"], ["s0", "s1", "sub"], ["s1", "w1", "water"]],
    sectors: [["w0", "aqua"], ["s0", "liquid"], ["s1", "mac"]],
    traffic: 2,
    pads: [["go", "boost"], ["aB", "boost"], ["chA", "jump", 12, 120], ["dB", "boost"]],
    routes: [
      { from: "aA", to: "aB", draw: (t) => t.bypass("L", 183, 14), kind: "high", holes: [["mid", 14]], pads: [["mid", "boost", 1.6]] },
      { from: "aA", to: "aB", draw: (t) => t.bypass("R", 183, -7), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
      { from: "chA", to: "chB", draw: (t) => t.bypass("L", 123, 0), afloat: true, kind: "side" },
      { from: "chA", to: "chB", draw: (t) => t.bypass("R", 123, 10), kind: "high", holes: [["mid", 14]], pads: [["mid", "boost", 1.5]] },
      { from: "tA", to: "tB", draw: (t) => t.bypass("L", 183, -10, -4), afloat: true, kind: "low" },
      { from: "tA", to: "tB", draw: (t) => t.bypass("R", 183, 9, -4), afloat: true, kind: "high" },
      { from: "dA", to: "dB", draw: (t) => t.bypass("L", 223, 20), kind: "high", holes: [["mid", 18]], pads: [["mid", "boost", 1.7]] },
      { from: "dA", to: "dB", draw: (t) => t.bypass("R", 223, -8), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
    ],
  }),

  // SLIME SWAMP — glossy, green and up to the axles. Two channels of gel to
  // cross by boat, a weave through the reeds, a magnetic causeway, and a
  // cannon over the deep part.
  design({
    id: "slime", theme: "slime", difficulty: 2, sea: 0, start: [0, 6, 0, 0], hazards: 3,
    draw: (t) =>
      t.go(50).mark("go").go(70).go(60, -6).mark("w0").mark("chA").go(BYPASS + 183).mark("chB")
        .left(90, 80)
        .go(60).weave("L", 30, 80).go(40).mark("w1").go(60, 8).mark("mA").go(140).mark("mB")
        .left(90, 80)
        .go(40).mark("cA").go(BYPASS + 223, 10).mark("cB").go(100)
        .left(90, 80, -4)
        .go(60).drop(-8).go(56).mark("c0").go(8).mark("air").go(130).mark("land").go(182)
        .left(90, 80),
    zones: [["w0", "w1", "water"], ["mA", "mB", "mag"]],
    holes: [["air", 120]],
    kick: 0,
    cannons: [["c0", "land", 30]],
    sectors: [["w0", "liquid"], ["mA", "slime"], ["cA", "eco"], ["c0", "slime"]],
    traffic: 3,
    pads: [["go", "boost"], ["chA", "jump", 12, 150], ["mA", "jump", 11, 60], ["cB", "boost"], ["land", "boost", 1.5, 20]],
    routes: [
      { from: "chA", to: "chB", draw: (t) => t.bypass("L", 183, 0), afloat: true, kind: "side" },
      { from: "chA", to: "chB", draw: (t) => t.bypass("R", 183, 12), kind: "high", holes: [["mid", 16]], pads: [["mid", "boost", 1.6]] },
      { from: "cA", to: "cB", draw: (t) => t.bypass("L", 223, 16, 10), kind: "high", holes: [["mid", 16]], pads: [["mid", "boost", 1.7]] },
      { from: "cA", to: "cB", draw: (t) => t.bypass("R", 223, -8, 10), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
    ],
  }),

  // WEBCORE HIGHWAY — a home page from 1998, under construction for ever. A
  // link that takes you somewhere else, two corners to cut, a jump, a
  // magnetic loop and a fall at the end of it.
  design({
    id: "webcore", theme: "webcore", difficulty: 2, start: [0, 10, 0, 0], hazards: 4,
    draw: (t) =>
      t.go(50).mark("go").go(50).mark("aA").go(BYPASS + 203).mark("aB").go(50).mark("k1a").go(30)
        .right(90, 80, 4)
        .go(30).mark("k1b").go(40).mark("p1").weave("L", 30, 70).mark("pOut").go(40).mark("run").go(40).mark("j1").go(140).mark("k2a").go(30)
        .right(90, 80)
        .go(30).mark("k2b").go(50).mark("cA").go(BYPASS + 223, -4).mark("cB").go(80)
        .right(90, 80)
        .go(60).mark("mA").left(360, 60, 14).go(60).mark("mB").go(40).drop(-14).go(267)
        .right(90, 80),
    zones: [["mA", "mB", "mag"]],
    holes: [["j1", 9]],
    portals: [["p1", "pOut"]],
    sectors: [["p1", "win98"], ["k2b", "y2k"], ["mA", "vapor"], ["mB", "webcore"]],
    traffic: 4,
    pads: [["go", "boost"], ["aB", "boost"], ["run", "boost", 1.5], ["cB", "boost"], ["mB", "boost", 1.4, 20]],
    routes: [
      { from: "aA", to: "aB", draw: (t) => t.bypass("L", 203, 16), kind: "high", holes: [["mid", 16]], pads: [["mid", "boost", 1.7]] },
      { from: "aA", to: "aB", draw: (t) => t.bypass("R", 203, -8), kind: "low", tunnel: true, pads: [["mid", "boost", 1.5]] },
      { from: "k1a", to: "k1b", width: 11, walls: false, draw: (t) => t.cut("R", 101.8, 20, 4), pads: [["mid", "boost", 1.5]] },
      { from: "k2a", to: "k2b", width: 11, walls: false, draw: (t) => t.cut("R", 101.8, 20), holes: [["mid", 10]], pads: [["mid", "boost", 1.5]] },
      { from: "cA", to: "cB", draw: (t) => t.bypass("L", 223, 14, -4), kind: "high", holes: [["mid", 14]], pads: [["mid", "boost", 1.6]] },
      { from: "cA", to: "cB", draw: (t) => t.bypass("R", 223, 0, -4), kind: "side", pads: [["mid", "boost"]] },
    ],
  }),
];
