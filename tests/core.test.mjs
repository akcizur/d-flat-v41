import test from "node:test";
import assert from "node:assert/strict";
import { clamp, normalizeAxes, floorIndexFromElevation, createPlayerController } from "../src/game/player.js";

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

function makePlayer(worldOverrides = {}) {
  const camera = {
    position: { set() {} },
    rotation: { order: "YXZ", set() {} }
  };
  const world = {
    colliders: [],
    floorHeight: 2.8,
    floorCount: 8,
    coreOpening: { minX: -3.8, maxX: 3.8, minZ: -26, maxZ: -22.35 },
    getSupport: (_x, _z, elevation) => ({ height: elevation, kind: "floor" }),
    ...worldOverrides
  };
  const controller = createPlayerController({
    camera, world,
    settings: { walkSpeed: 3.6, mouseSensitivity: 1 },
    onFloorChange() {}
  });
  return controller;
}

test("jump remains airborne while moving and cannot be triggered again midair", () => {
  const playerController = makePlayer();
  playerController.keys.KeyW = true;
  playerController.jump();
  assert.equal(playerController.player.onGround, false);
  playerController.update(1 / 60);
  assert.equal(playerController.player.onGround, false);
  assert.ok(playerController.player.jumpHeight > 0);
  const height = playerController.player.jumpHeight;
  playerController.jump();
  assert.equal(playerController.player.jumpHeight, height);
});

test("jump is disabled inside the overlapping stairwell core", () => {
  const playerController = makePlayer();
  playerController.player.x = 0;
  playerController.player.z = -24.1;
  playerController.jump();
  assert.equal(playerController.player.onGround, true);
  assert.equal(playerController.player.jumpHeight, 0);
});
