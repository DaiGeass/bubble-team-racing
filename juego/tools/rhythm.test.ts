import test from "node:test";
import assert from "node:assert/strict";
import { TRACKS, CHARACTERS, THEMES, FUSION_SHOTS } from "../src/data";
import { setActiveTrack } from "../src/trackCurve";
import { DESIGN_REPORT } from "../src/trackDesign";
import { inspectMap } from "../src/mapInspection";
import { analyseSong, rhythmTrack, registerTrack, RHYTHM_TRACK_ID, type SongFeatures } from "../src/rhythm";
import { applyMods, checkMod, EXAMPLE_MOD, modReport, saveInstalled } from "../src/mods";
import { PadReader, deadzone } from "../src/gamepad";

/** A made-up song: a kick on every beat, a bass line, and sections that get louder and quieter. */
function fakeSong(seconds: number, bpm: number) {
  const rate = 8000;
  const data = new Float32Array(rate * seconds);
  const beat = 60 / bpm;
  for (let i = 0; i < data.length; i++) {
    const t = i / rate;
    const b = t / beat;
    const ph = b - Math.floor(b);
    const loud = [0.25, 0.6, 1, 0.45][Math.floor(b / 16) % 4];
    data[i] = (Math.sin(2 * Math.PI * 60 * ph * beat) * Math.exp(-ph * 10) * 0.7 + Math.sin(2 * Math.PI * 55 * t) * 0.3 + Math.sin(2 * Math.PI * 330 * t) * 0.1) * loud;
  }
  return { sampleRate: rate, length: data.length, numberOfChannels: 1, duration: seconds, getChannelData: () => data } as unknown as AudioBuffer;
}

test("a song is heard at about its own tempo, and its loud and quiet parts are told apart", () => {
  const song = analyseSong(fakeSong(60, 120), "prueba");
  assert.ok(Math.abs(song.bpm - 120) < 6 || Math.abs(song.bpm - 60) < 3 || Math.abs(song.bpm - 240) < 12, `bpm ${song.bpm}`);
  assert.ok(song.bars.length > 10);
  const e = song.bars.map((b) => b.energy);
  assert.ok(Math.max(...e) - Math.min(...e) > 0.4);
});

test("every song makes a closed circuit that lasts as long as the song, and the same song the same circuit", () => {
  const prev = TRACKS.find((t) => t.id === RHYTHM_TRACK_ID);
  for (const [seconds, bpm] of [[45, 90], [150, 140], [240, 100], [400, 128]]) {
    const bars = Array.from({ length: Math.floor(seconds / ((60 / bpm) * 4)) }, (_, i) => ({ energy: (Math.sin(i * 0.7) + 1) / 2, bass: (Math.cos(i * 0.3) + 1) / 2, busy: (i * 37) % 10 / 10 }));
    const song: SongFeatures = { name: `s${seconds}`, duration: seconds, bpm, offset: 0, bars };
    const def = rhythmTrack(song);
    registerTrack(def);
    setActiveTrack(RHYTHM_TRACK_ID);
    const r = DESIGN_REPORT[RHYTHM_TRACK_ID];
    assert.ok(r.closeError < 1, `${seconds}s close ${r.closeError}`);
    for (const e of r.routeErrors) assert.ok(e < 1);
    assert.deepEqual(inspectMap().flatMap((p) => p.issues), []);
    assert.deepEqual(rhythmTrack(song).points, def.points);
  }
  // leave the list as it was
  const i = TRACKS.findIndex((t) => t.id === RHYTHM_TRACK_ID);
  if (prev) TRACKS.splice(i, 1, prev);
  else TRACKS.splice(i, 1);
});

test("a mod adds its circuit, aesthetic and character, and bad mods are turned away with a reason", () => {
  const g = globalThis as { localStorage?: unknown };
  const had = g.localStorage;
  const store: Record<string, string> = {};
  g.localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v) };
  const tracks = TRACKS.length;
  const chars = CHARACTERS.length;
  try {
    assert.equal(checkMod(EXAMPLE_MOD), null);
    assert.ok(checkMod({ format: "btr-mod", version: 2, id: "x", name: "x" }));
    assert.ok(checkMod({ format: "btr-mod", version: 1, id: "Bad Id", name: "x" }));
    const evil = { ...EXAMPLE_MOD, id: "malo", tracks: [{ ...EXAMPLE_MOD.tracks![0], id: "malo", draw: [["eval", "alert(1)"]] }], characters: [], themes: [] };
    saveInstalled([{ mod: EXAMPLE_MOD, enabled: true }, { mod: evil as never, enabled: true }, { mod: { ...EXAMPLE_MOD, id: "apagado" }, enabled: false }]);
    applyMods();
    assert.deepEqual(modReport.ejemplo, { tracks: 1, characters: 1, themes: 1, errors: [] });
    assert.equal(modReport.malo.tracks, 0);
    assert.match(modReport.malo.errors[0], /unknown command "eval"/);
    assert.equal(modReport.apagado.tracks, 0);
    assert.equal(TRACKS.length, tracks + 1);
    const id = "mod-ejemplo-pista-menta";
    assert.ok(DESIGN_REPORT[id].closeError < 1);
    setActiveTrack(id);
    assert.deepEqual(inspectMap().flatMap((p) => p.issues), []);
    assert.ok(FUSION_SHOTS.menta);
  } finally {
    // the rest of the tests count the built-in game
    TRACKS.splice(tracks);
    CHARACTERS.splice(chars);
    delete (THEMES as Record<string, unknown>)["atardecer-menta"];
    delete FUSION_SHOTS.menta;
    g.localStorage = had;
  }
});

test("pad buttons can be moved, and the dead zone and steering curve shape the stick", () => {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
  const axes = [0, 0, 0, 0];
  const pad = { connected: true, mapping: "standard", index: 0, id: "test", axes, buttons } as unknown as Gamepad;
  const r = new PadReader();
  r.read([pad]);
  axes[0] = 0.5;
  const straight = r.read([pad]).steer;
  assert.ok(Math.abs(straight - deadzone(0.5)) < 1e-9);
  r.config = { ...r.config, curve: 2 };
  assert.ok(r.read([pad]).steer < straight);
  r.config = { ...r.config, deadzone: 0.4, curve: 1 };
  axes[0] = 0.35;
  assert.equal(r.read([pad]).steer, 0);
  // the item moves from A to Y
  r.config = { ...r.config, binds: { ...r.config.binds, item: 3, ability: 0 } };
  buttons[3] = { pressed: true, touched: true, value: 1 };
  const out = r.read([pad]);
  assert.equal(out.item, true);
  assert.equal(out.ability, false);
  assert.equal(r.snapshot?.buttons[3], 1);
});
