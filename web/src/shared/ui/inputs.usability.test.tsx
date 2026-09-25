// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { usePhoneInput } from "../app/use-phone-input";
import { CheckboxField } from "./checkbox-field";
import { PasswordField } from "./password-field";
import { PhoneField } from "./phone-field";
import { SearchField } from "./search-field";
import { SelectField } from "./select-field";
import { TextAreaField } from "./textarea-field";
import { TextField } from "./text-field";

/**
 * Usability of the text inputs, as a person uses them: tapping the label, typing key by key,
 * deleting, moving with Tab. Every field is controlled, so each harness holds its own state,
 * the same way a form does.
 */

function Controlled({ initial = "", prefix }: { initial?: string; prefix?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <TextField label="Preço" value={value} onChange={setValue} {...(prefix ? { prefix } : {})} />
  );
}

describe("TextField", () => {
  it("is reached by tapping its label and takes what is typed, key by key", async () => {
    const user = userEvent.setup();
    render(<Controlled prefix="R$" />);
    await user.click(screen.getByText("Preço"));
    expect(document.activeElement).toBe(screen.getByLabelText("Preço"));
    await user.keyboard("7,50");
    expect(screen.getByLabelText("Preço")).toHaveProperty("value", "7,50");
  });

  it("lets a typo be fixed with Backspace, and the prefix is never part of the value", async () => {
    const user = userEvent.setup();
    render(<Controlled initial="8" prefix="R$" />);
    await user.click(screen.getByLabelText("Preço"));
    await user.keyboard("{Backspace}7");
    expect(screen.getByLabelText("Preço")).toHaveProperty("value", "7");
  });
});

describe("PasswordField", () => {
  function Harness() {
    const [value, setValue] = useState("");
    return <PasswordField value={value} onChange={setValue} autoComplete="new-password" />;
  }

  it("hides what is typed until asked, and showing it keeps the text and the focus flow", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = screen.getByLabelText("Senha");
    await user.click(field);
    await user.keyboard("segredo1");
    expect(field.getAttribute("type")).toBe("password");

    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(field.getAttribute("type")).toBe("text");
    expect(field).toHaveProperty("value", "segredo1");
    expect(screen.getByRole("button", { name: "Ocultar senha" }).getAttribute("aria-pressed")).toBe(
      "true",
    );

    await user.click(field);
    await user.keyboard("2");
    expect(field).toHaveProperty("value", "segredo12");
  });
});

describe("PhoneField", () => {
  function Harness() {
    const phone = usePhoneInput();
    return <PhoneField {...phone.field} label="Celular" />;
  }

  it("formats as the digits are typed one by one, and deleting never fights the caret", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = screen.getByLabelText<HTMLInputElement>("Celular");
    await user.click(field);
    await user.keyboard("61999990001");
    expect(field.value).toBe("(61) 99999-0001");

    // Four deletions take the last four digits; the dash stays until it is deleted itself.
    await user.keyboard("{Backspace}{Backspace}{Backspace}{Backspace}");
    expect(field.value.replace(/\D/g, "")).toBe("6199999");
    await user.keyboard("1234");
    expect(field.value).toBe("(61) 99999-1234");
  });
});

describe("SearchField", () => {
  function Harness() {
    const [value, setValue] = useState("");
    return <SearchField label="Passa por" value={value} onChange={setValue} />;
  }

  it("types, offers a clear button only when there is text, and keeps the keyboard up after clearing", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole("button", { name: "Limpar busca" })).toBeNull();

    await user.click(screen.getByLabelText("Passa por"));
    await user.keyboard("SCS");
    await user.click(screen.getByRole("button", { name: "Limpar busca" }));

    expect(screen.getByLabelText("Passa por")).toHaveProperty("value", "");
    expect(document.activeElement).toBe(screen.getByLabelText("Passa por"));
    await user.keyboard("Plano");
    expect(screen.getByLabelText("Passa por")).toHaveProperty("value", "Plano");
  });
});

describe("TextAreaField", () => {
  function Harness() {
    const [value, setValue] = useState("");
    return (
      <TextAreaField
        label="Observações"
        value={value}
        onChange={setValue}
        maxLength={10}
        optional
      />
    );
  }

  it("counts while typing, takes line breaks, and stops at the limit", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByLabelText("Observações"));
    await user.keyboard("Levo{Enter}mala");
    expect(screen.getByText("9/10")).toBeDefined();
    await user.keyboard(" pequena");
    expect(screen.getByLabelText<HTMLTextAreaElement>("Observações").value).toHaveLength(10);
    expect(screen.getByText("opcional")).toBeDefined();
  });
});

describe("SelectField", () => {
  function Harness() {
    const [value, setValue] = useState("");
    return (
      <SelectField
        label="Carro"
        value={value}
        onChange={setValue}
        placeholder="Escolha o carro"
        options={[
          { value: "c1", label: "Gol prata" },
          { value: "c2", label: "Onix branco" },
        ]}
      />
    );
  }

  it("is the native picker: chosen by its label, keeps the choice", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.selectOptions(screen.getByLabelText("Carro"), "Onix branco");
    expect(screen.getByLabelText("Carro")).toHaveProperty("value", "c2");
  });
});

describe("CheckboxField", () => {
  function Harness() {
    const [checked, setChecked] = useState(false);
    return (
      <CheckboxField checked={checked} onChange={setChecked}>
        Li e aceito os termos
      </CheckboxField>
    );
  }

  it("toggles from its text and from the space bar", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const box = screen.getByRole("checkbox", { name: "Li e aceito os termos" });
    await user.click(screen.getByText("Li e aceito os termos"));
    expect(box).toHaveProperty("checked", true);
    await user.keyboard(" ");
    expect(box).toHaveProperty("checked", false);
  });
});

describe("the fields together", () => {
  it("are walked in reading order with Tab", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Controlled />
        <PasswordFieldAlone />
      </>,
    );
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Preço"));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Senha"));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Mostrar senha" }));
  });
});

function PasswordFieldAlone() {
  const [value, setValue] = useState("");
  return <PasswordField value={value} onChange={setValue} autoComplete="current-password" />;
}
