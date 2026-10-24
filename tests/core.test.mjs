import test from "node:test";
import assert from "node:assert/strict";
import { clamp, normalizeAxes, floorIndexFromElevation } from "../src/game/player.js";

test("clamp keeps values inside the requested range", () => {
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(7, 0, 10), 7);
  assert.equal(clamp(20, 0, 10), 10);
});

test("diagonal movement is normalized instead of faster", () => {
  const axes = normalizeAxes(true, false, false, true);
  assert.ok(Math.abs(Math.hypot(axes.forward, axes.strafe) - 1) < 1e-12);
  assert.ok(Math.abs(axes.forward - Math.SQRT1_2) < 1e-12);
});

test("opposite movement inputs cancel out", () => {
  assert.deepEqual(normalizeAxes(true, true, false, false), { forward: 0, strafe: 0 });
});

test("floor index is rounded and bounded to the eight-storey block", () => {
  assert.equal(floorIndexFromElevation(0), 0);
  assert.equal(floorIndexFromElevation(8.4), 3);
  assert.equal(floorIndexFromElevation(99), 7);
  assert.equal(floorIndexFromElevation(-20), 0);
});