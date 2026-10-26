// @ts-check
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

import { layerBlocks } from "./eslint/layers.js";

export default defineConfig(
  // e2e/.state holds the Playwright run: database, results and traces. An interrupted run leaves
  // JavaScript there that ESLint would otherwise try to parse.
  {
    ignores: [
      "dist",
      ".yarn",
      "e2e/.state",
      "src/routeTree.gen.ts",
      "src/shared/adapters/api/schema.d.ts",
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  reactHooks.configs.flat.recommended,
  reactRefresh.configs.vite,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    // The end to end suite runs in Node, not in the browser: it reads files and the environment.
    // Playwright's fixtures take a callback named `use`, which is not a React hook.
    files: ["e2e/**", "playwright.config.ts"],
    languageOptions: { globals: globals.node },
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  {
    // Plain scripts that run inside the service worker: they are not in the tsconfig, so the
    // type-aware rules have nothing to read, and the globals are the worker's, not the page's.
    files: ["public/**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.serviceworker, sourceType: "script" },
  },
  {
    // Route files export a `Route` object next to their component, by TanStack Router's design.
    files: ["src/routes/**"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  // Import boundaries: layers inside a feature, public surfaces between them (D-191).
  ...layerBlocks,
  prettier,
);
