import { defineConfig } from "vite";

export default defineConfig({
  // Relative assets are required for Electron's file:// renderer. GitHub Pages
  // injects VITE_BASE_PATH=/d-flat-v41/ for its own static build.
  base: process.env.VITE_BASE_PATH || "./",
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true, target: "es2022", sourcemap: false }
});
