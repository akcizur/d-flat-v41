import * as THREE from "three";
import { createWorld } from "./game/world.js";
import { createPlayerController } from "./game/player.js";
import "./styles.css";

const $ = (selector) => document.querySelector(selector);
const canvas = $("#game-canvas");
const startScreen = $("#start-screen");
const pauseScreen = $("#pause-screen");
const settingsScreen = $("#settings-screen");
const hud = $("#hud");
const toast = $("#toast");
const interactionHint = $("#interaction-hint");
const errorScreen = $("#error-screen");
const errorMessage = $("#error-message");

const defaults = { pixelScale: 3.2, fov: 72, mouseSensitivity: 1, walkSpeed: 3.6, showFps: false };
let settings = { ...defaults };
try {
  const stored = JSON.parse(localStorage.getItem("dflat-v41-settings") || "null");
  if (stored && typeof stored === "object") settings = { ...defaults, ...stored };
} catch (error) {
  console.warn("Settings could not be read; defaults will be used.", error);
}
const numericSetting = (value, fallback, min, max) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};
settings.pixelScale = numericSetting(settings.pixelScale, defaults.pixelScale, 1.5, 5);
settings.fov = numericSetting(settings.fov, defaults.fov, 55, 95);
settings.mouseSensitivity = numericSetting(settings.mouseSensitivity, defaults.mouseSensitivity, 0.4, 2.2);
settings.walkSpeed = numericSetting(settings.walkSpeed, defaults.walkSpeed, 2, 5.5);
settings.showFps = Boolean(settings.showFps);

const state = { started: false, paused: false, settingsReturn: "start", toastTimer: 0 };
let renderer;
let camera;
let scene;
let world;
let controller;
let lastTime = performance.now();
let fpsFrames = 0;
let fpsTimer = 0;
let showDebug = false;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 1900);
}

function floorName(floor) {
  return floor === 0 ? "PŘÍZEMÍ" : floor + ". PATRO";
}

function setFloorLabel(floor) {
  $("#floor-label").textContent = floorName(floor);
  $("#location-label").textContent = floor === 0
    ? "HLAVNÍ BUDOVA / PŘÍZEMÍ"
    : "HLAVNÍ BUDOVA / SPOLEČNÁ CHODBA";
}

function setScreen(screen) {
  startScreen.classList.toggle("is-hidden", screen !== "start");
  pauseScreen.classList.toggle("is-hidden", screen !== "pause");
  settingsScreen.classList.toggle("is-hidden", screen !== "settings");
  hud.classList.toggle("is-hidden", !state.started || state.paused || screen === "settings");
}

function syncSettingsForm() {
  $("#pixel-scale").value = String(settings.pixelScale);
  $("#field-of-view").value = String(settings.fov);
  $("#mouse-sensitivity").value = String(settings.mouseSensitivity);
  $("#walk-speed").value = String(settings.walkSpeed);
  $("#show-fps").checked = settings.showFps;
  $("#pixel-output").textContent = settings.pixelScale.toFixed(1) + "×";
  $("#fov-output").textContent = Math.round(settings.fov) + "°";
  $("#sensitivity-output").textContent = settings.mouseSensitivity.toFixed(1) + "×";
  $("#speed-output").textContent = settings.walkSpeed.toFixed(1) + " m/s";
}

function saveSettings() {
  settings.pixelScale = Number($("#pixel-scale").value);
  settings.fov = Number($("#field-of-view").value);
  settings.mouseSensitivity = Number($("#mouse-sensitivity").value);
  settings.walkSpeed = Number($("#walk-speed").value);
  settings.showFps = $("#show-fps").checked;
  if (camera) {
    camera.fov = settings.fov;
    camera.updateProjectionMatrix();
  }
  syncSettingsForm();
  resizeRenderer();
  try { localStorage.setItem("dflat-v41-settings", JSON.stringify(settings)); } catch {}
}

