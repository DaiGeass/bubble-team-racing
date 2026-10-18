import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { VehicleEffects } from "../src/game/vehicleEffects";
import { mergePreferences, preferredLanguage } from "../src/preferences";
import { EmissionBudget } from "../src/particleBudget";

function rootWith(...materials: THREE.Material[]) {
  const root = new THREE.Group();
  for (const material of materials) root.add(new THREE.Mesh(undefined, material));
  return root;
}

test("explosions restore the original emissive finish after both flash colours", () => {
  const material = new THREE.MeshStandardMaterial({ emissive: "#123456", emissiveIntensity: 2 });
  const original = material.emissive.clone();
  const effects = new VehicleEffects(rootWith(material));
  effects.update(false, true, 0);
  assert.equal(material.emissive.getHex(), 0xffffff);
  effects.update(false, true, Math.PI / 80);
  assert.equal(material.emissive.getHex(), 0xff4d6d);
  effects.update(false, false, 1);
  assert.ok(material.emissive.equals(original));
  assert.equal(material.emissiveIntensity, 2);
});

test("ghost preserves opaque, translucent and fully opaque transparent materials", () => {
  const solid = new THREE.MeshStandardMaterial();
  const glass = new THREE.MeshPhysicalMaterial({ opacity: 0.2, transparent: true, depthWrite: false });
  const overlay = new THREE.MeshBasicMaterial({ opacity: 1, transparent: true });
  const effects = new VehicleEffects(rootWith(solid, glass, overlay));
  effects.update(true, false, 0);
  assert.equal(solid.opacity, 0.34);
  assert.equal(glass.opacity, 0.2);
  assert.equal(solid.depthWrite, false);
  effects.restore();
  assert.equal(solid.opacity, 1);
  assert.equal(solid.transparent, false);
  assert.equal(solid.depthWrite, true);
  assert.equal(glass.opacity, 0.2);
  assert.equal(glass.transparent, true);
  assert.equal(glass.depthWrite, false);
  assert.equal(overlay.transparent, true);
});

test("shared materials are written once and unchanged flash phases do no work", () => {
  const material = new THREE.MeshStandardMaterial({ emissive: "#003322" });
  const setHex = material.emissive.setHex.bind(material.emissive);
  let writes = 0;
  material.emissive.setHex = (value, colorSpace) => { writes++; return setHex(value, colorSpace); };
  const effects = new VehicleEffects(rootWith(material, material));
  effects.update(true, true, 0);
  const version = material.version;
  for (let i = 0; i < 120; i++) effects.update(true, true, 0);
  assert.equal(writes, 1);
  assert.equal(material.version, version);
  effects.restore();
});

test("overlapping ghost and explosion states can end independently", () => {
  const material = new THREE.MeshStandardMaterial({ emissive: "#553311" });
  const original = material.emissive.clone();
  const effects = new VehicleEffects(rootWith(material));
  effects.update(true, true, 0);
  effects.update(true, false, 1);
  assert.ok(material.emissive.equals(original));
  assert.equal(material.opacity, 0.34);
  effects.restore();
  assert.equal(material.opacity, 1);
});

test("partial older control maps retain missing default actions", () => {
  const defaults = { keys: { gas: ["KeyW"], brake: ["KeyS"] }, touch: { gas: "gas", brake: "brake" }, volume: 0.8 };
  const loaded = mergePreferences(defaults, { keys: { gas: ["ArrowUp"] }, touch: { gas: "turbo" } });
  assert.deepEqual(loaded.keys, { gas: ["ArrowUp"], brake: ["KeyS"] });
  assert.equal(loaded.touch.brake, "brake");
  loaded.keys.brake.push("ArrowDown");
  assert.deepEqual(defaults.keys.brake, ["KeyS"]);
});

test("invalid saved field types cannot replace control maps or numeric values", () => {
  const defaults = { keys: { gas: ["KeyW"] }, enabled: true, volume: 0.8 };
  assert.deepEqual(mergePreferences(defaults, null), defaults);
  assert.deepEqual(mergePreferences(defaults, []), defaults);
  assert.deepEqual(mergePreferences(defaults, { keys: { gas: [42] }, enabled: "false", volume: Infinity }), defaults);
});

test("saved language wins over OS language and invalid preferences fall back", () => {
  assert.equal(preferredLanguage("ja", "es-MX"), "ja");
  assert.equal(preferredLanguage("invalid", "es-MX"), "es");
  assert.equal(preferredLanguage(null, "FR-ca"), "fr");
  assert.equal(preferredLanguage(undefined, "de-DE"), "en");
});

test("ambient particle density is independent of 30/60/144 Hz refresh", () => {
  for (const fps of [30, 60, 144]) {
    const budget = new EmissionBudget();
    let emitted = 0;
    for (let i = 0; i < fps; i++) emitted += budget.take(1 / fps, true);
    assert.equal(emitted, 180);
  }
});

test("invisible emitters do not queue a burst and long stalls are bounded", () => {
  const budget = new EmissionBudget();
  assert.equal(budget.take(10, false), 0);
  assert.equal(budget.take(1 / 60, true), 3);
  assert.equal(budget.take(10, true), 18);
  assert.equal(budget.take(NaN, true), 0);
});
