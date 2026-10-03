import type { TrackDef } from "./data";
import { design, BYPASS } from "./trackDesign";

// ---------------------------------------------------------------------------
// The circuits: one per aesthetic, and one built around each kind of vehicle. Each is drawn by hand with the turtle
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
    ],
  }),

  // FRUTIGER ECO — up the hill by switchbacks, over the top and a long way
  // down. The chute off the summit is the fast way and the risky one: no
  // barriers and a gap in the middle.
  design({
    id: "bosque", theme: "eco", difficulty: 2, start: [0, 8, 0, 0], hazards: 3,
    draw: (t) =>
      t.go(50).mark("go").go(170)
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
        .left(90, 80, 2).go(100, 2).mark("ramp").go(100, 2)
        .left(810, 60, 40)
        .mark("top").go(80).mark("k0")
        .go(300, -30)
        .left(90, 120, -8)
        .go(150, -6).mark("k1")
        .left(90, 70, -2).go(110),
    zones: [["k0", "k1", "sky"]],
    sectors: [["ramp", "cyberpunk"], ["k0", "vapor"], ["k1", "techno"]],
    traffic: 3,
    pads: [["ramp", "boost"], ["top", "boost", 1.5, -200], ["top", "boost", 1.5, -500], ["k1", "boost", 1.45, 20]],
    routes: [
      { from: "lineA", to: "lineB", draw: (t) => t.bypass("L", 124, 10), kind: "high", holes: [["mid", 15]], pads: [["mid", "boost", 1.5]] },
      { from: "lineA", to: "lineB", draw: (t) => t.bypass("R", 124, -6), kind: "low", tunnel: true, pads: [["mid", "boost"]] },
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
        .mark("coil").left(450, 60, 18)
        .go(120)
        .left(90, 60)
        .mark("bridgeA").go(BYPASS + 183).mark("bridgeB")
        .right(90, 60, -4).go(100, -4).mark("run").go(40, -2).mark("jump").go(60, -2)
        .right(90, 60, -4).go(120, -4)
        .right(90, 60, -2).go(180),
    holes: [["jump", 9]],
    pads: [["go", "boost"], ["coil", "boost"], ["run", "boost", 1.5]],
    sectors: [["coil", "vapor"], ["bridgeB", "liquid"], ["jump", "y2k"]],
    traffic: 3,
    routes: [
      { from: "line", to: "lineB", draw: (t) => t.bypass("R", 83, -4), kind: "low", tunnel: true, pads: [["mid", "boost"]] },
      { from: "bridgeA", to: "bridgeB", draw: (t) => t.bypass("L", 183, -11), kind: "low", pads: [["mid", "boost"]] },
      { from: "bridgeA", to: "bridgeB", draw: (t) => t.bypass("R", 183, 9), kind: "high", holes: [["mid", 16]], pads: [["mid", "boost", 1.5]] },
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
    holes: [["jump", 11]],
    pads: [["go", "boost"], ["run", "boost", 1.5], ["barB", "boost"]],
    portals: [["warpIn", "warpOut"]],
    sectors: [["warpOut", "y2k"], ["run", "noir"], ["barA", "win98"]],
    traffic: 4,
    routes: [
      { from: "barA", to: "barB", draw: (t) => t.bypass("L", 260, 10), kind: "high", holes: [["mid", 16]], pads: [["mid", "boost", 1.5]] },
      { from: "barA", to: "barB", draw: (t) => t.bypass("R", 260, -6), kind: "low", tunnel: true, pads: [["mid", "boost"]] },
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
        .go(250, 30).weave("L", 25, 118).go(250, -26).mark("k1")
        .right(90, 80)
        .mark("homeA").go(BYPASS + 153).mark("homeB").go(10),
    zones: [["w0", "w1", "water"], ["w2", "s0", "water"], ["s0", "s1", "sub"], ["s1", "k0", "water"], ["k0", "k1", "sky"]],
    sectors: [["w1", "frutiger"], ["s0", "liquid"], ["k0", "aero"], ["k1", "sunset"]],
    traffic: 2,
    // waves on the main channel: they throw the boat into the air
    pads: [["go", "boost"], ["chA", "jump", 12, 150], ["chA", "jump", 12, 300], ["k1", "boost", 1.45, 20], ["homeB", "boost"]],
    routes: [
      { from: "chA", to: "chB", draw: (t) => t.bypass("L", 223, 0), afloat: true, kind: "side" },
      { from: "chA", to: "chB", draw: (t) => t.bypass("R", 223, 7), kind: "high", holes: [["mid", 16]], pads: [["mid", "boost", 1.5]] },
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
        .weave("R", 30, 150, 40).left(90, 140, 10)
        .go(300, -20).mark("skyA").go(BYPASS + 123).mark("skyB")
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
      { from: "runA", to: "runB", draw: (t) => t.bypass("L", 223, 9), kind: "high", holes: [["mid", 11]], pads: [["mid", "boost", 1.5]] },
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
        .go(120).mark("s0").go(160, -30).go(20).mark("tA").go(BYPASS + 123, -6).mark("tB").go(100, -4)
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
      t.go(50).mark("go").go(210)
        .left(90, 90, 6)
        .mark("climbA").go(BYPASS + 323, 34).mark("climbB").go(15)
        .left(90, 90)
        .go(60).drop(-16).go(100).mark("j1").go(60).drop(-16)
        .left(90, 90, -4)
        .weave("R", 30, 150, -4).go(75).mark("run").go(40).mark("j2").go(100)
        .left(90, 90)
        .go(32),
    holes: [["j1", 10], ["j2", 9]],
    sectors: [["climbA", "dreamcore"], ["j1", "vapor"], ["run", "sunset"]],
    traffic: 3,
    pads: [["go", "boost"], ["climbB", "boost"], ["run", "boost", 1.5]],
    routes: [
      { from: "climbA", to: "climbB", draw: (t) => t.bypass("L", 323, -5, 34), kind: "low", tunnel: true, pads: [["mid", "boost"]] },
      { from: "climbA", to: "climbB", draw: (t) => t.bypass("R", 323, 8, 34), kind: "high", pads: [["mid", "boost", 1.5]] },
    ],
  }),
];
