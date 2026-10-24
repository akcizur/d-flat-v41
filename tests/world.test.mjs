import test from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/game/world.js";

class FakeBoxGeometry {
  constructor(width, height, depth) { this.parameters = { width, height, depth }; }
}
class FakeMaterial { constructor(options) { Object.assign(this, options); } }
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

test("world is a compact three-storey block with four empty rooms per floor", () => {
  const { world, scene } = makeWorld();
  assert.equal(world.floorCount, 3);
  assert.equal(world.floorHeight, 2.8);
  assert.equal(world.roomsPerFloor, 4);
  assert.equal(world.building.width, 18);
  assert.equal(world.building.depth, 12);
  assert.equal(scene.children.filter(mesh => mesh.name === "Podlaha / přední trakt").length, 2);
  assert.ok(scene.children.some(mesh => mesh.name === "Výtah / levá šachta"));
  assert.ok(scene.children.some(mesh => mesh.name === "Příčka / levá část"));
  assert.ok(scene.children.some(mesh => mesh.name === "Příčka / pravá část"));
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
  assert.ok(riser.geometry.parameters.depth > 0.9);
});

test("support height rises one step at a time along the lower flight", () => {
  const { world } = makeWorld();
  let previous = 0;
  for (const x of [-1.7, -1.35, -1.0, -0.65, -0.3, 0.05, 0.4, 0.75]) {
    const support = world.getSupport(x, -25.5, previous);
    assert.ok(support, `expected support at x=${x}`);
    assert.ok(support.height >= previous, "walking uphill must not lower the player");
    assert.ok(support.height - previous <= 0.23, "one movement step must not jump multiple risers");
    previous = support.height;
  }
  assert.ok(Math.abs(previous - 1.4) < 1e-9);
});

test("landing connects the two stair flights and the upper corridor", () => {
  const { world } = makeWorld();
  const landing = world.getSupport(1.65, -24.3, 1.4);
  assert.equal(landing?.kind, "landing");
  assert.ok(Math.abs(landing.height - 1.4) < 1e-9);

  let upperHeight = 1.4;
  for (const x of [0.65, 0.3, -0.05, -0.4, -0.75, -1.1, -1.45, -1.7]) {
    const upperStep = world.getSupport(x, -23.1, upperHeight);
    assert.equal(upperStep?.kind, "stair");
    assert.ok(upperStep.height >= upperHeight);
    assert.ok(upperStep.height - upperHeight <= 0.23);
    upperHeight = upperStep.height;
  }
  assert.ok(Math.abs(upperHeight - 2.8) < 1e-9);

  const exitLanding = world.getSupport(-2.15, -23.1, 2.8);
  assert.equal(exitLanding?.kind, "landing");
  assert.ok(Math.abs(exitLanding.height - 2.8) < 1e-9);

  const corridor = world.getSupport(-2.8, -23.1, 2.8);
  assert.equal(corridor?.kind, "floor");
  assert.ok(Math.abs(corridor.height - 2.8) < 1e-9);
});

test("upper floors remain unsupported inside the open stairwell void", () => {
  const { world } = makeWorld();
  assert.equal(world.getSupport(0, -24.3, 2.8), null);
  assert.equal(world.getSupport(0, -24.3, 5.6), null);
});

test("world collision bounds are finite and ordered", () => {
  const { world } = makeWorld();
  assert.ok(world.colliders.length > 30);
  for (const collider of world.colliders) {
    for (const key of ["minX", "maxX", "minY", "maxY", "minZ", "maxZ"]) {
      assert.ok(Number.isFinite(collider[key]), `expected finite ${key}`);
    }
    assert.ok(collider.minX <= collider.maxX);
    assert.ok(collider.minY <= collider.maxY);
    assert.ok(collider.minZ <= collider.maxZ);
  }
});