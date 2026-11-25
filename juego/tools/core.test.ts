import test from "node:test";
import assert from "node:assert/strict";
import { TRACKS, THEMES, THEME_BIOME } from "../src/data";
import { DESIGN_REPORT } from "../src/trackDesign";
import { CORE_TRACKS } from "../src/coreTracks";
import { CORE_WORDS } from "../src/i18n10";
import { BeatJudge, gradeFor, PERFECT_WINDOW, GOOD_WINDOW } from "../src/beatJudge";
import { SONGBOOK, recipeLength, toWav } from "../src/songbook";
import { ROOFED_THEMES } from "../src/data";

test("the beat judge grades by distance to the nearest beat, either side", () => {
  const beat = 0.5;
  assert.equal(gradeFor(0, beat), "perfect");
  assert.equal(gradeFor(0.99, beat), "perfect");
  assert.equal(gradeFor((PERFECT_WINDOW + 0.01) / beat, beat), "good");
  assert.equal(gradeFor(1 - (GOOD_WINDOW - 0.01) / beat, beat), "good");
  assert.equal(gradeFor(0.5, beat), "off");
  assert.equal(gradeFor(Number.NaN, beat), "off");
});

test("a run of moves on the beat builds a combo, one off the beat breaks it, and the grade follows", () => {
  const j = new BeatJudge();
  let last = 0;
  for (let i = 0; i < 10; i++) {
    const { grade, points } = j.judge(0.01, 0.5);
    assert.equal(grade, "perfect");
    assert.ok(points >= last, "each perfect in a run is worth at least the one before");
    last = points;
  }
  assert.equal(j.combo, 10);
  assert.equal(j.rank(), "S");
  assert.equal(j.judge(0.5, 0.5).grade, "off");
  assert.equal(j.combo, 0);
  assert.equal(j.best, 10);
  for (let i = 0; i < 12; i++) j.judge(0.5, 0.5);
  assert.notEqual(j.rank(), "S");
  j.reset();
  assert.equal(j.score, 0);
  assert.equal(j.rank(), "D");
  assert.equal(j.judge(0, 0).points, 0, "no tempo, no points");
});

test("the songs of the game are distinct, of race length, and start in an aesthetic that exists", () => {
  assert.ok(SONGBOOK.length >= 6);
  assert.equal(new Set(SONGBOOK.map((s) => s.id)).size, SONGBOOK.length);
  for (const s of SONGBOOK) {
    assert.ok(THEMES[s.theme], s.id);
    const len = recipeLength(s);
    assert.ok(len >= 60 && len <= 180, `${s.id}: ${len.toFixed(0)} s`);
    assert.ok(s.chords.length >= 2 && s.parts.some((p) => p.level === 3), s.id);
  }
});

test("a built-in song becomes a playable WAV file to send to the other players", () => {
  const data = new Float32Array([0, 0.5, -0.5, 1, -1, 2]);
  const wav = toWav({ sampleRate: 8000, getChannelData: () => data } as unknown as AudioBuffer);
  const v = new DataView(wav);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  assert.equal(tag(0), "RIFF");
  assert.equal(tag(8), "WAVE");
  assert.equal(v.getUint32(24, true), 8000);
  assert.equal(wav.byteLength, 44 + data.length * 2);
  assert.equal(v.getInt16(44 + 5 * 2, true), 0x7fff, "clipped, not wrapped");
});

test("every internet-aesthetic circuit closes, goes through all five crafts and is named in every language", () => {
  for (const def of CORE_TRACKS) {
    assert.ok(TRACKS.some((t) => t.id === def.id), def.id);
    assert.ok(DESIGN_REPORT[def.id].closeError < 25, `${def.id} close ${DESIGN_REPORT[def.id].closeError}`);
    assert.deepEqual([...new Set(def.zones.map((z) => z.type))].sort(), ["mag", "sky", "sub", "water"], def.id);
    assert.ok((def.routes ?? []).length >= 5, `${def.id} routes`);
    for (const s of def.sectors ?? []) assert.ok(THEMES[s.theme], `${def.id} ${s.theme}`);
    for (const [lang, words] of Object.entries(CORE_WORDS)) assert.ok(words[`trk_${def.id}`], `${lang} trk_${def.id}`);
  }
});

test("the new aesthetics each have a palette, a landscape, and the Levels have walls and a roof", () => {
  for (const id of ["level1", "levelfun", "weirdcore", "glitchcore", "kidcore", "cottagecore", "traumacore", "nightcore", "aurora"] as const) {
    const th = THEMES[id];
    assert.equal(th.id, id);
    for (const c of [th.skyTop, th.skyBottom, th.road, th.barrierA, th.barrierB, th.glow]) assert.match(c, /^#[0-9a-f]{6}$/i, id);
    assert.ok(THEME_BIOME[id], id);
  }
  for (const id of ["backrooms", "level1", "levelfun"] as const) assert.ok(ROOFED_THEMES.has(id));
  // the Levels never put a roof over the sky or the deep end
  const noclip = TRACKS.find((t) => t.id === "noclip")!;
  const sectors = noclip.sectors ?? [];
  for (let i = 0; i < sectors.length; i++) {
    if (!ROOFED_THEMES.has(sectors[i].theme)) continue;
    const a = sectors[i].t0;
    const b = sectors[i + 1]?.t0 ?? 1;
    for (const z of noclip.zones) if (z.type === "sky" || z.type === "sub") assert.ok(z.t1 <= a + 0.02 || z.t0 >= b - 0.02, `${sectors[i].theme} over ${z.type}`);
  }
});

test("a built-in song is synthesised quickly, is never silent or clipped, and is heard at its own tempo", async () => {
  const { analyseSong } = await import("../src/rhythm");
  const { synthRecipe } = await import("../src/songbook");
  const recipe = SONGBOOK[0];
  const t0 = performance.now();
  const data = synthRecipe(recipe, 11025);
  const ms = performance.now() - t0;
  assert.ok(ms < 8000, `synthesis took ${ms.toFixed(0)} ms`);
  let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  assert.ok(peak > 0.5 && peak <= 0.91, `peak ${peak}`);
  const song = analyseSong({ sampleRate: 11025, length: data.length, numberOfChannels: 1, duration: data.length / 11025, getChannelData: () => data } as unknown as AudioBuffer, recipe.name);
  const bpm = recipe.bpm;
  assert.ok([bpm, bpm / 2, bpm * 2].some((b) => Math.abs(song.bpm - b) < b * 0.04), `heard ${song.bpm.toFixed(1)} for ${bpm}`);
  const e = song.bars.map((b) => b.energy);
  assert.ok(Math.max(...e) - Math.min(...e) > 0.3, "the quiet and the loud sections are told apart");
  // the fast one is heard at half speed without help; told its tempo, it is not
  const fast = SONGBOOK.find((s) => s.id === "caramelo")!;
  const fd = synthRecipe(fast, 11025);
  const known = analyseSong({ sampleRate: 11025, length: fd.length, numberOfChannels: 1, duration: fd.length / 11025, getChannelData: () => fd } as unknown as AudioBuffer, fast.name, fast.bpm);
  assert.ok(Math.abs(known.bpm - fast.bpm) < 1, `${known.bpm}`);
  assert.ok(Math.abs(known.offset - 0.4) < 0.1 || Math.abs(((known.offset - 0.4) / (60 / fast.bpm)) % 1) < 0.15, `offset ${known.offset}`);
});
