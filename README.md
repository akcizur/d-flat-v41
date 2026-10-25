# D-FLAT V41

Electron desktop FPS prototype for exploring a quiet Czech/Slovak socialist-era panel building inspired by the original DFLAT project: https://github.com/akcizur/DFLAT

## Playable base scene

- Electron desktop shell with an isolated, sandboxed renderer and no Node integration in the game window.
- Compact three-storey, low-poly panel building, about 18 × 12 m, with two mirrored apartments per floor. Each apartment has a living room, kitchen, bedroom, bathroom, WC and its own corridor: 30 rooms total.
- First-person keyboard movement, mouse look, sprint, jump, camera bob and pause/resume.
- Shared stair/elevator hall, distinct apartment entrances, corridor doors to every room, collidable room partitions and visible door frames.
- Central switchback stairs with separate treads, risers, side walls, railings and landings.
- Small elevator with floor switching using E near the lift.
- Sparse outdoor map: terrain, road, footpath and an entry platform.
- Pixel-grid rendering with antialiasing disabled and no full-screen CRT/VHS post-processing.
- Preferences persisted locally: pixel scale, field of view, mouse sensitivity, walk speed and FPS display.
- Syntax/architecture checks, unit tests and a GitHub Actions quality workflow.

The apartment interiors are intentionally unfurnished, but their layout is divided into proper rooms. Two mirrored flats per floor use a simple 2+1-style plan with a living room, kitchen, bedroom, bathroom and WC, entered from a private corridor off the shared stair/elevator hall. Doorways are real gaps in the collidable partitions. The runtime geometry is generated from Three.js primitives so the project can start without configuring an external model.

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
- src/game/world.js: three-floor block, two five-room flats per floor, facade, stairs, lift and support-surface solver.
- src/game/player.js: movement, jump, sprint, camera look and floor tracking.
- src/styles.css: terminal-style menus and in-game HUD.
- tests/: player and stair regression tests.
- .github/workflows/quality.yml: checks on pushes and pull requests.

## Scope

This is a compact playable base scene, not a finished narrative game. It intentionally contains no apartment furniture, quest system, audio library or online service. Useful next steps are sound and footsteps, authored materials, player-body/third-person mode and further collision testing.