function openSettings(from) {
  state.settingsReturn = from;
  syncSettingsForm();
  setScreen("settings");
}

function closeSettings() {
  saveSettings();
  setScreen(state.settingsReturn);
}

function buildEngine() {
  try {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x858b8e);
    scene.fog = new THREE.FogExp2(0x858b8e, 0.0022);
    camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.08, 320);
    camera.rotation.order = "YXZ";

    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false
    });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = false;
    renderer.setClearColor(0x858b8e, 1);

    const fill = new THREE.HemisphereLight(0xdce8ff, 0x625648, 1.15);
    scene.add(fill);
    const sun = new THREE.DirectionalLight(0xffe6c2, 1.6);
    sun.position.set(-7, 12, 6);
    scene.add(sun);

    world = createWorld(THREE, scene);
    controller = createPlayerController({ camera, world, settings, onFloorChange: setFloorLabel });
    camera.position.set(0, 1.66, 8.5);
    resizeRenderer();
    window.addEventListener("resize", resizeRenderer);
    bindControls();
    $("#desktop-version").textContent = window.dflatDesktop?.desktop ? "ELECTRON DESKTOP" : "WEB PREVIEW";
    syncSettingsForm();
    $("#fps-label").hidden = !settings.showFps;
    animate();
  } catch (error) {
    console.error(error);
    errorMessage.textContent = error instanceof Error ? error.message : "Neznámá chyba 3D enginu.";
    errorScreen.classList.remove("is-hidden");
  }
}

