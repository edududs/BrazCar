/** What the person asked for: follow the device, or one theme whatever the device says. */
export type ThemePreference = "system" | "light" | "dark";

/** What is actually painted. */
export type ResolvedTheme = "light" | "dark";

export const themePreferences: readonly ThemePreference[] = ["system", "light", "dark"];

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function resolveTheme(preference: ThemePreference, system: ResolvedTheme): ResolvedTheme {
  return preference === "system" ? system : preference;
}
