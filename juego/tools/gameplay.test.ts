import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { frameBlend, coast, RaceCountdown } from "../src/motion";
import { CameraFollow, CAMERA_PROFILES } from "../src/camera";
import { mapSegments } from "../src/mapSegments";
import { TRACKS } from "../src/data";
import { setActiveTrack, getPaths, getPads, groundAt, makeGround, F_SOLID } from "../src/trackCurve";
import { moveBody, makeResult, placeBody, type Body } from "../src/physics";

function body(): Body {
  return { pos: new THREE.Vector3(), y: 0, vy: 0, airborne: false, heading: 0, course: 0, speed: 0, path: 0, idx: 0, prog: 0, total: 0, safePath: 0, safeIdx: 0, touching: false, groundY: 0, slopeAlong: 0, lat: 0, half: 10 };
}

test("every cannon on all circuits lands on road with 4 m behind and 12 m ahead", () => {
  const ground = makeGround();
  let count = 0;
  for (const track of TRACKS) {
    setActiveTrack(track.id);
    const main = getPaths()[0];
    for (const pad of getPads()) {
      if (pad.kind !== "cannon") continue;
      count++;
      const i = pad.toIdx;
      for (let d = -Math.ceil(4 / main.ds); d <= Math.ceil(12 / main.ds); d++) {
        assert.ok(main.flags[(i + d + main.n) % main.n] & F_SOLID, `${track.id}: unsafe landing buffer`);
      }
      assert.ok(groundAt(main.px[i], main.pz[i], main.py[i], ground, 0.2), `${track.id}: no ground`);
      assert.ok(Math.abs(ground.y - main.py[i]) < 0.2, `${track.id}: wrong road level`);
      const racer = body(); placeBody(racer, 0, i);
      const result = makeResult();
      for (let step = 0; step < 60; step++) moveBody(racer, 0, 0, 1 / 60, { fly: false, flyAlt: 0, flyMargin: 4, rideOffset: 0, bobbing: false, ghost: false }, result);
      assert.equal(racer.airborne, false, `${track.id}: cannon falls immediately`);
    }
  }
  assert.ok(count > 0);
});

test("damping has the same elapsed-time response at 30, 60 and 144 Hz", () => {
  for (const blend of [0.05, 0.12, 0.16, 0.2, 0.25]) {
    const expected = 1 - Math.pow(1 - blend, 60);
    for (const fps of [30, 60, 144]) {
      let value = 0;
      for (let i = 0; i < fps; i++) value += (1 - value) * frameBlend(blend, 1 / fps);
      assert.ok(Math.abs(value - expected) < 1e-12);
    }
  }
  assert.equal(frameBlend(0.12, 0), 0);
});

test("real flight physics holds altitude consistently across refresh rates", () => {
  setActiveTrack(TRACKS[0].id);
  const ys: number[] = [];
  for (const fps of [30, 60, 144]) {
    const racer = body(); placeBody(racer, 0, 8);
    const result = makeResult();
    for (let i = 0; i < fps; i++) moveBody(racer, 0, 0, 1 / fps, { fly: true, flyAlt: 10, flyMargin: 4, rideOffset: 0, bobbing: false, ghost: false }, result);
    ys.push(racer.y);
  }
  assert.ok(Math.max(...ys) - Math.min(...ys) < 1e-10);
});

test("coasting stops in either direction without crossing zero", () => {
  for (const speed of [-0.01, -1, -20, 0, 0.01, 1, 20]) {
    for (const dt of [1 / 144, 1 / 60, 1 / 30, 0.1, 1]) {
      const after = coast(speed, dt);
      assert.ok(after * speed >= 0);
      assert.ok(Math.abs(after) <= Math.abs(speed));
    }
  }
});

test("pausing freezes every starting light and GO, including before the start", () => {
  for (const fps of [30, 60, 144]) {
    const lights = new RaceCountdown();
    for (let second = 0; second < 3; second++) {
      for (let i = 0; i < fps; i++) lights.advance(1 / fps, true);
      assert.equal(lights.started, false);
      assert.equal(lights.advance(0, false), 3 - second);
      for (let i = 0; i < fps; i++) lights.advance(1 / fps, false);
    }
    assert.equal(lights.started, true);
    assert.equal(lights.advance(0, false), 0);
    for (let i = 0; i < fps; i++) lights.advance(1 / fps, true);
    assert.equal(lights.advance(0, true), 0);
    for (let i = 0; i < fps; i++) lights.advance(1 / fps, false);
    assert.equal(lights.advance(0, false), -1);
  }
});

test("a suspended window cannot skip the entire countdown on return", () => {
  const lights = new RaceCountdown();
  assert.equal(lights.advance(20, false), 3);
  assert.equal(lights.advance(NaN, false), 3);
  assert.equal(lights.started, false);
});

test("camera starts at the grid, follows shortest turns, and cuts across teleports", () => {
  const camera = new CameraFollow();
  assert.equal(camera.update(800, 20, 0, Math.PI - 0.01, 1 / 60), true);
  assert.equal(camera.update(801, 20, 0, -Math.PI + 0.01, 1 / 60), false);
  assert.ok(Math.abs(camera.angle - Math.PI) < 0.011);
  assert.equal(camera.update(-800, 20, 0, 0, 1 / 60), true);
  assert.equal(camera.angle, 0);
  assert.equal(camera.update(-799, 20, 0, 0, 1 / 60), false);
});

test("stable camera has fixed lens and no bank or impact shake", () => {
  assert.equal(CAMERA_PROFILES.stable.dynamicFov, 0);
  assert.equal(CAMERA_PROFILES.stable.bank, 0);
  assert.equal(CAMERA_PROFILES.stable.shake, 0);
});

test("minimap closes at the start without overshooting and keeps open routes open", () => {
  const flags = new Uint8Array(11).fill(1);
  assert.deepEqual(mapSegments(flags, true, 4), [[0, 4], [4, 8], [8, 0]]);
  assert.deepEqual(mapSegments(flags, false, 4), [[0, 4], [4, 8], [8, 10]]);
});

test("minimap displays short holes even between coarse samples and across closure", () => {
  const flags = new Uint8Array([1, 1, 0, 1, 1, 1, 1]);
  assert.deepEqual(mapSegments(flags, false, 5), [[0, 1], [3, 5], [5, 6]]);
  flags[0] = 0;
  const segments = mapSegments(flags, true, 5);
  assert.ok(segments.every(([a, b]) => flags[a] & flags[b] & 1));
  assert.ok(segments.every(([, b]) => b !== 0));
  assert.deepEqual(mapSegments(new Uint8Array(), true, 4), []);
});
