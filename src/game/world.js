export function createWorld(THREE, scene) {
  const colliders = [];
  const meshes = [];
  const floorHeight = 2.8;
  const floorCount = 8;
  const building = { x: 0, z: -22, width: 28, depth: 12, wall: 0.28 };
  const height = floorHeight * floorCount;
  const frontZ = building.z + building.depth / 2;
  const rearZ = building.z - building.depth / 2;
  const leftX = -building.width / 2;
  const rightX = building.width / 2;
  const frontWallZ = frontZ - building.wall / 2;
  const coreOpening = { minX: -3.8, maxX: 3.8, minZ: -26.0, maxZ: -22.35 };

  const material = (color, roughness = 1, metalness = 0) => new THREE.MeshStandardMaterial({
    color, roughness, metalness, flatShading: true
  });
  const M = {
    grass: material(0x747b6d), asphalt: material(0x50565a), pavement: material(0x98978e),
    concrete: material(0xbdbbb2), panels: material(0xc9c7bd), dark: material(0x858883),
    glass: material(0x40545d, 0.36, 0.08), warmGlass: material(0x93836a, 0.48, 0.02),
    rail: material(0x626a69, 0.88, 0.1), lift: material(0x262c2d, 0.78, 0.16),
    paint: material(0xd5d0c3)
  };

  function box(name, x, y, z, sx, sy, sz, mat, options = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    if (options.rotationZ) mesh.rotation.z = options.rotationZ;
    scene.add(mesh);
    meshes.push(mesh);
    if (options.collider) colliders.push({
      minX: x - sx / 2, maxX: x + sx / 2,
      minY: y - sy / 2, maxY: y + sy / 2,
      minZ: z - sz / 2, maxZ: z + sz / 2
    });
    return mesh;
  }

  // Sparse outdoor map, matching DFLAT's empty-map / one-building direction.
  box("Terén", 0, -0.12, -22, 240, 0.24, 240, M.grass);
  box("Hlavní silnice", 0, 0.014, 2.7, 220, 0.04, 8.2, M.asphalt);
  box("Chodník podél silnice", 0, 0.035, -2.05, 220, 0.05, 1.55, M.pavement);
  box("Přístupová cesta", 0, 0.025, -8, 6, 0.04, 10, M.pavement);
  box("Vstupní plošina", 0, 0.045, -14.8, 7, 0.08, 3.4, M.panels);
  for (let x = -102; x <= 102; x += 12) {
    box("Přerušovaná čára silnice", x, 0.04, 2.7, 4.4, 0.012, 0.12, M.paint);
  }

  function makeFloorSlab(floor) {
    const y = floor * floorHeight - 0.08;
    const fullLeft = leftX - 0.14;
    const fullRight = rightX + 0.14;
    const fullRear = rearZ - 0.14;
    const fullFront = frontZ + 0.14;
    if (floor === 0) {
      box("Přízemní deska", 0, y, building.z, building.width + 0.28, 0.16, building.depth + 0.28, M.concrete);
      return;
    }
    box("Podlaží / levé křídlo", (fullLeft + coreOpening.minX) / 2, y, building.z,
      coreOpening.minX - fullLeft, 0.16, building.depth + 0.28, M.concrete);
    box("Podlaží / pravé křídlo", (coreOpening.maxX + fullRight) / 2, y, building.z,
      fullRight - coreOpening.maxX, 0.16, building.depth + 0.28, M.concrete);
    box("Podlaží / chodba", 0, y, (coreOpening.maxZ + fullFront) / 2,
      coreOpening.maxX - coreOpening.minX, 0.16, fullFront - coreOpening.maxZ, M.concrete);
    box("Podlaží / zadní trakt", 0, y, (fullRear + coreOpening.minZ) / 2,
      coreOpening.maxX - coreOpening.minX, 0.16, coreOpening.minZ - fullRear, M.concrete);
  }
  for (let floor = 0; floor < floorCount; floor++) makeFloorSlab(floor);

  box("Zadní nosná stěna", 0, height / 2, rearZ + building.wall / 2,
    building.width, height, building.wall, M.concrete, { collider: true });
  box("Levý štít", leftX + building.wall / 2, height / 2, building.z,
    building.wall, height, building.depth, M.concrete, { collider: true });
  box("Pravý štít", rightX - building.wall / 2, height / 2, building.z,
    building.wall, height, building.depth, M.concrete, { collider: true });

  const windowXs = [-11.4, -8.15, -4.9, -1.65, 1.65, 4.9, 8.15, 11.4];
  const windowWidth = 1.36;
  for (let floor = 0; floor < floorCount; floor++) {
    const floorY = floor * floorHeight;
    const openings = [];
    for (let i = 0; i < windowXs.length; i++) {
      const wx = windowXs[i];
      if (floor === 0 && Math.abs(wx) < 2) continue;
      const balconyDoor = Math.abs(Math.abs(wx) - 4.9) < 0.01;
      const w = balconyDoor ? 1.56 : windowWidth;
      const bottom = balconyDoor ? 0.12 : 0.78;
      const top = balconyDoor ? 2.48 : 2.28;
      openings.push({ x0: wx - w / 2, x1: wx + w / 2, y0: floorY + bottom, y1: floorY + top, x: wx, w, bottom, top, column: i });
    }
    if (floor === 0) openings.push({ x0: -0.94, x1: 0.94, y0: 0.02, y1: 2.5, door: true });

    const xCuts = [leftX, rightX];
    const yCuts = [floorY, floorY + floorHeight];
    for (const opening of openings) {
      xCuts.push(opening.x0, opening.x1);
      yCuts.push(opening.y0, opening.y1);
    }
    const xs = Array.from(new Set(xCuts)).sort((a, b) => a - b);
    const ys = Array.from(new Set(yCuts)).sort((a, b) => a - b);
    for (let xi = 0; xi < xs.length - 1; xi++) {
      for (let yi = 0; yi < ys.length - 1; yi++) {
        const x0 = xs[xi], x1 = xs[xi + 1], y0 = ys[yi], y1 = ys[yi + 1];
        if (x1 - x0 < 0.015 || y1 - y0 < 0.015) continue;
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const isOpening = openings.some(o => cx > o.x0 - 0.001 && cx < o.x1 + 0.001 &&
          cy > o.y0 - 0.001 && cy < o.y1 + 0.001);
        if (isOpening) continue;
        box("Fasáda / betonový panel", cx, cy, frontWallZ, x1 - x0, y1 - y0,
          building.wall, (xi + yi + floor) % 4 === 0 ? M.panels : M.concrete, { collider: true });
      }
    }
    box("Vodorovná spára fasády", 0, floorY + floorHeight - 0.055, frontZ + 0.025,
      building.width, 0.07, 0.055, M.dark);
    for (const o of openings) {
      if (o.door) continue;
      const lit = ((floor * 11 + o.column * 5) % 7) < 2;
      const paneY = (o.y0 + o.y1) / 2;
      box("Okno / zapuštěné sklo", o.x, paneY, frontZ + 0.035, o.w - 0.10,
        o.y1 - o.y0 - 0.1, 0.035, lit ? M.warmGlass : M.glass, { collider: true });
      box("Okno / parapet", o.x, o.y0 + 0.035, frontZ + 0.08, o.w, 0.07, 0.08, M.dark);
    }
  }

  for (const floor of [1, 3, 5, 7]) {
    for (const x of [-4.9, 4.9]) {
      const y = floor * floorHeight + 0.15;
      box("Balkon / deska", x, y, frontZ + 0.72, 2.15, 0.16, 1.35, M.concrete);
      box("Balkon / čelní zábradlí", x, y + 0.55, frontZ + 1.34, 2.15, 0.08, 0.08, M.rail);
      box("Balkon / levé zábradlí", x - 1.02, y + 0.55, frontZ + 0.75, 0.08, 0.08, 1.25, M.rail);
      box("Balkon / pravé zábradlí", x + 1.02, y + 0.55, frontZ + 0.75, 0.08, 0.08, 1.25, M.rail);
    }
  }

  // Open stairwell: matching switchback flight geometry, floor openings and landings.
  const stair = { lowX: -3.2, highX: -0.8, firstZ: -25.1, secondZ: -23.1, steps: 8, stepRise: floorHeight / 16, stepRun: 0.3, treadDepth: 1.12, landingWidth: 1.30, landingDepth: 3.10, landingX: -0.16, landingZ: -24.1 };
  const angle = Math.atan((floorHeight / 2) / (stair.highX - stair.lowX));
  for (let floor = 0; floor < floorCount - 1; floor++) {
    const baseY = floor * floorHeight;
    for (let i = 0; i < stair.steps; i++) {
      const topA = baseY + (i + 1) * stair.stepRise;
      box("Schodiště / dolní rameno", stair.lowX + (i + 0.5) * stair.stepRun,
        (baseY + topA) / 2, stair.firstZ, stair.stepRun + 0.025,
        topA - baseY, stair.treadDepth, M.panels);
      const bottomB = baseY + floorHeight / 2;
      const topB = bottomB + (i + 1) * stair.stepRise;
      box("Schodiště / horní rameno", stair.highX - (i + 0.5) * stair.stepRun,
        (bottomB + topB) / 2, stair.secondZ, stair.stepRun + 0.025,
        topB - bottomB, stair.treadDepth, M.panels);
    }
    box("Schodiště / mezipodesta", stair.landingX, baseY + floorHeight / 2 - 0.08, stair.landingZ,
      stair.landingWidth, 0.16, stair.landingDepth, M.concrete);
    const railLength = Math.hypot(stair.highX - stair.lowX, floorHeight / 2);
    box("Schodiště / madlo dolního ramene", (stair.lowX + stair.highX) / 2,
      baseY + 1.43, stair.firstZ - 0.51, railLength, 0.055, 0.055, M.rail, { rotationZ: angle });
    box("Schodiště / madlo dolního ramene", (stair.lowX + stair.highX) / 2,
      baseY + 1.43, stair.firstZ + 0.51, railLength, 0.055, 0.055, M.rail, { rotationZ: angle });
    box("Schodiště / madlo horního ramene", (stair.lowX + stair.highX) / 2,
      baseY + 2.83, stair.secondZ - 0.51, railLength, 0.055, 0.055, M.rail, { rotationZ: -angle });
    box("Schodiště / madlo horního ramene", (stair.lowX + stair.highX) / 2,
      baseY + 2.83, stair.secondZ + 0.51, railLength, 0.055, 0.055, M.rail, { rotationZ: -angle });
  }

  // Lift shaft and floor doors. The corridor approach stays open and walkable.
  box("Výtah / levá šachta", 1.55, height / 2, -24.15, 0.14, height, 3.5, M.dark, { collider: true });
  box("Výtah / zadní stěna šachty", 2.45, height / 2, -25.82, 1.95, height, 0.14, M.dark, { collider: true });
  box("Výtah / pravá šachta", 3.35, height / 2, -24.15, 0.14, height, 3.5, M.dark, { collider: true });
  for (let floor = 0; floor < floorCount; floor++) {
    const y = floor * floorHeight;
    box("Výtah / dveře", 2.45, y + 1.05, -22.45, 1.48, 2.10, 0.075, M.lift);
    box("Výtah / hrana dveří vlevo", 2.08, y + 1.05, -22.39, 0.03, 2.10, 0.04, M.rail);
    box("Výtah / hrana dveří vpravo", 2.82, y + 1.05, -22.39, 0.03, 2.10, 0.04, M.rail);
    box("Výtah / přivolávací tlačítko", 3.35, y + 1.10, -21.98, 0.06, 0.20, 0.04, M.paint);
  }

  box("Střecha / deska", 0, height - 0.08, building.z, building.width + 0.28, 0.16, building.depth + 0.28, M.panels);
  box("Střecha / přední atika", 0, height + 0.34, frontZ - 0.05, building.width + 0.15, 0.68, 0.24, M.dark);
  box("Střecha / zadní atika", 0, height + 0.34, rearZ + 0.05, building.width + 0.15, 0.68, 0.24, M.dark);
  box("Střecha / levá atika", leftX + 0.05, height + 0.34, building.z, 0.24, 0.68, building.depth, M.dark);
  box("Střecha / pravá atika", rightX - 0.05, height + 0.34, building.z, 0.24, 0.68, building.depth, M.dark);

  function getSupport(x, z, fromElevation = 0) {
    const halfTread = stair.treadDepth / 2;
    const halfLanding = stair.landingDepth / 2;
    const inLanding = x >= stair.landingX - stair.landingWidth / 2 - 0.04 &&
      x <= stair.landingX + stair.landingWidth / 2 + 0.04 &&
      z >= stair.landingZ - halfLanding - 0.04 && z <= stair.landingZ + halfLanding + 0.04;
    const lower = x >= stair.lowX - 0.04 && x <= stair.highX + 0.04 &&
      z >= stair.firstZ - halfTread - 0.04 && z <= stair.firstZ + halfTread + 0.04;
    const upperFrontEdge = Math.max(stair.secondZ + halfTread, coreOpening.maxZ + 0.29 + 0.12);
    const upper = x >= stair.lowX - 0.04 && x <= stair.highX + 0.04 &&
      z >= stair.secondZ - halfTread - 0.04 && z <= upperFrontEdge + 0.04;
    const candidates = [];
    for (let floor = 0; floor < floorCount - 1; floor++) {
      const baseY = floor * floorHeight;
      if (lower) {
        const progress = Math.max(0, Math.min(stair.steps,
          Math.ceil((x - stair.lowX - 0.012) / stair.stepRun - 1e-6)));
        candidates.push({ height: baseY + progress * stair.stepRise, kind: "stair" });
      }
      if (upper) {
        const progress = Math.max(0, Math.min(stair.steps,
          Math.ceil((stair.highX - x - 0.012) / stair.stepRun - 1e-6)));
        candidates.push({ height: baseY + floorHeight / 2 + progress * stair.stepRise, kind: "stair" });
      }
      if (inLanding) candidates.push({ height: baseY + floorHeight / 2, kind: "landing" });
    }
    candidates.sort((a, b) => Math.abs(a.height - fromElevation) - Math.abs(b.height - fromElevation));
    const stairCandidate = candidates.find(item => Math.abs(item.height - fromElevation) <= stair.stepRise + 0.055);
    if (stairCandidate) return stairCandidate;

    const inCore = x > coreOpening.minX - 0.12 && x < coreOpening.maxX + 0.12 &&
      z > coreOpening.minZ - 0.12 && z < coreOpening.maxZ + 0.12;
    if (inCore) return Math.abs(fromElevation) <= 0.23 ? { height: 0, kind: "ground-core" } : null;

    const insideFootprint = x > leftX + 0.42 && x < rightX - 0.42 &&
      z > rearZ + 0.42 && z < frontZ - 0.28;
    if (!insideFootprint) return Math.abs(fromElevation) <= 0.25 ? { height: 0, kind: "ground" } : null;
    const nearestFloor = Math.max(0, Math.min(floorCount - 1, Math.round(fromElevation / floorHeight)));
    const floorY = nearestFloor * floorHeight;
    return Math.abs(floorY - fromElevation) <= 0.23 ? { height: floorY, kind: "floor" } : null;
  }

  return {
    colliders, meshes, floorHeight, floorCount, coreOpening, building, getSupport,
    containsElevatorApproach(x, z) { return Math.hypot(x - 2.45, z + 21.65) < 2.05; }
  };
}