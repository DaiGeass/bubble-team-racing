import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Spring } from "../src/spring";
import { CameraDynamics, curvePreview } from "../src/camera";
import { VehicleMotion } from "../src/game/vehicleMotion";
import { LandingBonus } from "../src/landingBonus";
import { spatialInstances } from "../src/game/spatialInstances";
import { createWheelResources, hasRoadWheels } from "../src/game/wheelResources";
import { VehicleEffects } from "../src/game/vehicleEffects";

const approx = (a: number, b: number, epsilon = 1e-9) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

test("suspension spring has the same position and velocity at 30/60/144 Hz", () => {
  const results = [30, 60, 144].map((fps) => {
    const spring = new Spring(); spring.velocity = -2;
    for (let i = 0; i < fps; i++) spring.step(0.1, 12, 1 / fps);
    return spring;
  });
  for (const spring of results) { approx(spring.value, results[0].value); approx(spring.velocity, results[0].velocity); }
  const spring = results[0]; const value = spring.value;
  spring.step(0, 12, NaN); assert.equal(spring.value, value);
  spring.reset(); assert.equal(spring.value, 0); assert.equal(spring.velocity, 0);
});

test("camera anticipates the correct bend, limits hairpins and respects reverse driving", () => {
  const path = { n: 4, ds: 10, closed: false, tx: new Float32Array([0, 0.1, 0.5, 1]), tz: new Float32Array([1, 0.995, 0.866, 0]) };
  assert.ok(curvePreview(path, 0, 0, 30) > 0);
  path.tx = new Float32Array([0, -0.1, -0.5, -1]);
  assert.ok(curvePreview(path, 0, 0, 30) < 0);
  assert.equal(curvePreview(path, 0, Math.PI, 30), 0);
  assert.equal(curvePreview(path, 0, 0, -10), 0);
  assert.ok(Math.abs(curvePreview(path, 0, 0, 100)) <= 0.65);
});

test("boost and curve camera reactions are independent of display refresh", () => {
  const states = [30, 60, 144].map((fps) => {
    const camera = new CameraDynamics();
    camera.update(1 / fps, 30, 0, 0, false, false, 0, true, false);
    for (let i = 0; i < fps; i++) camera.update(1 / fps, 30, 0.7, 0.5, true, false, 0, false, false);
    return camera;
  });
  for (const state of states) { approx(state.boost, states[0].boost); approx(state.curve, states[0].curve); approx(state.side, states[0].side); }
});

test("camera landing kick settles and a teleport clears its previous motion", () => {
  const camera = new CameraDynamics();
  camera.update(1 / 60, 20, 0, 0, false, true, -15, true, false);
  camera.update(1 / 60, 20, 0, 0, false, false, 0, false, false);
  assert.ok(camera.landing.value < 0);
  for (let i = 0; i < 180; i++) camera.update(1 / 60, 20, 0, 0, false, false, 0, false, false);
  assert.ok(Math.abs(camera.landing.value) < 1e-9);
  camera.update(1 / 60, 0, 0, 0, false, false, 0, true, true);
  assert.equal(camera.landing.value, 0); assert.equal(camera.acceleration, 0); assert.equal(camera.side, 0);
});

test("camera does not interpret the starting speed as acceleration or create an idle landing kick", () => {
  const camera = new CameraDynamics();
  camera.update(1 / 60, 40, 1, 0.5, true, true, -20, true, true);
  camera.update(1 / 60, 40, 1, 0.5, true, false, 0, false, true);
  assert.equal(camera.acceleration, 0); assert.equal(camera.landing.value, 0); assert.equal(camera.curve, 0); assert.equal(camera.boost, 0);
});

test("driver weight gives heavy and light characters different bounded reactions", () => {
  const light = new VehicleMotion(); const heavy = new VehicleMotion();
  for (const pose of [light, heavy]) pose.update(1 / 60, 0, 0, false, 0, 1);
  light.update(1 / 60, 0.5, 1, false, 0, 1);
  heavy.update(1 / 60, 0.5, 1, false, 0, 5);
  assert.ok(Math.abs(light.pitch) > Math.abs(heavy.pitch));
  assert.ok(Math.abs(light.lean) > Math.abs(heavy.lean));
  for (const pose of [light, heavy]) {
    pose.update(1 / 60, 30, 1, true, -50, 1);
    pose.update(1 / 60, 30, 1, false, 0, 1);
    assert.ok(pose.suspension.value < 0 && pose.suspension.value > -0.1);
  }
});

function jump(fps: number, seconds: number, clean = true, speed = 20, impact = 10) {
  const bonus = new LandingBonus();
  for (let i = 0; i < Math.round(seconds * fps); i++) assert.equal(bonus.step(1 / fps, true, 0, speed, clean), 0);
  return { bonus, charge: bonus.step(1 / fps, false, impact, speed, clean) };
}

test("clean jumps award turbo once at every refresh rate and respect the charge cap", () => {
  for (const fps of [30, 60, 144]) {
    const { bonus, charge } = jump(fps, 0.5);
    approx(charge, 0.082);
    assert.equal(bonus.step(1 / fps, false, 10, 20, true), 0);
    approx(jump(fps, 3).charge, 0.12);
  }
});

test("bumps, damage, reverse motion and rescue cannot farm landing turbo", () => {
  assert.equal(jump(60, 0.2).charge, 0);
  assert.equal(jump(60, 1, false).charge, 0);
  assert.equal(jump(60, 1, true, -20).charge, 0);
  assert.equal(jump(60, 1, true, 20, 2).charge, 0);
  const { bonus } = jump(60, 0.5); bonus.reset();
  assert.equal(bonus.step(1 / 60, false, 15, 20, true), 0);
});

