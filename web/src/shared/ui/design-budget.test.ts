import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const web = path.resolve(import.meta.dirname, "../../..");

/**
 * Two promises the design foundation makes, kept by test: the display font stays under its
 * weight budget, and no component reaches past the tokens for a colour.
 */
describe("the display font", () => {
  it("weighs at most 30 KiB, or the system face takes over (F6)", () => {
    const file = path.join(web, "public/fonts/bricolage-grotesque-700-latin.woff2");
    expect(statSync(file).size).toBeLessThanOrEqual(30 * 1024);
  });
});

describe("the tokens", () => {
  const sources = listSources(path.join(web, "src")).filter(
    (file) => /\.tsx?$/.test(file) && !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"),
  );

  it("are the only colours a component uses: no token of the old set, no palette class", () => {
    const forbidden =
      /\b(?:bg|text|border|ring|accent|from|to|via|fill|stroke|outline|decoration|shadow)-(?:content|neutral-soft|accent(?:-soft)?|(?:red|green|blue|gray|stone|zinc|amber|yellow|emerald|indigo|violet|slate|neutral|orange|white|black)(?:-\d{2,3})?)\b/;
    const offenders = sources.filter((file) => forbidden.test(readFileSync(file, "utf8")));
    expect(offenders.map((file) => path.relative(web, file))).toEqual([]);
  });

  it("carry text contrast themselves: no dimming opacity on text", () => {
    // A bare `opacity-70` dims text below the measured contrast. `opacity-0`/`-100` and variants
    // like `disabled:` or `data-starting-style:` are motion and state, not colour.
    const dimming = /(?<![:\w-])opacity-(?!0\b|100\b)\d+\b/;
    const offenders = sources.filter((file) => dimming.test(readFileSync(file, "utf8")));
    expect(offenders.map((file) => path.relative(web, file))).toEqual([]);
  });
});

function listSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listSources(full) : [full];
  });
}
