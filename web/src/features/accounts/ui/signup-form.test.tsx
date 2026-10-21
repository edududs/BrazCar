// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { legalDocument } from "@/shared/app/legal-documents";

import { type Account, AccountRequestError, type OpenSignup } from "../domain/account";
import { type RegisterInput, SignupForm } from "./signup-form";

const ana: Account = {
  id: "a1",
  phone: "+5561999990001",
  phoneDisplay: "(61) 99999-0001",
  displayName: "Ana",
  email: "ana@example.com",
  emailConfirmed: true,
  requiredAction: null,
  cars: [],
  canDrive: false,
};

const signup: OpenSignup = {
  phoneMasked: "+5561*****0001",
  email: "ana@example.com",
  emailExpiresAt: "2026-09-01T12:00:00-03:00",
};

describe("SignupForm, as the invite's e-mail link opens it (D-167)", () => {
  it("shows the phone masked and the e-mail fixed, neither one typed", () => {
    render(<SignupForm signup={signup} signUp={vi.fn()} busy={false} onDone={vi.fn()} />);

    const phone = screen.getByLabelText<HTMLInputElement>("Celular");
    const email = screen.getByLabelText<HTMLInputElement>(/^E-mail/);
    expect(phone.value).toBe("+5561*****0001");
    expect(phone.readOnly).toBe(true);
    expect(email.value).toBe("ana@example.com");
    expect(email.readOnly).toBe(true);
  });

  it("types the name and the password, accepts the terms, and registers", async () => {
    const user = userEvent.setup();
    const signUp = vi.fn<(data: RegisterInput) => Promise<Account>>(() => Promise.resolve(ana));
    const onDone = vi.fn();
    render(<SignupForm signup={signup} signUp={signUp} busy={false} onDone={onDone} />);

    await user.click(screen.getByLabelText(/^Nome/));
    await user.keyboard("Ana Souza");
    await user.click(screen.getByLabelText(/^Senha/));
    await user.keyboard("uma-senha-boa");
    await user.click(screen.getByLabelText(/Li e aceito os termos/));
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledWith(ana);
    });
    expect(signUp).toHaveBeenCalledWith({
      displayName: "Ana Souza",
      password: "uma-senha-boa",
      acceptsTerms: true,
    });
  });

  it("stays disabled until the terms are accepted", async () => {
    const user = userEvent.setup();
    const signUp = vi.fn();
    render(<SignupForm signup={signup} signUp={signUp} busy={false} onDone={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Criar conta" })).toHaveProperty("disabled", true);

    await user.click(screen.getByLabelText(/Li e aceito os termos/));

    expect(screen.getByRole("button", { name: "Criar conta" })).toHaveProperty("disabled", false);
  });

  it("shows why the API refused, like a weak password", async () => {
    const user = userEvent.setup();
    const signUp = vi.fn(() =>
      Promise.reject(new AccountRequestError(422, "a senha precisa de pelo menos 8 caracteres")),
    );
    render(<SignupForm signup={signup} signUp={signUp} busy={false} onDone={vi.fn()} />);

    await user.click(screen.getByLabelText(/^Nome/));
    await user.keyboard("Ana Souza");
    await user.click(screen.getByLabelText(/^Senha/));
    await user.keyboard("123");
    await user.click(screen.getByLabelText(/Li e aceito os termos/));
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "a senha precisa de pelo menos 8 caracteres",
    );
  });

  it.each([
    ["terms", "termos de uso", "Termos de uso"],
    ["privacy", "política de privacidade", "Política de privacidade"],
  ] as const)("opens the %s in a sheet, without checking the box", async (kind, button, title) => {
    const user = userEvent.setup();
    render(<SignupForm signup={signup} signUp={vi.fn()} busy={false} onDone={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: button }));

    const sheet = screen.getByRole("dialog", { name: title });
    const first = legalDocument(kind).sections[0]?.heading ?? "";
    expect(within(sheet).getByRole("heading", { name: first, level: 3 })).toBeDefined();
    // The page behind an open sheet is hidden from the accessibility tree.
    expect(screen.getByRole<HTMLInputElement>("checkbox", { hidden: true }).checked).toBe(false);
  });

  it("accepts from the sheet: it closes, the box is checked and the button is enabled", async () => {
    const user = userEvent.setup();
    render(<SignupForm signup={signup} signUp={vi.fn()} busy={false} onDone={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "termos de uso" }));
    await user.click(screen.getByRole("button", { name: "Li e aceito" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(screen.getByRole<HTMLInputElement>("checkbox").checked).toBe(true);
    expect(screen.getByRole("button", { name: "Criar conta" })).toHaveProperty("disabled", false);
  });

  it("closing the sheet with the X leaves the box unchecked and the account blocked", async () => {
    const user = userEvent.setup();
    render(<SignupForm signup={signup} signUp={vi.fn()} busy={false} onDone={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "política de privacidade" }));
    await user.click(screen.getByRole("button", { name: "Fechar" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(screen.getByRole<HTMLInputElement>("checkbox").checked).toBe(false);
    expect(screen.getByRole("button", { name: "Criar conta" })).toHaveProperty("disabled", true);
  });

  it("opens a text by keyboard, and Escape closes it without accepting", async () => {
    const user = userEvent.setup();
    render(<SignupForm signup={signup} signUp={vi.fn()} busy={false} onDone={vi.fn()} />);
    const termsButton = screen.getByRole("button", { name: "termos de uso" });

    // Name, password, the box, then the first button inside the sentence.
    for (let presses = 0; presses < 12 && document.activeElement !== termsButton; presses += 1) {
      await user.tab();
    }
    expect(document.activeElement).toBe(termsButton);

    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: "Termos de uso" })).toBeDefined();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(screen.getByRole<HTMLInputElement>("checkbox").checked).toBe(false);
  });
});
