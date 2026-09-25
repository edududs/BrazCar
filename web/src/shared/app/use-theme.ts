import { useEffect, useState } from "react";

import {
  applyTheme,
  readSystemTheme,
  readThemePreference,
  watchSystemTheme,
  writeThemePreference,
} from "../adapters/theme";
import { type ResolvedTheme, type ThemePreference, resolveTheme } from "../domain/theme";

export interface Theme {
  readonly preference: ThemePreference;
  readonly resolved: ResolvedTheme;
  readonly set: (preference: ThemePreference) => void;
}

/**
 * The theme as the person chose it. The first paint was already right, by the inline script in
 * `index.html`; this hook takes over from there: it remembers a new choice, repaints, and follows
 * the device while the choice is "system".
 */
export function useTheme(): Theme {
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference);
  const [system, setSystem] = useState<ResolvedTheme>(readSystemTheme);

  useEffect(() => watchSystemTheme(setSystem), []);
  useEffect(() => {
    applyTheme(preference);
  }, [preference, system]);

  return {
    preference,
    resolved: resolveTheme(preference, system),
    set: (next) => {
      writeThemePreference(next);
      setPreference(next);
    },
  };
}
