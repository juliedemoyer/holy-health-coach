import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Cloudflare Pages compatible Vite SPA.
// `base: "/"` keeps assets at root so the SPA fallback works on Pages.
// `server.fs.allow` includes the repo root so src/lib/config.ts can import
// ../../../config/*.json during dev.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  server: {
    port: 5173,
    host: true,
    fs: {
      // Allow importing config/*.json from the repo root.
      allow: [fileURLToPath(new URL("..", import.meta.url))],
    },
  },
});
