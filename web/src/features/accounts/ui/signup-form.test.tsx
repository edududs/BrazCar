// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
});
