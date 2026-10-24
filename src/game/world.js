export function createWorld(THREE, scene) {
  const colliders = [];
  const meshes = [];
  const floorHeight = 2.8;
  const floorCount = 3;
  const building = { x: 0, z: -22, width: 18, depth: 12, wall: 0.24 };
  const height = floorHeight * floorCount;
  const frontZ = building.z + building.depth / 2;
  const rearZ = building.z - building.depth / 2;
  const leftX = -building.width / 2;
  const rightX = building.width / 2;
  const frontWallZ = frontZ - building.wall / 2;
  const rearWallZ = rearZ + building.wall / 2;

  // The core is the open stairwell. Upper-floor slabs are cut around it.
  const coreOpening = { minX: -2.25, maxX: 2.4, minZ: -26.3, maxZ: -21.5 };
  const elevator = { x: 1.65, z: -19.55, approachZ: -18.35 };

  const material = (color, roughness = 1, metalness = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true, ...extra });

  const M = {
    grass: material(0x747b6d),
    asphalt: material(0x50565a),
    pavement: material(0x98978e),
    concrete: material(0xbdbbb2),
    panels: material(0xc9c7bd),
    plaster: material(0xd1ccbe),
    dark: material(0x858883),
    rail: material(0x626a69, 0.88, 0.1),
    lift: material(0x262c2d, 0.78, 0.16),
    paint: material(0xd5d0c3),
    glass: material(0x718891, 0.35, 0.04, { transparent: true, opacity: 0.38, depthWrite: false }),
    warmGlass: material(0xb49a70, 0.42, 0.02, { transparent: true, opacity: 0.48, depthWrite: false })
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

    if (options.collider) {
      const angle = options.rotationZ ?? 0;
      const halfX = (Math.abs(Math.cos(angle)) * sx + Math.abs(Math.sin(angle)) * sy) / 2;
      const halfY = (Math.abs(Math.sin(angle)) * sx + Math.abs(Math.cos(angle)) * sy) / 2;
      colliders.push({
        minX: x - halfX, maxX: x + halfX,
        minY: y - halfY, maxY: y + halfY,
        minZ: z - sz / 2, maxZ: z + sz / 2
      });
    }
    return mesh;
  }

  // Quiet exterior map: one modest building, a path and a road.
  box("Terén", 0, -0.14, -22, 240, 0.24, 240, M.grass);
  box("Hlavní silnice", 0, 0.014, 2.7, 220, 0.04, 8.2, M.asphalt);
  box("Chodník podél silnice", 0, 0.035, -2.05, 220, 0.05, 1.55, M.pavement);
  box("Přístupová cesta", 0, 0.025, -8, 4.6, 0.04, 10, M.pavement);
  box("Vstupní plošina", 0, 0.045, -14.8, 5.0, 0.08, 3.2, M.panels);
  for (let x = -102; x <= 102; x += 12) {
    box("Přerušovaná čára silnice", x, 0.04, 2.7, 4.4, 0.012, 0.12, M.paint);
  }

  function addFloorSlab(floor) {
    const y = floor * floorHeight - 0.08;
    const fullLeft = leftX - 0.12;
    const fullRight = rightX + 0.12;
    const fullRear = rearZ - 0.12;
    const fullFront = frontZ + 0.12;
    if (floor === 0) {
      box("Přízemní podlaha", 0, y, building.z, building.width + 0.24, 0.16, building.depth + 0.24, M.concrete);
      return;
    }

    // Leave only the central stairwell opening; the side rooms and corridors
    // retain continuous walkable slabs.
    box("Podlaha / přední trakt", 0, y, (coreOpening.maxZ + fullFront) / 2,
      building.width + 0.24, 0.16, fullFront - coreOpening.maxZ, M.concrete);
    box("Podlaha / zadní trakt", 0, y, (fullRear + coreOpening.minZ) / 2,
      building.width + 0.24, 0.16, coreOpening.minZ - fullRear, M.concrete);
    const coreCenterZ = (coreOpening.minZ + coreOpening.maxZ) / 2;
    box("Podlaha / levý bok schodiště", (fullLeft + coreOpening.minX) / 2, y, coreCenterZ,
      coreOpening.minX - fullLeft, 0.16, coreOpening.maxZ - coreOpening.minZ, M.concrete);
    box("Podlaha / pravý bok schodiště", (coreOpening.maxX + fullRight) / 2, y, coreCenterZ,
      fullRight - coreOpening.maxX, 0.16, coreOpening.maxZ - coreOpening.minZ, M.concrete);
  }
  for (let floor = 0; floor < floorCount; floor++) addFloorSlab(floor);

  // Exterior end walls. The front and rear are built from panels around windows.
  box("Levý štít", leftX + building.wall / 2, height / 2, building.z,
    building.wall, height, building.depth, M.concrete, { collider: true });
  box("Pravý štít", rightX - building.wall / 2, height / 2, building.z,
    building.wall, height, building.depth, M.concrete, { collider: true });

  function addFacadeFloor(floor, z, isFront) {
    const floorY = floor * floorHeight;
    const windowXs = [-7.0, -4.6, 0, 4.6, 7.0];
    const openings = [];
    for (let i = 0; i < windowXs.length; i++) {
      const wx = windowXs[i];
      if (isFront && floor === 0 && wx === 0) {
        openings.push({ x0: -0.92, x1: 0.92, y0: floorY + 0.02, y1: floorY + 2.32, door: true });
      } else {
        const width = wx === 0 ? 1.45 : 1.34;
        openings.push({
          x0: wx - width / 2, x1: wx + width / 2,
          y0: floorY + 0.72, y1: floorY + 2.24,
          x: wx, width, column: i, window: true
        });
      }
    }

    const xCuts = [leftX, rightX];
    const yCuts = [floorY, floorY + floorHeight];
    for (const o of openings) {
      xCuts.push(o.x0, o.x1);
      yCuts.push(o.y0, o.y1);
    }
    const xs = Array.from(new Set(xCuts)).sort((a, b) => a - b);
    const ys = Array.from(new Set(yCuts)).sort((a, b) => a - b);

    for (let xi = 0; xi < xs.length - 1; xi++) {
      for (let yi = 0; yi < ys.length - 1; yi++) {
        const x0 = xs[xi], x1 = xs[xi + 1], y0 = ys[yi], y1 = ys[yi + 1];
        if (x1 - x0 < 0.015 || y1 - y0 < 0.015) continue;
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const isOpening = openings.some(o =>
          cx > o.x0 - 0.001 && cx < o.x1 + 0.001 &&
          cy > o.y0 - 0.001 && cy < o.y1 + 0.001
        );
        if (isOpening) continue;
        box(isFront ? "Přední fasáda / panel" : "Zadní fasáda / panel",
          cx, cy, z, x1 - x0, y1 - y0, building.wall,
          (xi + yi + floor) % 4 === 0 ? M.panels : M.concrete, { collider: true });
      }
    }

    for (const o of openings) {
      if (!o.window) continue;
      const lit = ((floor * 5 + o.column * 3 + (isFront ? 1 : 0)) % 6) === 0;
      box(isFront ? "Přední okno / sklo" : "Zadní okno / sklo",
        o.x, (o.y0 + o.y1) / 2, z + (isFront ? 0.13 : -0.13),
        o.width - 0.08, o.y1 - o.y0 - 0.08, 0.035,
        lit ? M.warmGlass : M.glass, { collider: true });
      box("Okno / parapet", o.x, o.y0 + 0.035, z + (isFront ? 0.16 : -0.16),
        o.width, 0.07, 0.08, M.dark);
    }

    box("Vodorovná spára fasády", 0, floorY + floorHeight - 0.05,
      z + (isFront ? 0.15 : -0.15), building.width, 0.06, 0.06, M.dark);
  }

  for (let floor = 0; floor < floorCount; floor++) {
    addFacadeFloor(floor, frontWallZ, true);
    addFacadeFloor(floor, rearWallZ, false);
  }

  // Empty simple rooms: one room at each end of each wing, four per floor.
  // Longitudinal partitions have door-sized gaps opening onto the central hall.
  const roomWallHeight = 2.5;
  const roomWallThickness = 0.16;
  const roomDoorWidth = 1.1;
  const roomDoorCenters = [-18.8, -25.5];

  function addWallAlongZ(name, x, floorY, zMin, zMax, doorCenters) {
    const gaps = doorCenters
      .map(center => ({ min: center - roomDoorWidth / 2, max: center + roomDoorWidth / 2 }))
      .sort((a, b) => a.min - b.min);
    let cursor = zMin;
    for (const gap of gaps) {
      if (gap.min > cursor) {
        const depth = gap.min - cursor;
        box(name, x, floorY + roomWallHeight / 2, (cursor + gap.min) / 2,
          roomWallThickness, roomWallHeight, depth, M.plaster, { collider: true });
      }
      box("Místnost / nadpraží", x, floorY + 2.55, (gap.min + gap.max) / 2,
        roomWallThickness, 0.4, gap.max - gap.min, M.plaster);
      cursor = gap.max;
    }
    if (cursor < zMax) {
      box(name, x, floorY + roomWallHeight / 2, (cursor + zMax) / 2,
        roomWallThickness, roomWallHeight, zMax - cursor, M.plaster, { collider: true });
    }
  }

  function addWallAlongX(name, z, floorY, xMin, xMax, doorCenter) {
    const gapMin = doorCenter - roomDoorWidth / 2;
    const gapMax = doorCenter + roomDoorWidth / 2;
    if (gapMin > xMin) {
      box(name, (xMin + gapMin) / 2, floorY + roomWallHeight / 2, z,
        gapMin - xMin, roomWallHeight, roomWallThickness, M.plaster, { collider: true });
    }
    box("Místnost / nadpraží", (gapMin + gapMax) / 2, floorY + 2.55, z,
      gapMax - gapMin, 0.4, roomWallThickness, M.plaster);
    if (gapMax < xMax) {
      box(name, (gapMax + xMax) / 2, floorY + roomWallHeight / 2, z,
        xMax - gapMax, roomWallHeight, roomWallThickness, M.plaster, { collider: true });
    }
  }

  const roomLeft = leftX + building.wall + 0.10;
  const roomRight = rightX - building.wall - 0.10;
  const hallLeft = -3.2;
  const hallRight = 3.2;
  const roomDividerZ = -21.2;
  for (let floor = 0; floor < floorCount; floor++) {
    const floorY = floor * floorHeight;
    addWallAlongZ("Vnitřní stěna / levé místnosti", hallLeft, floorY,
      rearZ + building.wall, frontZ - building.wall, roomDoorCenters);
    addWallAlongZ("Vnitřní stěna / pravé místnosti", hallRight, floorY,
      rearZ + building.wall, frontZ - building.wall, roomDoorCenters);

    addWallAlongX("Příčka / levá část", roomDividerZ, floorY,
      roomLeft, hallLeft, -6.0);
    addWallAlongX("Příčka / pravá část", roomDividerZ, floorY,
      hallRight, roomRight, 6.0);
  }

  // Small three-storey stairwell, with separate treads, risers and side walls.
  const stair = {
    lowX: -1.8, highX: 1.0,
    firstZ: -25.5, secondZ: -23.1,
    steps: 8, stepRise: floorHeight / 16,
    stepRun: 0.35, treadDepth: 1.0,
    landingWidth: 1.3, landingDepth: 2.6,
    landingX: 1.65, landingZ: -24.3
  };
  const stairAngle = Math.atan((floorHeight / 2) / (stair.highX - stair.lowX));
  const treadThickness = 0.075;
  const sideWallHeight = 0.82;
  const sideWallOffset = stair.treadDepth / 2 + 0.11;

  for (let floor = 0; floor < floorCount - 1; floor++) {
    const baseY = floor * floorHeight;
    for (let i = 0; i < stair.steps; i++) {
      const lowerTop = baseY + (i + 1) * stair.stepRise;
      const lowerX = stair.lowX + (i + 0.5) * stair.stepRun;
      box("Schodiště / dolní nášlap", lowerX, lowerTop - treadThickness / 2,
        stair.firstZ, stair.stepRun + 0.025, treadThickness, stair.treadDepth, M.panels);
      box("Schodiště / dolní čelo", stair.lowX + (i + 1) * stair.stepRun,
        baseY + (i + 0.5) * stair.stepRise, stair.firstZ,
        0.045, stair.stepRise, stair.treadDepth, M.dark);

      for (const zSide of [-sideWallOffset, sideWallOffset]) {
        box("Schodiště / dolní boční zídka", lowerX, lowerTop + sideWallHeight / 2,
          stair.firstZ + zSide, stair.stepRun + 0.025, sideWallHeight, 0.10,
          M.concrete, { collider: true });
      }

      const upperBottom = baseY + floorHeight / 2;
      const upperTop = upperBottom + (i + 1) * stair.stepRise;
      const upperX = stair.highX - (i + 0.5) * stair.stepRun;
      box("Schodiště / horní nášlap", upperX, upperTop - treadThickness / 2,
        stair.secondZ, stair.stepRun + 0.025, treadThickness, stair.treadDepth, M.panels);
      box("Schodiště / horní čelo", stair.highX - (i + 1) * stair.stepRun,
        upperBottom + (i + 0.5) * stair.stepRise, stair.secondZ,
        0.045, stair.stepRise, stair.treadDepth, M.dark);

      for (const zSide of [-sideWallOffset, sideWallOffset]) {
        box("Schodiště / horní boční zídka", upperX, upperTop + sideWallHeight / 2,
          stair.secondZ + zSide, stair.stepRun + 0.025, sideWallHeight, 0.10,
          M.concrete, { collider: true });
      }
    }

    box("Schodiště / mezipodesta", stair.landingX,
      baseY + floorHeight / 2 - 0.08, stair.landingZ,
      stair.landingWidth, 0.16, stair.landingDepth, M.concrete);
    box("Schodiště / horní výstupní podesta",
      stair.lowX - 0.35, baseY + floorHeight - 0.075, stair.secondZ,
      1.0, 0.16, 1.25, M.concrete);

    const railLength = Math.hypot(stair.highX - stair.lowX, floorHeight / 2);
    for (const zSide of [-sideWallOffset, sideWallOffset]) {
      box("Schodiště / madlo dolního ramene",
        (stair.lowX + stair.highX) / 2,
        baseY + floorHeight / 4 + sideWallHeight + 0.10,
        stair.firstZ + zSide, railLength, 0.055, 0.055, M.rail,
        { rotationZ: stairAngle });
      box("Schodiště / madlo horního ramene",
        (stair.lowX + stair.highX) / 2,
        baseY + floorHeight * 3 / 4 + sideWallHeight + 0.10,
        stair.secondZ + zSide, railLength, 0.055, 0.055, M.rail,
        { rotationZ: -stairAngle });
    }
  }

  // A compact lift sits beside the hall. Its centre opens toward the front.
  box("Výtah / levá šachta", elevator.x - 0.66, height / 2, elevator.z,
    0.12, height, 2.1, M.dark, { collider: true });
  box("Výtah / pravá šachta", elevator.x + 0.66, height / 2, elevator.z,
    0.12, height, 2.1, M.dark, { collider: true });
  box("Výtah / zadní šachta", elevator.x, height / 2, elevator.z - 1.05,
    1.35, height, 0.12, M.dark, { collider: true });
  for (let floor = 0; floor < floorCount; floor++) {
    const y = floor * floorHeight;
    box("Výtah / dveře vlevo", elevator.x - 0.29, y + 1.05, elevator.z + 1.05,
      0.56, 2.1, 0.055, M.lift);
    box("Výtah / dveře vpravo", elevator.x + 0.29, y + 1.05, elevator.z + 1.05,
      0.56, 2.1, 0.055, M.lift);
    box("Výtah / přivolávací tlačítko", elevator.x + 0.83, y + 1.08, elevator.z + 0.94,
      0.045, 0.19, 0.05, M.paint);
  }

  // Simple roof and low parapet, sized for three floors.
  box("Střecha / deska", 0, height - 0.08, building.z,
    building.width + 0.24, 0.16, building.depth + 0.24, M.panels);
  box("Střecha / přední atika", 0, height + 0.28, frontZ - 0.05,
    building.width + 0.15, 0.56, 0.22, M.dark);
  box("Střecha / zadní atika", 0, height + 0.28, rearZ + 0.05,
    building.width + 0.15, 0.56, 0.22, M.dark);
  box("Střecha / levá atika", leftX + 0.05, height + 0.28, building.z,
    0.22, 0.56, building.depth, M.dark);
  box("Střecha / pravá atika", rightX - 0.05, height + 0.28, building.z,
    0.22, 0.56, building.depth, M.dark);

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

    const inUpperExit = x >= stair.lowX - 0.85 && x <= stair.lowX + 0.05 &&
      z >= stair.secondZ - halfTread - 0.10 && z <= stair.secondZ + halfTread + 0.10;
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
      if (inUpperExit) candidates.push({ height: baseY + floorHeight, kind: "landing" });
    }
    candidates.sort((a, b) => Math.abs(a.height - fromElevation) - Math.abs(b.height - fromElevation));
    const stairCandidate = candidates.find(item =>
      Math.abs(item.height - fromElevation) <= stair.stepRise + 0.055
    );
    if (stairCandidate) return stairCandidate;

    const inCore = x > coreOpening.minX - 0.12 && x < coreOpening.maxX + 0.12 &&
      z > coreOpening.minZ - 0.12 && z < coreOpening.maxZ + 0.12;
    if (inCore) {
      return Math.abs(fromElevation) <= stair.stepRise + 0.055
        ? { height: 0, kind: "ground-core" }
        : null;
    }

    const insideFootprint = x > leftX + 0.42 && x < rightX - 0.42 &&
      z > rearZ + 0.42 && z < frontZ - 0.28;
    if (!insideFootprint) {
      return Math.abs(fromElevation) <= 0.25 ? { height: 0, kind: "ground" } : null;
    }

    const nearestFloor = Math.max(0, Math.min(floorCount - 1,
      Math.round(fromElevation / floorHeight)));
    const floorY = nearestFloor * floorHeight;
    return Math.abs(floorY - fromElevation) <= 0.23 ? { height: floorY, kind: "floor" } : null;
  }

  return {
    colliders, meshes, floorHeight, floorCount, roomsPerFloor: 4, coreOpening, building, elevator, getSupport,
    containsElevatorApproach(x, z) {
      return Math.hypot(x - elevator.x, z - elevator.approachZ) < 1.8;
    }
  };
}