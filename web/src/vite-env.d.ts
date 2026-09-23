/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Origin of the API in production. Empty in development, where Vite proxies `/api`. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** The front's version, from package.json at build time (D-105). */
declare const __APP_VERSION__: string;
