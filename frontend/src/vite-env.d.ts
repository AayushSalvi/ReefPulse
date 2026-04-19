/// <reference types="vite/client" />

declare const __INJECTED_GOOGLE_MAPS_KEY__: string;

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_CA_GOV_ACTION_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
