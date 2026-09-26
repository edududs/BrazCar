// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PHONE_HINT_ERROR } from "@/shared/app/use-phone-input";
import { renderRouted } from "@/shared/testing/render-routed";

import { confirmPasswordReset, requestPasswordReset } from "../adapters/accounts-gateway";
import { type Account, AccountRequestError, type LoginData } from "../domain/account";
import { LoginForm } from "./login-form";
import { PasswordResetForm } from "./password-reset-form";
import { PasswordResetRequestForm } from "./password-reset-request-form";

vi.mock("../adapters/accounts-gateway");

const ana: Account = {
  id: "a1",
  phone: "+5561999990001",
  phoneDisplay: "(61) 99999-0001",
  displayName: "Ana",
  email: null,
  emailConfirmed: true,
  requiredAction: null,
  cars: [],
  canDrive: false,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("LoginForm, as a person signs in", () => {
  it("types the phone and the password, presses Enter, and is let in with the E.164 number", async () => {
    const user = userEvent.setup();
    const logIn = vi.fn<(data: LoginData) => Promise<Account>>(() => Promise.resolve(ana));
    const onDone = vi.fn();
    renderRouted(<LoginForm logIn={logIn} busy={false} onDone={onDone} />);

    await user.click(await screen.findByLabelText(/^Celular/));
    await user.keyboard("61999990001");
    expect(screen.getByLabelText<HTMLInputElement>(/^Celular/).value).toBe("(61) 99999-0001");
    await user.click(screen.getByLabelText(/^Senha/));
    await user.keyboard("segredo123{Enter}");

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledWith(ana);
    });
    expect(logIn).toHaveBeenCalledWith({ phone: "+5561999990001", password: "segredo123" });
  });

  it("a half-typed phone is stopped next to the field, and nothing is sent", async () => {
    const user = userEvent.setup();
    const logIn = vi.fn(() => Promise.resolve(ana));
    renderRouted(<LoginForm logIn={logIn} busy={false} onDone={vi.fn()} />);

    await user.type(await screen.findByLabelText(/^Celular/), "619");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(screen.getByText(PHONE_HINT_ERROR)).toBeDefined();
    expect(logIn).not.toHaveBeenCalled();
  });

  it("a wrong password shows the API's words, and typing again tries again", async () => {
    const user = userEvent.setup();
    const logIn = vi
      .fn<(data: LoginData) => Promise<Account>>()
      .mockRejectedValueOnce(new AccountRequestError(401, "Celular ou senha não conferem."))
      .mockResolvedValueOnce(ana);
    const onDone = vi.fn();
    renderRouted(<LoginForm logIn={logIn} busy={false} onDone={onDone} />);

    await user.type(await screen.findByLabelText(/^Celular/), "61999990001");
    await user.type(screen.getByLabelText(/^Senha/), "errada");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Celular ou senha não conferem.");

    await user.clear(screen.getByLabelText(/^Senha/));
    await user.type(screen.getByLabelText(/^Senha/), "certa12345{Enter}");

    await waitFor(() => {
      expect(onDone).toHaveBeenCalled();
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("the password can be shown and hidden again", async () => {
    const user = userEvent.setup();
    renderRouted(<LoginForm logIn={vi.fn()} busy={false} onDone={vi.fn()} />);
    const password = await screen.findByLabelText<HTMLInputElement>(/^Senha/);

    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(password.type).toBe("text");
    await user.click(screen.getByRole("button", { name: "Ocultar senha" }));

    expect(password.type).toBe("password");
  });

  it("offers the way to a forgotten password", async () => {
    renderRouted(<LoginForm logIn={vi.fn()} busy={false} onDone={vi.fn()} />);

    const link = await screen.findByRole("link", { name: "Esqueci a senha" });

    expect(link.getAttribute("href")).toBe("/esqueci-senha");
  });
});

describe("PasswordResetRequestForm, as a person asks for the link", () => {
  it("types the phone, sends, and reads the same answer whatever the number", async () => {
    const user = userEvent.setup();
    vi.mocked(requestPasswordReset).mockResolvedValue();
    renderRouted(<PasswordResetRequestForm />);

    await user.type(await screen.findByLabelText(/^Celular/), "61999990001{Enter}");

    expect(await screen.findByText("Confira seu e-mail")).toBeDefined();
    expect(requestPasswordReset).toHaveBeenCalledWith("+5561999990001");
    expect(screen.getByRole("link", { name: "Voltar para entrar" }).getAttribute("href")).toBe(
      "/entrar",
    );
  });

  it("a half-typed phone never leaves", async () => {
    const user = userEvent.setup();
    renderRouted(<PasswordResetRequestForm />);

    await user.type(await screen.findByLabelText(/^Celular/), "6199");
    await user.click(screen.getByRole("button", { name: "Enviar link" }));

    expect(screen.getByText(PHONE_HINT_ERROR)).toBeDefined();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("with no answer from the service it says so and lets the person try again", async () => {
    const user = userEvent.setup();
    vi.mocked(requestPasswordReset).mockRejectedValue(new TypeError("Failed to fetch"));
    renderRouted(<PasswordResetRequestForm />);

    await user.type(await screen.findByLabelText(/^Celular/), "61999990001{Enter}");

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Sem resposta do serviço. Tente de novo.",
    );
    expect(screen.getByRole("button", { name: "Enviar link" })).toBeDefined();
  });
});

describe("PasswordResetForm, as a person sets the new password", () => {
  it("types the new password and saves it with the link's token", async () => {
    const user = userEvent.setup();
    vi.mocked(confirmPasswordReset).mockResolvedValue();
    const onDone = vi.fn();
    renderRouted(<PasswordResetForm token="tok-1" onDone={onDone} />);

    await user.type(await screen.findByLabelText(/^Nova senha/), "nova-senha-boa");
    await user.click(screen.getByRole("button", { name: "Salvar senha" }));

    await waitFor(() => {
      expect(onDone).toHaveBeenCalled();
    });
    expect(confirmPasswordReset).toHaveBeenCalledWith("tok-1", "nova-senha-boa");
  });

  it("an expired link shows the API's words and the button works again", async () => {
    const user = userEvent.setup();
    vi.mocked(confirmPasswordReset).mockRejectedValue(
      new AccountRequestError(400, "Link vencido. Peça outro."),
    );
    const onDone = vi.fn();
    renderRouted(<PasswordResetForm token="old" onDone={onDone} />);

    await user.type(await screen.findByLabelText(/^Nova senha/), "nova-senha-boa{Enter}");

    expect((await screen.findByRole("alert")).textContent).toBe("Link vencido. Peça outro.");
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Salvar senha" }).hasAttribute("disabled")).toBe(
      false,
    );
  });
});
