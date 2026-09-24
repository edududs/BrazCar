// @ts-check
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

const PHONE_CODEC = "src/shared/app/phone-codec.ts";
const PHONE_MESSAGE = `The phone library is confined to ${PHONE_CODEC} (D-136).`;

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
    // Route files export a `Route` object next to their component, by TanStack Router's design.
    files: ["src/routes/**"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    // Generated API types and the HTTP client stay inside adapters (D-055); the phone library
    // stays inside its codec (D-136).
    files: ["src/**"],
    ignores: ["src/**/adapters/**", PHONE_CODEC],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "openapi-fetch", message: "HTTP lives in adapters/." }],
          patterns: [
            { group: ["**/adapters/api/*"], message: "Generated API types live in adapters/." },
            { group: ["libphonenumber-js", "libphonenumber-js/*"], message: PHONE_MESSAGE },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/adapters/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["libphonenumber-js", "libphonenumber-js/*"], message: PHONE_MESSAGE },
          ],
        },
      ],
    },
  },
  prettier,
);