function resizeRenderer() {
  if (!renderer || !camera) return;
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const resolutionWidth = Math.max(240, Math.floor(width / settings.pixelScale));
  const resolutionHeight = Math.max(135, Math.floor(height / settings.pixelScale));
  renderer.setSize(resolutionWidth, resolutionHeight, false);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.imageRendering = "pixelated";
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function bindControls() {
  const movementCodes = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
  const controlledCodes = new Set([...movementCodes, "Space", "ShiftLeft", "ShiftRight", "KeyE", "Escape", "Enter", "F3", "KeyR"]);

  $("#start-button").addEventListener("click", startGame);
  $("#resume-button").addEventListener("click", resumeGame);
  $("#pause-button").addEventListener("click", togglePause);
  $("#pause-settings").addEventListener("click", () => openSettings("pause"));
  $("#open-settings").addEventListener("click", () => openSettings("start"));
  $("#close-settings").addEventListener("click", closeSettings);
  $("#save-settings").addEventListener("click", closeSettings);
  $("#reset-settings").addEventListener("click", () => {
    settings = { ...defaults };
    syncSettingsForm();
    saveSettings();
  });
  $("#restart-button").addEventListener("click", () => {
    controller.reset();
    resumeGame();
    showToast("Návrat na začátek mapy.");
  });
  $("#retry-button").addEventListener("click", () => {
    errorScreen.classList.add("is-hidden");
    buildEngine();
  });

  for (const id of ["pixel-scale", "field-of-view", "mouse-sensitivity", "walk-speed", "show-fps"]) {
    $("#" + id).addEventListener("input", () => {
      if (id === "pixel-scale") {
        $("#pixel-output").textContent = Number($("#pixel-scale").value).toFixed(1) + "×";
        const oldScale = settings.pixelScale;
        settings.pixelScale = Number($("#pixel-scale").value);
        resizeRenderer();
        settings.pixelScale = oldScale;
      }
      if (id === "field-of-view") {
        $("#fov-output").textContent = $("#field-of-view").value + "°";
        if (camera) {
          const oldFov = camera.fov;
          camera.fov = Number($("#field-of-view").value);
          camera.updateProjectionMatrix();
          if (!Number.isFinite(camera.fov)) camera.fov = oldFov;
        }
      }
      if (id === "mouse-sensitivity") $("#sensitivity-output").textContent = Number($("#mouse-sensitivity").value).toFixed(1) + "×";
      if (id === "walk-speed") $("#speed-output").textContent = Number($("#walk-speed").value).toFixed(1) + " m/s";
      if (id === "show-fps") $("#fps-label").hidden = !$("#show-fps").checked;
    });
  }

  window.addEventListener("keydown", (event) => {
    if (controlledCodes.has(event.code)) event.preventDefault();
    if (event.code === "Escape") {
      if (!settingsScreen.classList.contains("is-hidden")) { closeSettings(); return; }
      togglePause();
      return;
    }
    if (event.code === "Enter" && !state.started && settingsScreen.classList.contains("is-hidden")) {
      startGame();
      return;
    }
    if (event.code === "Enter" && state.paused) { resumeGame(); return; }
    if (event.code === "Space" && state.started && !state.paused && !event.repeat) controller.jump();
    if (event.code === "KeyE" && state.started && !state.paused && settingsScreen.classList.contains("is-hidden") && !event.repeat) {
      const action = controller.interact();
      if (action.type === "elevator") showToast("Výtah: " + floorName(action.floor));
      else showToast("Přistupte blíže k výtahu.");
    }
    if (event.code === "KeyR" && state.started && !state.paused && !event.repeat) {
      controller.reset();
      showToast("Pozice hráče obnovena.");
    }
    if (event.code === "F3") {
      showDebug = !showDebug;
      showToast(showDebug ? "Diagnostika zapnuta." : "Diagnostika vypnuta.");
    }
    if (state.started && !state.paused && settingsScreen.classList.contains("is-hidden")) controller.keys[event.code] = true;
  });

  window.addEventListener("keyup", (event) => { controller.keys[event.code] = false; });
  window.addEventListener("blur", () => {
    for (const key of Object.keys(controller.keys)) controller.keys[key] = false;
    if (state.started && !state.paused && document.pointerLockElement) pauseGame();
  });

  canvas.addEventListener("click", () => {
    if (state.started && !state.paused && canvas.requestPointerLock && !document.pointerLockElement) {
      const result = canvas.requestPointerLock();
      if (result && typeof result.catch === "function") result.catch(() => {});
    }
  });
  document.addEventListener("mousemove", (event) => {
    if (document.pointerLockElement === canvas && state.started && !state.paused) controller.look(event.movementX, event.movementY);
  });
  document.addEventListener("pointerlockchange", () => {
    // Keyboard movement remains available when the pointer is released.
  });
}

function startGame() {
  if (state.started) return;
  state.started = true;
  state.paused = false;
  setScreen("game");
  if (canvas.requestPointerLock) {
    const result = canvas.requestPointerLock();
    if (result && typeof result.catch === "function") result.catch(() => {});
  }
  canvas.focus({ preventScroll: true });
}

function resumeGame() {
  state.paused = false;
  if (!state.started) return;
  setScreen("game");
  canvas.focus({ preventScroll: true });
}

function pauseGame() {
  state.paused = true;
  for (const key of Object.keys(controller.keys)) controller.keys[key] = false;
  if (document.pointerLockElement) document.exitPointerLock();
  setScreen("pause");
}

function togglePause() {
  if (!state.started) return;
  if (state.paused) resumeGame();
  else pauseGame();
}

function animate(now = performance.now()) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.035);
  lastTime = now;
  if (state.started && !state.paused && settingsScreen.classList.contains("is-hidden")) controller.update(dt);
  interactionHint.hidden = !(
    state.started && !state.paused &&
    world.containsElevatorApproach(controller.player.x, controller.player.z)
  );
  if (renderer && scene && camera) renderer.render(scene, camera);

  fpsFrames++;
  fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    const fps = Math.round(fpsFrames / Math.max(fpsTimer, 0.001));
    $("#fps-label").textContent = fps + " FPS" + (showDebug ? " / " + canvas.width + "×" + canvas.height : "");
    $("#fps-label").hidden = !settings.showFps && !showDebug;
    fpsFrames = 0;
    fpsTimer = 0;
  }
}

buildEngine();