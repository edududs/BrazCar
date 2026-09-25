// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { THEME_ATTRIBUTE, THEME_STORAGE_KEY } from "../adapters/theme";
import { ThemeControl } from "./theme-control";

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute(THEME_ATTRIBUTE);
});

describe("ThemeControl", () => {
  it("is a radio group with the three choices, on 'Sistema' by default", () => {
    render(<ThemeControl />);
    const group = screen.getByRole("radiogroup", { name: "Tema" });
    expect(group).toBeTruthy();
    expect(screen.getAllByRole("radio").map((radio) => radio.textContent)).toEqual([
      "Sistema",
      "Claro",
      "Escuro",
    ]);
    expect(screen.getByRole("radio", { name: "Sistema" }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("paints and remembers the theme the person taps", () => {
    render(<ThemeControl />);
    fireEvent.click(screen.getByRole("radio", { name: "Escuro" }));
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getByRole("radio", { name: "Escuro" }).getAttribute("aria-checked")).toBe("true");
  });
});
