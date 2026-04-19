import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Same-origin proxy so the browser can call CKAN SQL (data.ca.gov does not send permissive CORS). */
const caDataGovProxy = {
  "/api/ca-datastore": {
    target: "https://data.ca.gov",
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/api\/ca-datastore/, "/api/3/action")
  }
};

export default defineConfig({
  root: "src",
  /** Load `.env` from `frontend/` (not `frontend/src/`) while `root` is `src`. */
  envDir: __dirname,
  plugins: [react()],
  server: {
    proxy: caDataGovProxy
  },
  preview: {
    proxy: caDataGovProxy
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true
  }
});
