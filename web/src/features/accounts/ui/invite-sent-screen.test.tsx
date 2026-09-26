// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AccountRequestError } from "../domain/account";
import { InviteSentScreen } from "./invite-sent-screen";

describe("InviteSentScreen (D-166)", () => {
  it("says where the link went and that it lasts 2 hours", () => {
    render(
      <InviteSentScreen
        email="ana@example.com"
        canResend
        sending={false}
        resend={vi.fn()}
        useAnotherEmail={vi.fn()}
      />,
    );

    expect(screen.getByText(/ana@example\.com/)).toBeDefined();
    expect(screen.getByText(/vale 2 horas/)).toBeDefined();
  });

  it("resends the same address", async () => {
    const user = userEvent.setup();
    const resend = vi.fn(() => Promise.resolve());
    render(
      <InviteSentScreen
        email="ana@example.com"
        canResend
        sending={false}
        resend={resend}
        useAnotherEmail={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Reenviar" }));

    await waitFor(() => {
      expect(resend).toHaveBeenCalled();
    });
  });

  it("cannot resend without a known address, only start over", () => {
    render(
      <InviteSentScreen
        email="a**@example.com"
        canResend={false}
        sending={false}
        resend={vi.fn()}
        useAnotherEmail={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Reenviar" })).toHaveProperty("disabled", true);
  });

  it("goes back to the form to type another address", async () => {
    const user = userEvent.setup();
    const useAnotherEmail = vi.fn();
    render(
      <InviteSentScreen
        email="ana@example.com"
        canResend
        sending={false}
        resend={vi.fn()}
        useAnotherEmail={useAnotherEmail}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Usar outro e-mail" }));

    expect(useAnotherEmail).toHaveBeenCalled();
  });

  it("shows why a resend was refused, like too many sends", async () => {
    const user = userEvent.setup();
    const resend = vi.fn(() =>
      Promise.reject(new AccountRequestError(429, "Muitos envios. Espere um pouco.")),
    );
    render(
      <InviteSentScreen
        email="ana@example.com"
        canResend
        sending={false}
        resend={resend}
        useAnotherEmail={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Reenviar" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Muitos envios. Espere um pouco.",
    );
  });
});
