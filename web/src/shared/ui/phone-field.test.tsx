// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { PHONE_HINT_ERROR, usePhoneInput } from "@/shared/app/use-phone-input";

import { PhoneField } from "./phone-field";

/** The field with its hook, and a button that asks for the value the way a form does on submit. */
function Harness() {
  const phone = usePhoneInput();
  const [sent, setSent] = useState<string | null>(null);
  return (
    <>
      <PhoneField {...phone.field} />
      <button
        type="button"
        onClick={() => {
          setSent(phone.submitValue() ?? "nada");
        }}
      >
        Enviar
      </button>
      <output>{sent}</output>
    </>
  );
}

function typeInto(field: HTMLElement, value: string): void {
  fireEvent.change(field, { target: { value } });
}

describe("PhoneField", () => {
  it("formats the number as the person types it, however it comes", () => {
    render(<Harness />);
    const field = screen.getByLabelText("Telefone");

    typeInto(field, "61999990001");
    expect(field).toHaveProperty("value", "(61) 99999-0001");

    typeInto(field, "+55 61 9 9999 0001");
    expect(field).toHaveProperty("value", "+55 61 99999 0001");
  });

  it("hands out E.164 for a whole number and nothing else", () => {
    render(<Harness />);
    typeInto(screen.getByLabelText("Telefone"), "(61) 9 9999-0001");

    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(screen.getByRole("status").textContent).toBe("+5561999990001");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says what is missing when the number is not whole, and forgets it once they type again", () => {
    render(<Harness />);
    const field = screen.getByLabelText("Telefone");
    typeInto(field, "61 9");

    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(screen.getByRole("alert").textContent).toBe(PHONE_HINT_ERROR);
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("nada");

    typeInto(field, "61 99");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("lets a deletion through without putting the dash back", () => {
    render(<Harness />);
    const field = screen.getByLabelText("Telefone");
    typeInto(field, "61999990001");

    typeInto(field, "(61) 99999-000");
    expect(field).toHaveProperty("value", "(61) 99999-000");
  });
});
