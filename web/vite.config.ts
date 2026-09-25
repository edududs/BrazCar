import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
// vitest/config re-exports Vite's defineConfig with the `test` key typed, so there is one config.
import { coverageConfigDefaults, defineConfig } from "vitest/config";

import packageJson from "./package.json" with { type: "json" };

const devApiOrigin = process.env.BRAZCAR_DEV_API_ORIGIN ?? "http://127.0.0.1:8000";

/** The light page background, `--bg` in styles.css: the manifest is static, so it holds one theme. */
const surface = "#F5F6F9";

export default defineConfig({
  define: {
    // The release script keeps package.json on the tag; the API compares it with its floor (D-105).
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  plugins: [
    // Must come before the React plugin so route files are transformed first.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      // A new build waits for the user to accept it (D-052); nothing takes over under an open form.
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "BrazCar",
        short_name: "BrazCar",
        description: "Caronas entre Brazlândia e Brasília.",
        lang: "pt-BR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: surface,
        theme_color: surface,
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Online-only (D-051): the shell is precached so the app opens and can say there is no
        // network; the API is never cached, so there is no runtimeCaching and no stale board.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    // In development the API is reached same-origin; production uses VITE_API_BASE_URL.
    proxy: { "/api": devApiOrigin },
  },
  test: {
    // Só os testes de unidade e de componente: `web/e2e/**` é do Playwright (D-134), que sobe
    // servidores de verdade e não roda aqui dentro.
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/shared/testing/setup.ts"],
    // Each file gets its own jsdom worker; by default one per core ran at once, which starved
    // memory on a 16-core laptop and made user-event tests time out. Four finish as fast.
    maxWorkers: 4,
    coverage: {
      provider: "v8",
      // The whole of src, like the backend measures the whole of src/brazcar (D-109). Today only
      // the headless hooks are tested, so the number is low on purpose: the target is parity with
      // the backend, reached by testing components and behaviour too. No third-party service reads
      // this (D-008): the summary goes to the log and the floor is right here.
      include: ["src/**"],
      exclude: [
        ...coverageConfigDefaults.exclude,
        "src/routeTree.gen.ts",
        "src/**/*.fixture.*",
        "src/shared/testing/**",
      ],
      reporter: ["text", "text-summary"],
      thresholds: { statements: 15, lines: 15 },
    },
  },
});
