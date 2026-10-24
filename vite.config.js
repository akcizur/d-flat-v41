import { defineConfig } from "vite";

export default defineConfig({
  base: '/d-flat-v41/',
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true, target: "es2022", sourcemap: false }
});
