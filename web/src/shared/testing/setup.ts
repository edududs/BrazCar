// Unmount what a test rendered before the next one runs. Testing Library only does this by itself
// with vitest globals on, which this project keeps off.
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

/*
 * jsdom has no `matchMedia`. This one answers the dark-scheme query from a switch the tests flip,
 * and tells its listeners when it flips, which is what the theme adapter needs.
 */
type Listener = (event: MediaQueryListEvent) => void;

let systemDark = false;
const listeners = new Set<Listener>();

export function setSystemTheme(theme: "light" | "dark"): void {
  systemDark = theme === "dark";
  const event = {
    matches: systemDark,
    media: "(prefers-color-scheme: dark)",
  } as MediaQueryListEvent;
  for (const listener of listeners) listener(event);
}

if (typeof window !== "undefined") {
  window.matchMedia = (query: string): MediaQueryList => {
    const dark = query === "(prefers-color-scheme: dark)";
    return {
      media: query,
      get matches() {
        return dark && systemDark;
      },
      onchange: null,
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === "function") listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === "function") listeners.delete(listener);
      },
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    };
  };
}
