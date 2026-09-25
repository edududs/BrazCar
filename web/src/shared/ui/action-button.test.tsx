// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import type { SyntheticEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import { ActionButton } from "./action-button";

describe("ActionButton", () => {
  it("is a real button that fires on press, in every emphasis", () => {
    const onPress = vi.fn();
    render(
      <>
        <ActionButton emphasis="primary" onPress={onPress}>
          Pedir contato
        </ActionButton>
        <ActionButton emphasis="critical-solid" onPress={onPress}>
          Excluir
        </ActionButton>
        <ActionButton emphasis="outline" size="compact" onPress={onPress}>
          Contorno
        </ActionButton>
      </>,
    );
    for (const name of ["Pedir contato", "Excluir", "Contorno"]) {
      fireEvent.click(screen.getByRole("button", { name }));
    }
    expect(onPress).toHaveBeenCalledTimes(3);
  });

  it("submits the form it sits in", () => {
    const onSubmit = vi.fn((event: SyntheticEvent) => {
      event.preventDefault();
    });
    render(
      <form onSubmit={onSubmit}>
        <ActionButton submit>Publicar</ActionButton>
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("while busy keeps its label, says so, and takes no press", () => {
    const onPress = vi.fn();
    render(
      <ActionButton busy onPress={onPress}>
        Publicando…
      </ActionButton>,
    );
    const button = screen.getByRole("button", { name: "Publicando…" });
    expect(button).toHaveProperty("disabled", true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
