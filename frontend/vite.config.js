import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Strip BOM / wrapping quotes so `.env` mistakes do not break the Maps script tag. */
function normalizeGoogleMapsEnvValue(value) {
  if (value == null || typeof value !== "string") return "";
  let s = value.trim();
  if (!s) return "";
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/** Reads Maps keys from `frontend/.env`, repo root `.env`, or `backend/.env` (first hit wins). */
function readGoogleMapsApiKeyForInject(mode) {
  const dirs = [
    __dirname,
    path.join(__dirname, ".."),
    path.join(__dirname, "..", "backend")
  ];
  const keys = ["VITE_GOOGLE_MAPS_API_KEY", "GOOGLE_MAPS_API_KEY"];
  for (const dir of dirs) {
    const env = loadEnv(mode, dir, "");
    for (const k of keys) {
      const v = normalizeGoogleMapsEnvValue(env[k]);
      if (v) return v;
    }
  }
  return "";
}

/** Same-origin proxy so the browser can call CKAN SQL (data.ca.gov does not send permissive CORS). */
const caDataGovProxy = {
  "/api/ca-datastore": {
    target: "https://data.ca.gov",
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/api\/ca-datastore/, "/api/3/action")
  }
};

/** Dev: forward ReefPulse REST (`/api/v1`) to FastAPI when `VITE_API_BASE_URL` is empty. */
const reefpulseApiTarget =
  process.env.VITE_API_PROXY_TARGET?.trim() || "http://127.0.0.1:8000";

const reefpulseApiProxy = {
  "/api/v1": {
    target: reefpulseApiTarget,
    changeOrigin: true
  }
};

const devProxy = { ...caDataGovProxy, ...reefpulseApiProxy };

export default defineConfig(({ mode }) => {
  const googleMapsApiKey = readGoogleMapsApiKeyForInject(mode);

  return {
  root: "src",
  /** Load `.env` from `frontend/` (not `frontend/src/`) while `root` is `src`. */
  envDir: __dirname,
  /** Expose `GOOGLE_*` from `.env` as `import.meta.env.GOOGLE_*` (Maps key alias without `VITE_`). */
  envPrefix: ["VITE_", "GOOGLE_"],
  define: {
    __INJECTED_GOOGLE_MAPS_KEY__: JSON.stringify(googleMapsApiKey)
  },
  plugins: [react()],
  server: {
    // Avoid stale JS/CSS when iterating locally.
    headers: { "Cache-Control": "no-store" },
    proxy: devProxy
  },
  preview: {
    proxy: devProxy
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true
  }
  };
});
