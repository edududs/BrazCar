// @ts-check
/**
 * Import boundaries of the front, in one place (D-191). ESLint keeps only the last
 * `no-restricted-imports` block that matches a file, so every block below states the whole rule
 * for the files it covers: this module composes them from the same pieces and is the single
 * source, read by `eslint.config.js` and by `src/architecture/layers.test.ts`.
 *
 * Layers inside a feature: `domain` <- `app` <- `ui`; `adapters` is reached only from `app`.
 * Between features: only the public surface (`@/features/<name>`), never a layer behind it.
 * `src/routes/` is the composition root and is left out of the cross-feature rule, as `config/`
 * is in the backend. `src/shared/` never imports a feature.
 */

export const PHONE_CODEC = "src/shared/app/phone-codec.ts";

const PHONE_MESSAGE = `The phone library is confined to ${PHONE_CODEC} (D-136).`;
const SURFACE_MESSAGE =
  "Another feature is reached only through its public surface, @/features/<name> (D-191).";

/** @typedef {{ group: string[], message: string }} Pattern */

/** @type {Pattern} */
const GENERATED_TYPES = {
  group: ["**/adapters/api/*"],
  message: "Generated API types live in adapters/.",
};
/** @type {Pattern} */
const PHONE_LIBRARY = {
  group: ["libphonenumber-js", "libphonenumber-js/*"],
  message: PHONE_MESSAGE,
};
/** @type {Pattern} */
const CROSS_FEATURE = { group: ["@/features/*/**", "../../*/**"], message: SURFACE_MESSAGE };
/** @type {Pattern} */
const FEATURES_FROM_SHARED = {
  group: ["@/features", "@/features/**", "**/features/**"],
  message: "shared/ is below the features and never imports one (D-191).",
};
/** @type {Pattern} */
const NO_ADAPTERS = {
  group: ["**/adapters/**"],
  message: "Adapters are used by app/ only; the layer above reaches them through a hook (D-191).",
};
/** @type {Pattern} */
const NO_UI = { group: ["**/ui/**"], message: "A layer below ui/ never imports ui/ (D-191)." };
/** @type {Pattern} */
const NO_APP = { group: ["**/app/**"], message: "domain/ is pure and never imports app/ (D-191)." };

/**
 * @param {{ http?: boolean, phone?: boolean, extra?: Pattern[] }} options
 * @returns {import("eslint").Linter.RulesRecord}
 */
function restrictions({ http = false, phone = false, extra = [] }) {
  /** @type {Pattern[]} */
  const patterns = [
    ...(http ? [GENERATED_TYPES] : []),
    ...(phone ? [PHONE_LIBRARY] : []),
    ...extra,
  ];
  return {
    "no-restricted-imports": [
      "error",
      {
        paths: http ? [{ name: "openapi-fetch", message: "HTTP lives in adapters/." }] : [],
        patterns,
      },
    ],
  };
}

const TESTS = ["**/*.test.{ts,tsx}"];
// A test mocks the adapter it stands in for, and so reaches across layers on purpose.
const IN_FEATURE = (/** @type {string} */ layer) => `src/features/*/${layer}/**`;

/** @type {import("eslint").Linter.Config[]} */
export const layerBlocks = [
  {
    // Generated API types and the HTTP client stay inside adapters (D-055); the phone library
    // stays inside its codec (D-136).
    files: ["src/**"],
    ignores: ["src/**/adapters/**", PHONE_CODEC],
    rules: restrictions({ http: true, phone: true }),
  },
  {
    files: ["src/**/adapters/**"],
    rules: restrictions({ phone: true }),
  },
  {
    files: [IN_FEATURE("domain")],
    ignores: TESTS,
    rules: restrictions({
      http: true,
      phone: true,
      extra: [CROSS_FEATURE, NO_APP, NO_UI, NO_ADAPTERS],
    }),
  },
  {
    files: [IN_FEATURE("app")],
    ignores: TESTS,
    rules: restrictions({ http: true, phone: true, extra: [CROSS_FEATURE, NO_UI] }),
  },
  {
    files: [IN_FEATURE("ui")],
    ignores: TESTS,
    rules: restrictions({ http: true, phone: true, extra: [CROSS_FEATURE, NO_ADAPTERS] }),
  },
  {
    files: [IN_FEATURE("adapters")],
    ignores: TESTS,
    rules: restrictions({ phone: true, extra: [CROSS_FEATURE] }),
  },
  {
    files: ["src/shared/**"],
    ignores: ["src/shared/adapters/**", PHONE_CODEC, ...TESTS],
    rules: restrictions({ http: true, phone: true, extra: [FEATURES_FROM_SHARED] }),
  },
  {
    files: ["src/shared/adapters/**"],
    ignores: TESTS,
    rules: restrictions({ phone: true, extra: [FEATURES_FROM_SHARED] }),
  },
  {
    files: [PHONE_CODEC],
    rules: restrictions({ extra: [FEATURES_FROM_SHARED] }),
  },
];
