// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PHONE_HINT_ERROR } from "@/shared/app/use-phone-input";

import { type Account, AccountRequestError, type SignupData } from "../domain/account";
import { SignupForm } from "./signup-form";

const ana: Account = {
  id: "a1",
  phone: "+5561999990001",
  phoneDisplay: "(61) 99999-0001",
  displayName: "Ana",
  email: null,
  cars: [],
  canDrive: false,
};

function fill(phone: string): void {
  fireEvent.change(screen.getByLabelText(/^Celular/), { target: { value: phone } });
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "Ana" } });
  fireEvent.change(screen.getByLabelText(/^Senha/), { target: { value: "uma-senha-boa" } });
  fireEvent.click(screen.getByLabelText(/Li e aceito os termos/));
  fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
}

describe("SignupForm phone", () => {
  it("sends the number as E.164 however it was typed", async () => {
    const signUp = vi.fn((data: SignupData) => Promise.resolve({ ...ana, phone: data.phone }));
    const onDone = vi.fn();
    render(<SignupForm signUp={signUp} busy={false} onDone={onDone} />);

    fill("+55 (61) 9 9999-0001");

    await waitFor(() => {
      expect(onDone).toHaveBeenCalled();
    });
    expect(signUp.mock.calls[0]?.[0].phone).toBe("+5561999990001");
  });

  it("stops a half-typed number before it leaves, next to the field", () => {
    const signUp = vi.fn(() => Promise.resolve(ana));
    render(<SignupForm signUp={signUp} busy={false} onDone={vi.fn()} />);

    fill("61 9");

    expect(screen.getByRole("alert").textContent).toBe(PHONE_HINT_ERROR);
    expect(signUp).not.toHaveBeenCalled();
  });

  it("shows why the API refused a whole number, like a landline", async () => {
    const signUp = vi.fn(() =>
      Promise.reject(
        new AccountRequestError(422, "use um número de celular: o contato é pelo WhatsApp"),
      ),
    );
    render(<SignupForm signUp={signUp} busy={false} onDone={vi.fn()} />);

    fill("(61) 3333-4444");

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "use um número de celular: o contato é pelo WhatsApp",
    );
  });
});
