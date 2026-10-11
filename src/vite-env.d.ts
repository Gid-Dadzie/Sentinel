/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "api" runs the app against the Sentinel API (see .env.api); otherwise demo data. */
  readonly VITE_DATA_SOURCE?: 'api' | 'demo';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
