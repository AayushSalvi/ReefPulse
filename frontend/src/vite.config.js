import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Avoid stale JS/CSS in Chrome when iterating on UI (especially after large refactors).
    headers: {
      "Cache-Control": "no-store"
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true
      }
    }
  }
});
