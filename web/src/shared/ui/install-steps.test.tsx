// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InstallSteps } from "./install-steps";

describe("InstallSteps", () => {
  it("says what to tap, with an icon for each of the two steps", () => {
    const { container } = render(
      <p>
        <InstallSteps />
      </p>,
    );

    expect(container.textContent).toBe(
      "Toque em Compartilhar e depois em Adicionar à Tela de Início.",
    );
    expect(container.querySelectorAll("svg")).toHaveLength(2);
  });
});
