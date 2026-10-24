# D-FLAT V41

Electron desktop FPS prototype for exploring a sparse map and a Czech/Slovak socialist-era panelák inspired by the original DFLAT project: https://github.com/akcizur/DFLAT

## Playable base scene

- Electron desktop shell with an isolated, sandboxed renderer and no Node integration in the game window.
- Three.js low-poly scene: open terrain, road, footpath and one eight-storey apartment block.
- First-person keyboard movement, mouse look, sprint, jump, camera bob and pause/resume.
- Eight-floor stairwell with switchback flights, landings and elevator shaft. Press E near the lift to advance one floor.
- Pixel-grid rendering with antialiasing disabled and no full-screen CRT/VHS post-processing.
- Preferences persisted locally: pixel scale, field of view, mouse sensitivity, walk speed and FPS display.
- Syntax/architecture checks, unit tests and a GitHub Actions quality workflow.

The supplied OBJ was inspected as a reference asset (approximately 10 × 10 × 6 m at a 0.01 scale). The initial runtime building is generated from Three.js primitives so the project starts without downloading or configuring an external model. The supplied OBJ can be integrated later as an optional replacement asset.

## Requirements

- Node.js 22.12+ and npm.
- Windows, macOS or Linux with working WebGL acceleration.

## Run in development

```sh
npm install
npm run dev
```

This starts Vite and Electron together. To run the renderer in a browser, use:

```sh
npm run dev:web
```

## Build and checks

```sh
npm run check:syntax
npm run check
npm test
npm run build
```

Create desktop packages:

```sh
npm run dist:win
npm run dist:linux
npm run dist:mac
```

Build artifacts are written to the release folder. Build packages on the corresponding operating system for the most reliable native installer.

## Controls

| Input | Action |
| --- | --- |
| W / A / S / D or arrows | Walk |
| Hold Shift | Sprint |
| Space | Jump |
| Mouse | Look around |
| E near the elevator | Move to the next floor |
| Esc | Pause / resume |
| R | Return to the map start |
| F3 | Toggle FPS / resolution diagnostics |

Click the scene after starting if the mouse is not captured. Press Esc to release the pointer and open the pause screen.

## Project layout

- electron/main.cjs: window lifecycle, external-navigation guard and secure BrowserWindow defaults.
- electron/preload.cjs: minimal read-only desktop context.
- src/main.js: renderer startup, HUD, inputs, settings and render loop.
- src/game/world.js: panelák, exterior map, floor slabs, stairs, elevator and support-surface solver.
- src/game/player.js: movement, jump, sprint, camera look and floor tracking.
- src/styles.css: terminal-style menus and in-game HUD.
- tests/: player-math tests.
- .github/workflows/quality.yml: checks on pushes and pull requests.

## Scope

This is a playable base scene, not a finished narrative game. It intentionally contains no apartment furniture, quest system, audio library or online service. Useful next steps are sound and footsteps, authored materials, player-body/third-person mode, a dedicated collision test pass and optional OBJ/GLB import.