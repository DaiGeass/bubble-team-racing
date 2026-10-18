import test from "node:test";
import assert from "node:assert/strict";
import { graphicsProfile, ResolutionBudget } from "../src/graphics";

function run(budget: ResolutionBudget, fps: number, seconds: number) {
  const changes: number[] = [];
  for (let i = 0; i < fps * seconds; i++) {
    const value = budget.sample(1 / fps);
    if (value !== null) changes.push(value);
  }
  return changes;
}

test("old/unknown settings retain a bounded balanced profile", () => {
  assert.equal(graphicsProfile(undefined), graphicsProfile("auto"));
  assert.equal(graphicsProfile("invalid"), graphicsProfile("balanced"));
  assert.equal(graphicsProfile("low").shadowSize, 0);
  assert.equal(graphicsProfile("low").bloom, false);
  assert.equal(graphicsProfile("high").shadowSize, 2048);
});

test("warm-up ignores a brief initial slowdown", () => {
  const budget = new ResolutionBudget(1.25);
  assert.deepEqual(run(budget, 20, 1), []);
  assert.equal(budget.value, 1.25);
});

test("sustained slow frames reduce DPR without crossing the floor", () => {
  const budget = new ResolutionBudget(1.25);
  const changes = run(budget, 30, 40);
  assert.ok(changes.length > 0);
  assert.ok(changes.every((value) => value >= 0.65 && value <= 1.25));
  assert.equal(budget.value, 0.65);
});

test("recovery is slower than degradation and cannot exceed screen cap", () => {
  const budget = new ResolutionBudget(1);
  run(budget, 30, 20);
  const low = budget.value;
  assert.deepEqual(run(budget, 60, 3), []);
  assert.equal(budget.value, low);
  assert.ok(run(budget, 60, 2).length > 0);
  run(budget, 60, 60);
  assert.equal(budget.value, 1);
});

test("45 FPS is a dead band: no repeated resolution changes", () => {
  const budget = new ResolutionBudget(1.25);
  assert.deepEqual(run(budget, 45, 30), []);
});

test("fast and high-refresh displays keep their resolution", () => {
  for (const fps of [60, 120, 144]) {
    const budget = new ResolutionBudget(1.25);
    assert.deepEqual(run(budget, fps, 20), []);
  }
});

test("pause/resume and long tab stalls restart the observation window", () => {
  const budget = new ResolutionBudget(1.25);
  run(budget, 30, 3);
  budget.reset();
  assert.deepEqual(run(budget, 30, 1), []);
  assert.equal(budget.sample(5), null);
  assert.deepEqual(run(budget, 30, 1), []);
  assert.equal(budget.value, 1.25);
});

test("invalid intervals do not resize or poison later samples", () => {
  const budget = new ResolutionBudget(1.25);
  for (const delta of [NaN, Infinity, 0, -1]) assert.equal(budget.sample(delta), null);
  assert.ok(run(budget, 30, 8).length > 0);
});
