import { defineConfig } from "vite";

// A relative base, so the built page works under a GitHub Pages subpath (/elements/).
export default defineConfig({
  base: "./",
  build: { chunkSizeWarningLimit: 1500 },
});
