// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderRouted } from "@/shared/testing/render-routed";

import type { EmailConfirmationView } from "../app/use-email-confirmation";
import type { Account } from "../domain/account";
import { HeldAccountScreen } from "./held-account-screen";

const account: Account = {
  id: "a1",
  phone: "+5561999990001",
  phoneDisplay: "(61) 99999-0001",
  displayName: "Ana",
  email: null,
  emailConfirmed: false,
  requiredAction: "confirm_email",
  cars: [],
  canDrive: false,
};

const formView: EmailConfirmationView = {
  status: "form",
  sending: false,
  requestLink: vi.fn(() => Promise.resolve()),
};

function show(
  overrides: Partial<{
    account: Account;
    view: EmailConfirmationView;
    busy: boolean;
    logOut: () => Promise<void>;
    deleteAccount: () => Promise<void>;
  }> = {},
) {
  return renderRouted(
    <HeldAccountScreen
      account={overrides.account ?? account}
      view={overrides.view ?? formView}
      busy={overrides.busy ?? false}
      logOut={overrides.logOut ?? (() => Promise.reject(new Error("not in this test")))}
      deleteAccount={
        overrides.deleteAccount ?? (() => Promise.reject(new Error("not in this test")))
      }
    />,
  );
}

describe("HeldAccountScreen (D-168)", () => {
  it("says why, with an empty e-mail field when the account has none", async () => {
    show();

    expect(await screen.findByText("Falta confirmar seu e-mail")).toBeDefined();
    expect(screen.getByText(/precisa de um e-mail confirmado/)).toBeDefined();
    expect(screen.getByLabelText<HTMLInputElement>(/^E-mail/).value).toBe("");
  });

  it("pre-fills the field with the account's own unconfirmed address", async () => {
    show({ account: { ...account, email: "ana@example.com" } });

    expect((await screen.findByLabelText<HTMLInputElement>(/^E-mail/)).value).toBe(
      "ana@example.com",
    );
  });

  it("types an address and asks for the link", async () => {
    const user = userEvent.setup();
    const requestLink = vi.fn(() => Promise.resolve());
    show({ view: { status: "form", sending: false, requestLink } });

    await user.click(await screen.findByLabelText(/^E-mail/));
    await user.keyboard("ana@example.com");
    await user.click(screen.getByRole("button", { name: "Receber o link" }));

    await waitFor(() => {
      expect(requestLink).toHaveBeenCalledWith("ana@example.com");
    });
  });

  it("once sent, reuses the invite's own 'confirme seu e-mail' screen", async () => {
    show({
      view: {
        status: "sent",
        email: "ana@example.com",
        sending: false,
        resend: vi.fn(),
        useAnotherEmail: vi.fn(),
      },
    });

    expect(await screen.findByText("Confirme seu e-mail")).toBeDefined();
    expect(screen.getByText(/ana@example\.com/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Reenviar" })).toBeDefined();
  });

  it("always leaves the mural, sign-out and delete reachable", async () => {
    const user = userEvent.setup();
    const logOut = vi.fn(() => Promise.resolve());
    show({ logOut });

    expect((await screen.findByRole("link", { name: "Ver o mural" })).getAttribute("href")).toBe(
      "/",
    );

    await user.click(screen.getByRole("button", { name: "Sair da conta" }));

    await waitFor(() => {
      expect(logOut).toHaveBeenCalled();
    });
  });

  it("deletes only after confirming, through the same dialog the account panel uses", async () => {
    const user = userEvent.setup();
    const deleteAccount = vi.fn(() => Promise.resolve());
    show({ deleteAccount });

    await user.click(await screen.findByRole("button", { name: "Excluir conta" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Excluir sua conta?")).toBeDefined();
    await user.click(within(dialog).getByRole("button", { name: "Excluir conta" }));

    await waitFor(() => {
      expect(deleteAccount).toHaveBeenCalled();
    });
  });

  it("shows why sign-out failed instead of dropping the refusal", async () => {
    const user = userEvent.setup();
    const logOut = vi.fn(() => Promise.reject(new Error("Não foi possível sair.")));
    show({ logOut });

    await user.click(await screen.findByRole("button", { name: "Sair da conta" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Sem resposta do serviço. Tente de novo.",
    );
  });
});
