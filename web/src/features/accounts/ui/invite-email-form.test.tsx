// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AccountRequestError, type Invite } from "../domain/account";
import { InviteEmailForm } from "./invite-email-form";

const invite: Invite = {
  status: "open",
  phoneMasked: "+5561*****0001",
  emailMasked: null,
  expiresAt: "2026-09-01T14:00:00-03:00",
};

describe("InviteEmailForm, opening the invite (D-166, D-167)", () => {
  it("says which phone the invite is for and until when it lasts", () => {
    render(<InviteEmailForm invite={invite} sending={false} giveEmail={vi.fn()} />);

    expect(
      screen.getByText("Este convite é para o celular +5561*****0001 e vale até 01/09 às 14:00."),
    ).toBeDefined();
  });

  it("types the e-mail and sends it", async () => {
    const user = userEvent.setup();
    const giveEmail = vi.fn(() => Promise.resolve());
    render(<InviteEmailForm invite={invite} sending={false} giveEmail={giveEmail} />);

    await user.click(screen.getByLabelText(/^E-mail/));
    await user.keyboard("ana@example.com");
    await user.click(screen.getByRole("button", { name: "Receber o link" }));

    await waitFor(() => {
      expect(giveEmail).toHaveBeenCalledWith("ana@example.com");
    });
  });

  it("shows why the API refused, like too many sends", async () => {
    const user = userEvent.setup();
    const giveEmail = vi.fn(() =>
      Promise.reject(new AccountRequestError(429, "Muitos envios. Espere um pouco.")),
    );
    render(<InviteEmailForm invite={invite} sending={false} giveEmail={giveEmail} />);

    await user.click(screen.getByLabelText(/^E-mail/));
    await user.keyboard("ana@example.com{Enter}");

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Muitos envios. Espere um pouco.",
    );
  });
});
