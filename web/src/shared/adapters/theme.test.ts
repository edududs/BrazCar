// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  applyTheme,
  readThemePreference,
  themeColors,
  writeThemePreference,
} from "./theme";

const metas = () =>
  Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));

function mountMetas() {
  for (const theme of ["light", "dark"] as const) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.dataset.theme = theme;
    meta.content = themeColors[theme];
    document.head.append(meta);
  }
}

afterEach(() => {
  for (const meta of metas()) meta.remove();
  document.documentElement.removeAttribute(THEME_ATTRIBUTE);
  window.localStorage.clear();
});

describe("the inline script in index.html", () => {
  const html = readFileSync(path.resolve(import.meta.dirname, "../../../index.html"), "utf8");

  it("reads the same storage key as the adapter", () => {
    expect(html).toContain(`localStorage.getItem("${THEME_STORAGE_KEY}")`);
  });

  it("sets the same attribute as the adapter", () => {
    expect(html).toContain(`setAttribute("${THEME_ATTRIBUTE}", theme)`);
  });

  it("colours the browser bars with the page background of each theme", () => {
    expect(html).toMatch(new RegExp(`content="${themeColors.light}"\\s+data-theme="light"`));
    expect(html).toMatch(new RegExp(`content="${themeColors.dark}"\\s+data-theme="dark"`));
  });
});

describe("the theme preference", () => {
  it("is the system's when nothing was chosen or the stored value is nonsense", () => {
    expect(readThemePreference()).toBe("system");
    window.localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    expect(readThemePreference()).toBe("system");
  });

  it("round-trips a manual choice and forgets it on 'system'", () => {
    writeThemePreference("dark");
    expect(readThemePreference()).toBe("dark");
    writeThemePreference("system");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });
});

describe("applying a theme", () => {
  it("pins the attribute and both metas on a manual choice", () => {
    mountMetas();
    applyTheme("dark");
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe("dark");
    expect(metas().map((meta) => meta.content)).toEqual([themeColors.dark, themeColors.dark]);
  });

  it("hands back to the device on 'system': no attribute, each meta its own colour", () => {
    mountMetas();
    applyTheme("light");
    applyTheme("system");
    expect(document.documentElement.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
    expect(metas().map((meta) => meta.content)).toEqual([themeColors.light, themeColors.dark]);
  });
});
