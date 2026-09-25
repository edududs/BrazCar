import {
  type ResolvedTheme,
  type ThemePreference,
  isThemePreference,
  resolveTheme,
} from "../domain/theme";

/**
 * The only place that knows how a theme reaches the page: the `data-theme` attribute the
 * stylesheet switches on, the storage that remembers the choice, the media query that says what
 * the device prefers, and the `theme-color` metas that colour the browser's own bars.
 *
 * `index.html` carries a copy of the read-and-apply part as an inline script, so the first paint
 * is already in the chosen theme; a test keeps that copy on the same key and attribute.
 */
export const THEME_STORAGE_KEY = "brazcar:theme";
export const THEME_ATTRIBUTE = "data-theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** The page background per theme, the same values as `--bg` in styles.css. */
export const themeColors: Record<ResolvedTheme, string> = {
  light: "#F5F6F9",
  dark: "#0B0C12",
};

export function readThemePreference(): ThemePreference {
  try {
    const stored: unknown = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function writeThemePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Not remembered: the choice lasts this visit, which is still what the person asked for.
  }
}

export function readSystemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/** Calls back whenever the device switches theme, until the returned function is called. */
export function watchSystemTheme(onChange: (theme: ResolvedTheme) => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  const listener = (event: MediaQueryListEvent) => {
    onChange(event.matches ? "dark" : "light");
  };
  query.addEventListener("change", listener);
  return () => {
    query.removeEventListener("change", listener);
  };
}

/**
 * Paints the preference: a manual choice pins the attribute and both `theme-color` metas; back
 * on "system" the attribute goes away and each meta keeps its own `media`, so the browser picks.
 */
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === "system") root.removeAttribute(THEME_ATTRIBUTE);
  else root.setAttribute(THEME_ATTRIBUTE, preference);

  const resolved = resolveTheme(preference, readSystemTheme());
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const own: ResolvedTheme = meta.dataset.theme === "dark" ? "dark" : "light";
    meta.content = themeColors[preference === "system" ? own : resolved];
  }
}
