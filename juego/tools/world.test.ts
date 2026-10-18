import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { TRACKS, THEMES, CHARACTERS, zoneAt, type VehicleMode } from "../src/data";
import { getPaths, getActiveTrack, setActiveTrack, F_SOLID, makeGround, groundAt, FLIGHT } from "../src/trackCurve";
import { modeOnPath, zoneOnPath, resetModeState } from "../src/trackModes";
import { lifeSpots } from "../src/trackLife";
import { visibleModelBounds } from "../src/game/previewBounds";
import { previewDistance, characterPhase, eyeOpen, vehicleLights } from "../src/modelDetail";
import { waterNormal } from "../src/game/waterNormal";
import { placeBody, moveBody, makeResult, type Body } from "../src/physics";

const expectedMode = { water: "boat", sky: "plane", sub: "sub", mag: "hover" } as const;
function body(): Body {
  return { pos: new THREE.Vector3(), y: 0, vy: 0, airborne: false, heading: 0, course: 0, speed: 0, path: 0, idx: 0, prog: 0, total: 0, safePath: 0, safeIdx: 0, touching: false, groundY: 0, slopeAlong: 0, lat: 0, half: 10 };
}

test("all 41 circuits use their actual ribbon for land/water/flight/diving/magnetic modes", () => {
  const seen = new Set<VehicleMode>(); const corrected = new Set<string>(); let routesFixed = 0;
  for (const track of TRACKS) {
    setActiveTrack(track.id);
    for (const path of getPaths()) {
      let wasWrong = false;
      for (let i = 0; i < path.n; i++) {
        const zone = zoneAt(path.prog[i]);
        const shouldUseZone = path.main || path.def?.afloat;
        const expected = shouldUseZone && zone ? expectedMode[zone.type] : "land";
        assert.equal(modeOnPath(path.id, path.prog[i]), expected, `${track.id} path ${path.id} sample ${i}`);
        // Count full alternate stretches separately from their shared join endpoints.
        if (!shouldUseZone && zone && i > 0 && i < path.n - 1) { corrected.add(track.id); wasWrong = true; }
        seen.add(expected);
      }
      if (wasWrong) routesFixed++;
    }
  }
  assert.deepEqual([...seen].sort(), ["boat", "hover", "land", "plane", "sub"]);
  assert.deepEqual([...corrected].sort(), ["arrecife", "archipielago", "atlantida", "glaciar", "mac", "odisea", "slime"].sort());
  assert.equal(routesFixed, 8);
});

test("mode boundaries, backward progress and invalid paths have bounded behavior on every circuit", () => {
  for (const track of TRACKS) {
    setActiveTrack(track.id);
    assert.equal(modeOnPath(-1, 0.5), "land");
    for (const zone of track.zones) {
      const middle = (zone.t0 + zone.t1) / 2;
      assert.equal(modeOnPath(0, middle), expectedMode[zone.type], track.id);
      assert.equal(modeOnPath(0, middle + 1), expectedMode[zone.type]);
      assert.equal(modeOnPath(0, middle - 1), expectedMode[zone.type]);
      for (const t of [zone.t0 - 1e-5, zone.t0 + 1e-5, zone.t1 - 1e-5, zone.t1 + 1e-5]) {
        const declared = zoneAt(t);
        assert.equal(modeOnPath(0, t), declared ? expectedMode[declared.type] : "land");
      }
    }
  }
});

test("transformations clear climb offset and a charged drift, while continuing a mode preserves them", () => {
  const state = { mode: "plane" as VehicleMode, flyOff: 8, isDrifting: true, driftCharge: 1.5, driftLevel: 3, driftDir: 1, driftAge: 2, yaw: 0.3, hop: 0.1 };
  assert.equal(resetModeState(state, "plane"), false); assert.equal(state.flyOff, 8);
  assert.equal(resetModeState(state, "sub"), true);
  for (const key of ["flyOff", "driftCharge", "driftLevel", "driftDir", "driftAge", "yaw", "hop"] as const) assert.equal(state[key], 0);
  assert.equal(state.isDrifting, false); assert.equal(state.mode, "sub");
  assert.equal(resetModeState(state, "land"), true);
});

test("corrected solid alternatives stay on their real road with the driving physics", () => {
  let checked = 0; const ground = makeGround();
  for (const track of TRACKS) {
    setActiveTrack(track.id);
    for (const path of getPaths().slice(1)) {
      if (path.def?.afloat) continue;
      const i = Array.from(path.prog).findIndex((t, j) => j > 3 && j < path.n - 4 && !!zoneAt(t) && !!(path.flags[j] & F_SOLID)
        && groundAt(path.px[j], path.pz[j], path.py[j], ground, 0.2) && ground.path === path.id);
      if (i < 0) continue;
      const racer = body(); placeBody(racer, path.id, i); const result = makeResult();
      for (let step = 0; step < 60; step++) moveBody(racer, 0, 0, 1 / 60, { fly: false, flyAlt: 0, flyMargin: 4, rideOffset: 0, bobbing: false, ghost: false }, result);
      assert.equal(racer.airborne, false, track.id); assert.equal(result.fell, false);
      assert.ok(Math.abs(racer.y - path.py[i]) < 0.25, track.id);
      assert.equal(modeOnPath(path.id, path.prog[i]), "land"); checked++;
    }
  }
  assert.equal(checked, 8);
});