test("spatial batches preserve every placement, scale, rotation and colour", () => {
  const geometry = new THREE.BoxGeometry(2, 4, 2);
  const material = new THREE.MeshStandardMaterial();
  const list = [-256, -1, 0, 30, 128, 400].map((x, i) => ({ m: new THREE.Matrix4().compose(new THREE.Vector3(x, i, x * 0.3), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i), new THREE.Vector3(1 + i, 1, 2)), colour: new THREE.Color(i % 2 ? "red" : "blue") }));
  const batches = spatialInstances(geometry, material, list);
  assert.equal(batches.reduce((n, mesh) => n + mesh.count, 0), list.length);
  const matrices: number[][] = []; const colors: number[] = [];
  for (const mesh of batches) {
    assert.equal(mesh.geometry, geometry); assert.equal(mesh.material, material); assert.equal(mesh.frustumCulled, true);
    for (let i = 0; i < mesh.count; i++) {
      const matrix = new THREE.Matrix4(); const color = new THREE.Color();
      mesh.getMatrixAt(i, matrix); mesh.getColorAt(i, color);
      matrices.push(matrix.elements); colors.push(color.getHex());
      const sphere = geometry.boundingSphere!.clone().applyMatrix4(matrix);
      assert.ok(mesh.boundingSphere!.containsPoint(sphere.center));
    }
  }
  for (const item of list) {
    const i = matrices.findIndex((m) => Math.abs(m[12] - item.m.elements[12]) < 1e-6);
    assert.ok(i >= 0);
    matrices[i].forEach((v, k) => approx(v, item.m.elements[k], 1e-5));
    assert.equal(colors[i], item.colour.getHex());
  }
  batches.forEach((m) => m.dispose()); geometry.dispose(); material.dispose();
});

test("an offscreen scenery cluster is culled without dropping the visible one", () => {
  const geometry = new THREE.BoxGeometry(1, 1, 1); const material = new THREE.MeshBasicMaterial();
  const list = [0, 1000].map((x) => ({ m: new THREE.Matrix4().makeTranslation(x, 0, -20), colour: new THREE.Color("green") }));
  const batches = spatialInstances(geometry, material, list);
  const camera = new THREE.PerspectiveCamera(64, 16 / 9, 0.5, 1400); camera.updateMatrixWorld();
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  assert.equal(batches.filter((m) => frustum.intersectsObject(m)).reduce((n, m) => n + m.count, 0), 1);
  let materialDisposed = 0; material.addEventListener("dispose", () => materialDisposed++);
  batches.forEach((m) => m.dispose()); assert.equal(materialDisposed, 0);
  assert.equal(spatialInstances(geometry, material, []).length, 0);
  assert.throws(() => spatialInstances(geometry, material, list, 0));
  geometry.dispose(); material.dispose();
});

test("wheel resources keep the original detail while isolating each vehicle's ghost effect", () => {
  for (const style of ["classic", "sporty", "glow", "chrome", "spike"] as const) {
    const wheels = createWheelResources(style); const other = createWheelResources(style);
    const root = new THREE.Group();
    for (let i = 0; i < 4; i++) root.add(new THREE.Mesh(wheels.tireGeometry, wheels.tireMaterial), new THREE.Mesh(wheels.rimGeometry, wheels.rimMaterial));
    const effects = new VehicleEffects(root); effects.update(true, false, 0);
    assert.equal(wheels.tireMaterial.opacity, 0.34); assert.equal(other.tireMaterial.opacity, 1);
    effects.restore(); assert.equal(wheels.tireMaterial.opacity, 1);
    const expected = new THREE.CylinderGeometry(0.48, 0.48, style === "spike" ? 0.44 : 0.36, 14);
    assert.equal(wheels.tireGeometry.getAttribute("position").count, expected.getAttribute("position").count);
    expected.dispose(); wheels.dispose(); other.dispose();
  }
  assert.equal(hasRoadWheels("kart"), true); assert.equal(hasRoadWheels("orbit"), false);
});

test("a jump driven by the real track physics awards one clean-landing bonus", async () => {
  const { setActiveTrack } = await import("../src/trackCurve");
  const { moveBody, makeResult, placeBody } = await import("../src/physics");
  const { TRACKS } = await import("../src/data");
  setActiveTrack(TRACKS[0].id);
  const racer = { pos: new THREE.Vector3(), y: 0, vy: 0, airborne: false, heading: 0, course: 0, speed: 20, path: 0, idx: 0, prog: 0, total: 0, safePath: 0, safeIdx: 0, touching: false, groundY: 0, slopeAlong: 0, lat: 0, half: 10 };
  placeBody(racer, 0, 12);
  racer.airborne = true; racer.vy = 9; racer.y += 0.3;
  const result = makeResult(); const bonus = new LandingBonus(); let rewards = 0;
  for (let i = 0; i < 120; i++) {
    const dt = 1 / 60;
    moveBody(racer, Math.sin(racer.heading) * racer.speed * dt, Math.cos(racer.heading) * racer.speed * dt, dt,
      { fly: false, flyAlt: 0, flyMargin: 4, rideOffset: 0, bobbing: false, ghost: false }, result);
    assert.equal(result.fell, false);
    const charge = bonus.step(dt, racer.airborne, result.landed, racer.speed, !result.fell && !racer.touching && result.wallImpact === 0);
    if (charge > 0) { rewards++; assert.ok(charge >= 0.08 && charge <= 0.12); }
  }
  assert.equal(rewards, 1);
  assert.equal(racer.airborne, false);
});
