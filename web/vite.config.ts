import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const devApiOrigin = process.env.BRAZCAR_DEV_API_ORIGIN ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [
    // Must come before the React plugin so route files are transformed first.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    // In development the API is reached same-origin; production uses VITE_API_BASE_URL.
    proxy: { "/api": devApiOrigin },
  },
});