test("flight and diving zones on every track support the vehicle at cruising altitude", () => {
  const seen = new Set<string>();
  for (const track of TRACKS) {
    setActiveTrack(track.id);
    for (const path of getPaths()) for (const kind of ["sky", "sub"] as const) {
      const i = Array.from(path.prog).findIndex((t, index) => !!(path.flags[index] & F_SOLID) && zoneOnPath(path.id, t)?.type === kind
        && t > (zoneOnPath(path.id, t)?.t0 ?? 0) + 0.012 && t < (zoneOnPath(path.id, t)?.t1 ?? 1) - 0.012);
      if (i < 0) continue;
      const racer = body(); placeBody(racer, path.id, i); const result = makeResult();
      for (let step = 0; step < 60; step++) moveBody(racer, 0, 0, 1 / 60, { fly: true, flyAlt: FLIGHT[kind].base, flyMargin: kind === "sub" ? -2.6 : 4, rideOffset: 0, bobbing: false, ghost: false }, result);
      assert.equal(result.fell, false, track.id); assert.ok(Number.isFinite(racer.y));
      assert.ok(Math.abs(racer.y - path.py[i] - FLIGHT[kind].base) < 0.2, `${track.id} ${path.id} ${kind}`);
      seen.add(kind);
    }
  }
  assert.equal(seen.size, 2);
});

test("all circuits get deterministic, bounded scenery without putting props on outdoor roads", () => {
  const kinds = new Set<string>(); const ground = makeGround();
  for (const track of TRACKS) {
    setActiveTrack(track.id);
    const themes = (track.sectors ?? [{ t0: 0, theme: track.theme }]).map((s) => THEMES[s.theme]);
    const spots = lifeSpots(themes);
    assert.ok(spots.length > 0, `${track.id}: no life`);
    assert.ok(spots.length <= (track.indoor ? 32 : 64), track.id);
    assert.deepEqual(spots, lifeSpots(themes), `${track.id}: nondeterministic placements`);
    for (const spot of spots) {
      kinds.add(spot.kind);
      for (const key of ["x", "y", "z", "angle", "scale", "phase"] as const) assert.ok(Number.isFinite(spot[key]));
      if (!track.indoor) assert.equal(groundAt(spot.x, spot.z, 1e6, ground, 0), false, `${track.id}: decoration on road`);
      else assert.equal(spot.kind, "vent");
    }
  }
  assert.ok(kinds.has("vent") && kinds.has("buoy") && kinds.has("flower") && kinds.has("beacon"));
  assert.ok(getActiveTrack());
});

test("preview bounds include visible transforms and exclude hidden craft and invisible effects", () => {
  const root = new THREE.Group();
  const visible = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 4), new THREE.MeshBasicMaterial()); root.add(visible);
  const hidden = new THREE.Group(); hidden.visible = false;
  hidden.add(new THREE.Mesh(new THREE.BoxGeometry(200, 200, 200), new THREE.MeshBasicMaterial())); root.add(hidden);
  const flame = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), new THREE.MeshBasicMaterial()); flame.userData.previewIgnore = true; root.add(flame);
  const invisible = new THREE.Mesh(new THREE.BoxGeometry(300, 300, 300), new THREE.MeshBasicMaterial({ opacity: 0 })); root.add(invisible);
  const bounds = visibleModelBounds(root);
  assert.deepEqual(bounds.getSize(new THREE.Vector3()).toArray(), [2, 2, 4]);
  root.scale.setScalar(2);
  assert.deepEqual(visibleModelBounds(root).getSize(new THREE.Vector3()).toArray(), [4, 4, 8]);
});

test("rotating models fit both portrait and wide preview cameras with a safety margin", () => {
  for (const radius of [0.5, 2, 4, 8]) for (const aspect of [0.5, 1, 2]) {
    const distance = previewDistance(radius, 42, aspect);
    const half = Math.min(42 * Math.PI / 360, Math.atan(Math.tan(42 * Math.PI / 360) * aspect));
    assert.ok(radius < distance * Math.sin(half));
  }
});

test("new lights fit their allocated instance budget for every vehicle mode", () => {
  for (const mode of ["land", "boat", "plane", "sub", "hover"] as const) for (const narrow of [false, true]) {
    const list = vehicleLights(mode, narrow); assert.ok(list.length > 0 && list.length <= 4);
    for (const light of list) { assert.ok(light.sx > 0 && light.sy > 0 && light.sz > 0); assert.ok(Number.isFinite(light.x + light.y + light.z)); }
  }
  const phases = CHARACTERS.map((c) => characterPhase(c.id));
  assert.ok(new Set(phases).size > 25);
  for (const phase of phases) for (let time = 0; time < 10; time += 0.05) assert.ok(eyeOpen(time, phase, false) >= 0.08 && eyeOpen(time, phase, false) <= 1);
});

test("water ripples are normalized non-colour data with repeat filtering and mipmaps", () => {
  const texture = waterNormal(); const pixels = texture.image.data as Uint8Array;
  assert.equal(texture.colorSpace, THREE.NoColorSpace); assert.equal(texture.generateMipmaps, true);
  assert.equal(texture.wrapS, THREE.RepeatWrapping); assert.equal(texture.wrapT, THREE.RepeatWrapping);
  assert.equal(pixels.length, 128 * 128 * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    const length = Math.hypot(pixels[i] / 127.5 - 1, pixels[i + 1] / 127.5 - 1, pixels[i + 2] / 127.5 - 1);
    assert.ok(Math.abs(length - 1) < 0.012); assert.equal(pixels[i + 3], 255);
  }
  texture.dispose();
});
