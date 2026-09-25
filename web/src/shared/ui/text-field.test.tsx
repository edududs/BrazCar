// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CheckboxField } from "./checkbox-field";
import { TextField } from "./text-field";

describe("TextField", () => {
  it("is labelled, shows its prefix and suffix, and reports typing", () => {
    const onChange = vi.fn();
    render(
      <TextField label="Preço" value="" onChange={onChange} prefix="R$" suffix="por pessoa" />,
    );
    const field = screen.getByLabelText(/Preço/);
    fireEvent.change(field, { target: { value: "7" } });
    expect(onChange).toHaveBeenCalledWith("7");
    expect(screen.getByText("R$")).toBeTruthy();
    expect(screen.getByText("por pessoa")).toBeTruthy();
  });

  it("marks a refused value and announces why", () => {
    render(
      <TextField
        label="Celular"
        value="(61) 3344-5566"
        onChange={() => undefined}
        error="Precisa ser celular."
      />,
    );
    expect(screen.getByLabelText(/Celular/).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toContain("Precisa ser celular.");
  });

  it("shows the hint under the box", () => {
    render(
      <TextField
        label="E-mail"
        value=""
        onChange={() => undefined}
        hint="Só para recuperar a senha."
      />,
    );
    expect(screen.getByText("Só para recuperar a senha.")).toBeTruthy();
  });
});

describe("CheckboxField", () => {
  it("toggles from a click on its text, the whole line being the target", () => {
    const onChange = vi.fn();
    render(
      <CheckboxField checked={false} onChange={onChange}>
        Só com vaga
      </CheckboxField>,
    );
    fireEvent.click(screen.getByText("Só com vaga"));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("checkbox", { name: "Só com vaga" })).toBeTruthy();
  });
});
