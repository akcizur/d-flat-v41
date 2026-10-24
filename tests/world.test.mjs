import test from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/game/world.js";

class FakeBoxGeometry {
  constructor(width, height, depth) {
    this.parameters = { width, height, depth };
  }
}
class FakeMaterial {
  constructor(options) { Object.assign(this, options); }
}
class FakeMesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.position = { set: (x, y, z) => Object.assign(this.position, { x, y, z }) };
    this.rotation = { z: 0 };
  }
}
function makeWorld() {
  const scene = { children: [], add(mesh) { this.children.push(mesh); } };
  const THREE = { BoxGeometry: FakeBoxGeometry, MeshStandardMaterial: FakeMaterial, Mesh: FakeMesh };
  return { world: createWorld(THREE, scene), scene };
}

test("world keeps the eight-floor panel building and creates real stair components", () => {
  const { world, scene } = makeWorld();
  assert.equal(world.floorCount, 8);
  assert.equal(world.floorHeight, 2.8);
  assert.equal(scene.children.filter(mesh => mesh.name === "Podlaží / chodba").length, 7);
  assert.ok(scene.children.some(mesh => mesh.name === "Výtah / levá šachta"));
  assert.ok(scene.children.some(mesh => mesh.name === "Schodiště / dolní boční zídka"));
  assert.ok(scene.children.some(mesh => mesh.name === "Schodiště / horní boční zídka"));
});

test("stair treads are thin horizontal surfaces, not solid wedge blocks", () => {
  const { scene } = makeWorld();
  const tread = scene.children.find(mesh => mesh.name === "Schodiště / dolní nášlap");
  const riser = scene.children.find(mesh => mesh.name === "Schodiště / dolní čelo");
  assert.ok(tread, "expected a visible horizontal tread");
  assert.ok(riser, "expected a separate vertical riser");
  assert.ok(tread.geometry.parameters.height < 0.1);
  assert.ok(riser.geometry.parameters.height < 0.2);
  assert.ok(riser.geometry.parameters.depth > 1);
});

test("support height rises one step at a time along the lower flight", () => {
  const { world } = makeWorld();
  let previous = 0;
  for (const x of [-3.1, -2.8, -2.5, -2.2, -1.9, -1.6, -1.3, -1.0]) {
    const support = world.getSupport(x, -25.1, previous);
    assert.ok(support, `expected support at x=${x}`);
    assert.ok(support.height >= previous, "walking uphill must not lower the player");
    assert.ok(support.height - previous <= 0.23, "one movement step must not jump multiple risers");
    previous = support.height;
  }
  assert.ok(Math.abs(previous - 1.4) < 1e-9);
});

test("stair landing connects to the upper flight and next corridor floor", () => {
  const { world } = makeWorld();
  const landing = world.getSupport(-0.16, -24.1, 1.4);
  assert.equal(landing?.kind, "landing");
  assert.ok(Math.abs(landing.height - 1.4) < 1e-9);

  // Walk down the x-axis in tread-sized increments so each step is reached
  // naturally instead of asking the support solver to teleport across the flight.
  let upperHeight = 1.4;
  for (const x of [-0.95, -1.25, -1.55, -1.85, -2.15, -2.45, -2.75, -3.05]) {
    const upperStep = world.getSupport(x, -23.1, upperHeight);
    assert.equal(upperStep?.kind, "stair");
    assert.ok(upperStep.height >= upperHeight);
    assert.ok(upperStep.height - upperHeight <= 0.23);
    upperHeight = upperStep.height;
  }
  assert.ok(Math.abs(upperHeight - 2.8) < 1e-9);

  const corridor = world.getSupport(-3.25, -22.2, 2.8);
  assert.equal(corridor?.kind, "floor");
  assert.ok(Math.abs(corridor.height - 2.8) < 1e-9);
});

test("upper floors cannot be treated as solid support inside the open stairwell void", () => {
  const { world } = makeWorld();
  assert.equal(world.getSupport(0, -24.1, 2.8), null);
  assert.equal(world.getSupport(0, -24.1, 5.6), null);
});

test("world collision bounds remain finite and ordered", () => {
  const { world } = makeWorld();
  const colliders = world.colliders;
  assert.ok(colliders.length > 30);
  for (const collider of colliders) {
    for (const key of ["minX", "maxX", "minY", "maxY", "minZ", "maxZ"]) {
      assert.ok(Number.isFinite(collider[key]), `expected finite ${key}`);
    }
    assert.ok(collider.minX <= collider.maxX);
    assert.ok(collider.minY <= collider.maxY);
    assert.ok(collider.minZ <= collider.maxZ);
  }
});