// @ts-check
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig(
  { ignores: ["dist", ".yarn", "src/routeTree.gen.ts", "src/shared/adapters/api/schema.d.ts"] },
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
    // Route files export a `Route` object next to their component, by TanStack Router's design.
    files: ["src/routes/**"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    // Generated API types and the HTTP client stay inside adapters (D-055).
    files: ["src/**"],
    ignores: ["src/**/adapters/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "openapi-fetch", message: "HTTP lives in adapters/." }],
          patterns: [
            { group: ["**/adapters/api/*"], message: "Generated API types live in adapters/." },
          ],
        },
      ],
    },
  },
  prettier,
);
