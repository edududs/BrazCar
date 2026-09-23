import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
// vitest/config re-exports Vite's defineConfig with the `test` key typed, so there is one config.
import { defineConfig } from "vitest/config";

import packageJson from "./package.json" with { type: "json" };

const devApiOrigin = process.env.BRAZCAR_DEV_API_ORIGIN ?? "http://127.0.0.1:8000";

/** Placeholder colors until the design stage (D-103); the same as `--color-surface` in styles.css. */
const surface = "#fafaf9";

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
    coverage: {
      provider: "v8",
      // The gate measures where the logic lives: the headless layers (`domain` and `app`), which
      // is also where every unit test is. `ui` is drawing and `adapters` talk to the network,
      // browser or service worker; those are the heavy gate's job (build) and the planned E2E
      // (D-065). No third-party service reads this (D-008): the summary goes to the log.
      include: [
        "src/features/*/domain/**",
        "src/features/*/app/**",
        "src/shared/domain/**",
        "src/shared/app/**",
      ],
      reporter: ["text", "text-summary"],
      thresholds: { statements: 52, lines: 52 },
    },
  },
});
