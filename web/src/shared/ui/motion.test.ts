import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The motion catalogue (F5) as a test: the tokens hold the durations and curves the boards set,
 * nothing animates but transform and opacity, everything scroll-driven is fenced by support and
 * by "reduce motion", and no component reaches past the tokens for a duration.
 */
const web = path.resolve(import.meta.dirname, "../../..");
const css = readFileSync(path.join(web, "src/styles.css"), "utf8");

describe("the motion tokens", () => {
  it("are the catalogue's durations and curves", () => {
    expect(css).toContain("--duration-press: 120ms;");
    expect(css).toContain("--duration-state: 200ms;");
    expect(css).toContain("--duration-enter: 280ms;");
    expect(css).toContain("--duration-exit: 180ms;");
    expect(css).toContain("--ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);");
    expect(css).toContain("--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);");
    expect(css).toMatch(/--ease-spring: linear\(/);
  });

  it("stop with 'reduce motion': presses and state changes become instant, moves become fades", () => {
    const reduced = blockOf(css, "@media (prefers-reduced-motion: reduce)");
    expect(reduced).toContain("--duration-press: 0ms;");
    expect(reduced).toContain("--duration-state: 0ms;");
    expect(reduced).toContain("--motion-rise: 0px;");
    expect(reduced).toContain("--motion-scale: 1;");
    expect(reduced).toMatch(/::view-transition-group\(\*\)[^}]*animation: none/);
  });
});

describe("what moves", () => {
  it("is only transform and opacity, in every keyframe", () => {
    const properties = [...css.matchAll(/@keyframes [\w-]+\s*\{([\s\S]*?)\n\}/g)]
      .flatMap((match) => [...(match[1] ?? "").matchAll(/^\s*([a-z-]+):/gm)])
      .map((match) => match[1]);
    expect(properties.length).toBeGreaterThan(0);
    expect(new Set(properties)).toEqual(new Set(["transform", "opacity"]));
  });

  it("is driven by the scroll only where the browser supports it and the person allows it", () => {
    const fences = blocksOf(css, "@supports (animation-timeline: scroll())");
    expect(fences.length).toBeGreaterThan(0);
    const allowed = fences
      .flatMap((fence) => blocksOf(fence, "@media (prefers-reduced-motion: no-preference)"))
      .join("\n");
    for (const selector of [".shell-title", ".ride-sky", ".ride-time"]) {
      expect(allowed).toContain(selector);
    }
    // Every scroll timeline lives inside a support fence.
    const outside = fences.reduce((rest, fence) => rest.replace(fence, ""), css);
    expect(outside).not.toContain("animation-timeline");
  });
});

describe("the components", () => {
  it("take durations from the tokens, never a number of their own", () => {
    const offenders = listSources(path.join(web, "src")).filter((file) => {
      if (!file.endsWith(".tsx") || file.endsWith(".test.tsx")) return false;
      // `duration-0` is "no motion" (a sheet under the finger), not a duration of its own.
      return /\b(?:duration|delay)-(?:[1-9]\d*|\[)/.test(readFileSync(file, "utf8"));
    });
    expect(offenders.map((file) => path.relative(web, file))).toEqual([]);
  });
});

/** The first block of an at-rule, from its name to its matching close. */
function blockOf(source: string, atRule: string): string {
  const [first] = blocksOf(source, atRule);
  expect(first, atRule).toBeDefined();
  return first ?? "";
}

/** Every block of an at-rule, from its name to its matching close. */
function blocksOf(source: string, atRule: string): string[] {
  const blocks: string[] = [];
  let start = source.indexOf(atRule);
  while (start !== -1) {
    let depth = 0;
    let end = -1;
    for (let at = source.indexOf("{", start); at < source.length; at += 1) {
      if (source[at] === "{") depth += 1;
      if (source[at] === "}") {
        depth -= 1;
        if (depth === 0) {
          end = at + 1;
          break;
        }
      }
    }
    if (end === -1) throw new Error(`unclosed ${atRule}`);
    blocks.push(source.slice(start, end));
    start = source.indexOf(atRule, end);
  }
  return blocks;
}

function listSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listSources(full) : [full];
  });
}
