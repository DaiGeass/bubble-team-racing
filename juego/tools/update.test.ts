import test from "node:test";
import assert from "node:assert/strict";
import { TRACKS, THEMES } from "../src/data";
import { setActiveTrack, trapTransform, trapContact, halfWidthAt } from "../src/trackCurve";
import { styleFor, startMusic, stopMusic, musicPlaying } from "../src/music";

test("every aesthetic has a music style, and music without sound hardware stays silent", () => {
  for (const id of Object.keys(THEMES)) assert.ok(["aero", "synth", "drive", "eerie"].includes(styleFor(id)), id);
  startMusic("drive", "bahia");
  assert.equal(musicPlaying(), false);
  stopMusic();
});

test("sliding spikes stay on their side of a quiet stretch and slide only a short way", () => {
  let total = 0;
  for (const track of TRACKS) {
    if (!track.designed) continue;
    setActiveTrack(track.id);
    for (const tr of track.traps ?? []) {
      total++;
      assert.equal(tr.kind, "spike");
      assert.ok(tr.range && tr.range > 0 && tr.range < 0.05, track.id);
      for (const z of track.zones) assert.ok(!(tr.t > z.t0 - 0.005 && tr.t < z.t1 + 0.005), `${track.id} trap in a ${z.type} stretch`);
      for (let ms = 0; ms < 20000; ms += 500) {
        const h = trapTransform(tr, ms);
        assert.ok(Number.isFinite(h.p.x) && Number.isFinite(h.ground));
        // the other side of the road is always open
        assert.ok(halfWidthAt(h.t) > 4);
        assert.equal(trapContact(tr, ms, h.p.x, h.ground + 20, h.p.z), false);
      }
    }
  }
  assert.ok(total >= 100);
});
