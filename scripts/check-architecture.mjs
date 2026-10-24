import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [pkgText, main, html, world, player, renderer] = await Promise.all([
  read("../package.json"),
  read("../electron/main.cjs"),
  read("../index.html"),
  read("../src/game/world.js"),
  read("../src/game/player.js"),
  read("../src/main.js")
]);
const pkg = JSON.parse(pkgText);
const checks = [
  ["Electron entry exists", pkg.main === "electron/main.cjs"],
  ["Node integration is disabled", /nodeIntegration:\s*false/.test(main)],
  ["Context isolation is enabled", /contextIsolation:\s*true/.test(main)],
  ["Renderer sandbox is enabled", /sandbox:\s*true/.test(main)],
  ["WebGL antialiasing is disabled", /antialias:\s*false/.test(renderer)],
  ["World has eight floors", /floorCount = 8/.test(world)],
  ["World provides stair support sampling", /function getSupport/.test(world)],
  ["Player has jump and mouse-look controls", /function jump/.test(player) && /look\(dx, dy\)/.test(player)],
  ["HTML sets Czech locale and CSP", /lang="cs"/.test(html) && /Content-Security-Policy/.test(html)],
  ["Desktop packaging scripts exist", Boolean(pkg.scripts["dist:win"] && pkg.scripts["dist:linux"] && pkg.scripts["dist:mac"])]
];
const failures = checks.filter(([, passed]) => !passed);
for (const [label, passed] of checks) console.log((passed ? "PASS " : "FAIL ") + label);
if (failures.length) process.exitCode = 1;