import { Linter } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";

import { layerBlocks } from "../../eslint/layers.js";

/**
 * Proves the import boundaries of the front (D-191), the way the backend's
 * `test_guard_detects_deliberate_violations` proves its own: the rule runs over made-up files and
 * snippets, so no violation has to live in `src/`.
 */
const linter = new Linter({ configType: "flat" });
const config: Linter.Config[] = [
  { files: ["**/*.{ts,tsx}"], languageOptions: { parser: tseslint.parser } },
  ...layerBlocks,
];

function violations(filename: string, source: string): string[] {
  return linter.verify(source, config, { filename }).map((message) => message.message);
}

const VIOLATIONS: readonly (readonly [string, string, string, RegExp])[] = [
  [
    "ui reaches the adapter of its own feature",
    "src/features/accounts/ui/some-form.tsx",
    'import { logIn } from "../adapters/accounts-gateway";',
    /used by app\/ only/,
  ],
  [
    "ui reaches the adapter of another feature",
    "src/features/rides/ui/some-card.tsx",
    'import { searchPlaces } from "@/features/places";\nimport { x } from "@/features/places/adapters/places-gateway";',
    /public surface/,
  ],
  [
    "app imports ui",
    "src/features/rides/app/use-thing.ts",
    'import { RideCard } from "../ui/ride-card";',
    /never imports ui/,
  ],
  [
    "domain imports app",
    "src/features/rides/domain/ride.ts",
    'import { useRide } from "../app/use-ride";',
    /never imports app/,
  ],
  [
    "domain imports ui",
    "src/features/rides/domain/ride.ts",
    'import { RideCard } from "../ui/ride-card";',
    /never imports ui/,
  ],
  [
    "domain imports an adapter",
    "src/features/rides/domain/ride.ts",
    'import { fetchRide } from "../adapters/rides-gateway";',
    /used by app\/ only/,
  ],
  [
    "app reaches the adapter of another feature",
    "src/features/rides/app/use-board-match.ts",
    'import { searchPlaces } from "@/features/places/adapters/places-gateway";',
    /public surface/,
  ],
  [
    "ui reaches into another feature's layer",
    "src/features/alerts/ui/alert-sheet.tsx",
    'import { useSession } from "@/features/accounts/app/use-session";',
    /public surface/,
  ],
  [
    "adapter reaches into another feature's layer",
    "src/features/rides/adapters/rides-gateway.ts",
    'import type { Place } from "@/features/places/domain/place";',
    /public surface/,
  ],
  [
    "shared imports a feature",
    "src/shared/ui/some-primitive.tsx",
    'import { useSession } from "@/features/accounts";',
    /never imports one/,
  ],
  [
    "the HTTP client leaves the adapters",
    "src/features/rides/app/use-thing.ts",
    'import createClient from "openapi-fetch";',
    /HTTP lives in adapters/,
  ],
  [
    "generated types leave the adapters",
    "src/features/rides/ui/some-card.tsx",
    'import type { components } from "@/shared/adapters/api/schema";',
    /Generated API types/,
  ],
  [
    "the phone library leaves its codec",
    "src/features/accounts/ui/some-form.tsx",
    'import { parsePhoneNumber } from "libphonenumber-js";',
    /confined to/,
  ],
  [
    "the phone library leaves its codec, from an adapter",
    "src/features/accounts/adapters/accounts-gateway.ts",
    'import { parsePhoneNumber } from "libphonenumber-js/min";',
    /confined to/,
  ],
];

const ALLOWED: readonly (readonly [string, string, string])[] = [
  [
    "ui uses the app of its own feature",
    "src/features/accounts/ui/some-form.tsx",
    'import { useChangePassword } from "../app/use-change-password";',
  ],
  [
    "app uses the adapter and the domain of its own feature",
    "src/features/accounts/app/use-thing.ts",
    'import { logIn } from "../adapters/accounts-gateway";\nimport type { Account } from "../domain/account";',
  ],
  [
    "a feature uses another through its public surface",
    "src/features/rides/ui/ride-detail.tsx",
    'import { HeldNotice, useSession } from "@/features/accounts";',
  ],
  [
    "a feature uses shared",
    "src/features/rides/ui/ride-detail.tsx",
    'import { Card } from "@/shared/ui/card";\nimport { usePhoneInput } from "@/shared/app/use-phone-input";',
  ],
  [
    "a route composes features through any layer",
    "src/routes/conta.tsx",
    'import { AccountPanel } from "@/features/accounts/ui/account-panel";\nimport { useSession } from "@/features/accounts/app/use-session";',
  ],
  [
    "a test mocks the adapter it stands in for",
    "src/features/rides/app/use-board-match.test.tsx",
    'import { searchPlaces } from "@/features/places/adapters/places-gateway";',
  ],
  [
    "an adapter uses the HTTP client and generated types",
    "src/features/rides/adapters/rides-gateway.ts",
    'import { apiClient } from "@/shared/adapters/api/client";\nimport type { components } from "@/shared/adapters/api/schema";',
  ],
  [
    "the codec uses the phone library",
    "src/shared/app/phone-codec.ts",
    'import { parsePhoneNumber } from "libphonenumber-js";',
  ],
];

describe("front import boundaries", () => {
  it.each(VIOLATIONS)("flags: %s", (_name, filename, source, expected) => {
    const found = violations(filename, source);
    expect(found.length).toBeGreaterThan(0);
    expect(found.some((message) => expected.test(message))).toBe(true);
  });

  it.each(ALLOWED)("lets through: %s", (_name, filename, source) => {
    expect(violations(filename, source)).toEqual([]);
  });
});
