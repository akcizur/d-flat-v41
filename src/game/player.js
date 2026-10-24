export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeAxes(forwardKey, backwardKey, leftKey, rightKey) {
  let forward = Number(Boolean(forwardKey)) - Number(Boolean(backwardKey));
  let strafe = Number(Boolean(rightKey)) - Number(Boolean(leftKey));
  const magnitude = Math.hypot(forward, strafe);
  if (magnitude > 1) {
    forward /= magnitude;
    strafe /= magnitude;
  }
  return { forward, strafe };
}

export function floorIndexFromElevation(elevation, floorHeight = 2.8, floorCount = 8) {
  return clamp(Math.round(elevation / floorHeight), 0, floorCount - 1);
}

export function createPlayerController({ camera, world, settings, onFloorChange }) {
  const player = { x: 0, z: 8.5, elevation: 0, jumpHeight: 0, jumpVelocity: 0, yaw: 0, pitch: -0.025, floor: 0, onGround: true };
  const keys = Object.create(null);
  const radius = 0.29;
  const eyeHeight = 1.66;
  const gravity = 18.5;
  const jumpSpeed = 5.4;
  let walkPhase = 0;
  let isRunning = false;

  function canOccupy(x, z) {
    for (const collider of world.colliders) {
      const verticalOverlap = collider.maxY > player.elevation + 0.04 && collider.minY < player.elevation + 1.85;
      if (verticalOverlap && x + radius > collider.minX && x - radius < collider.maxX &&
          z + radius > collider.minZ && z - radius < collider.maxZ) return false;
    }
    return true;
  }

  function tryMove(x, z) {
    if (!canOccupy(x, z)) return false;
    const support = world.getSupport(x, z, player.elevation);
    if (!support) return false;
    player.x = x;
    player.z = z;
    player.elevation = support.height;
    player.onGround = player.jumpHeight <= 0.001;
    return true;
  }

  function move(dx, dz) {
    if (Math.abs(dx) > 0.00001) tryMove(player.x + dx, player.z);
    if (Math.abs(dz) > 0.00001) tryMove(player.x, player.z + dz);
  }

  function jump() {
    if (!player.onGround || player.jumpHeight > 0.001) return;
    player.jumpVelocity = jumpSpeed;
    player.jumpHeight = 0.001;
    player.onGround = false;
  }

  function reset() {
    player.x = 0; player.z = 8.5; player.elevation = 0;
    player.jumpHeight = 0; player.jumpVelocity = 0;
    player.yaw = 0; player.pitch = -0.025; player.onGround = true;
    for (const key of Object.keys(keys)) keys[key] = false;
    if (player.floor !== 0) { player.floor = 0; onFloorChange(0); }
  }

  function teleportToFloor(floor) {
    const bounded = clamp(floor, 0, world.floorCount - 1);
    player.x = 2.45; player.z = -21.55; player.elevation = bounded * world.floorHeight;
    player.jumpHeight = 0; player.jumpVelocity = 0; player.onGround = true;
    player.floor = bounded; onFloorChange(bounded);
  }

  function interact() {
    const elevatorDistance = Math.hypot(player.x - 2.45, player.z + 21.65);
    if (elevatorDistance < 2.05) {
      const next = (player.floor + 1) % world.floorCount;
      teleportToFloor(next);
      return { type: "elevator", floor: next };
    }
    return { type: "none" };
  }

  function update(delta) {
    const dt = Math.min(0.035, Math.max(0, delta));
    const axes = normalizeAxes(
      keys.KeyW || keys.ArrowUp, keys.KeyS || keys.ArrowDown,
      keys.KeyA || keys.ArrowLeft, keys.KeyD || keys.ArrowRight
    );
    isRunning = Boolean(keys.ShiftLeft || keys.ShiftRight);
    const speed = settings.walkSpeed * (isRunning ? 1.8 : 1);
    const forwardX = -Math.sin(player.yaw), forwardZ = -Math.cos(player.yaw);
    const rightX = Math.cos(player.yaw), rightZ = -Math.sin(player.yaw);
    move((forwardX * axes.forward + rightX * axes.strafe) * speed * dt,
      (forwardZ * axes.forward + rightZ * axes.strafe) * speed * dt);

    if (player.jumpHeight > 0 || player.jumpVelocity > 0) {
      player.jumpHeight += player.jumpVelocity * dt;
      player.jumpVelocity -= gravity * dt;
      if (player.jumpHeight <= 0) { player.jumpHeight = 0; player.jumpVelocity = 0; player.onGround = true; }
    }
    const nextFloor = floorIndexFromElevation(player.elevation, world.floorHeight, world.floorCount);
    if (nextFloor !== player.floor && Math.abs(player.elevation - nextFloor * world.floorHeight) < 0.035) {
      player.floor = nextFloor;
      onFloorChange(nextFloor);
    }
    if (axes.forward || axes.strafe) walkPhase += dt * (isRunning ? 10.5 : 7.1);
    const bob = player.onGround && (axes.forward || axes.strafe) ? Math.sin(walkPhase) * (isRunning ? 0.045 : 0.022) : 0;
    camera.position.set(player.x, player.elevation + player.jumpHeight + eyeHeight + bob, player.z);
    camera.rotation.order = "YXZ";
    camera.rotation.set(player.pitch, player.yaw, 0);
  }

  return {
    player, keys, update, jump, reset, interact, teleportToFloor,
    look(dx, dy) {
      player.yaw -= dx * 0.0010 * settings.mouseSensitivity;
      player.pitch = clamp(player.pitch - dy * 0.0009 * settings.mouseSensitivity, -1.35, 1.35);
    }
  };
}