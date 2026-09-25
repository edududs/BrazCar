// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderRouted } from "@/shared/testing/render-routed";

import {
  AccountRequestError,
  type Account,
  type ChangePasswordData,
  type ProfileChanges,
} from "../domain/account";
import { AccountPanel } from "./account-panel";

const ana: Account = {
  id: "a1",
  phone: "+5561999990001",
  phoneDisplay: "(61) 99999-0001",
  displayName: "Ana",
  email: null,
  cars: [],
  canDrive: false,
};

const notInThisTest = () => Promise.reject(new Error("not in this test"));

interface ShowOptions {
  readonly account?: Account;
  readonly deleteAccount?: () => Promise<void>;
  readonly onDeleted?: () => void;
  readonly updateProfile?: (changes: ProfileChanges) => Promise<Account>;
  readonly changePassword?: (data: ChangePasswordData) => Promise<void>;
}

/** Renders the panel and returns once the router has settled and the delete button is on screen. */
async function show(options: ShowOptions = {}): Promise<HTMLElement> {
  renderRouted(
    <AccountPanel
      account={options.account ?? ana}
      busy={false}
      updateProfile={options.updateProfile ?? notInThisTest}
      changePassword={options.changePassword ?? notInThisTest}
      passwordBusy={false}
      addCar={notInThisTest}
      removeCar={notInThisTest}
      logOut={notInThisTest}
      deleteAccount={options.deleteAccount ?? notInThisTest}
      onDeleted={options.onDeleted ?? vi.fn()}
    />,
  );
  return screen.findByRole("button", { name: "Excluir conta" });
}

describe("AccountPanel data", () => {
  it("shows the phone formatted, never the raw E.164", async () => {
    await show();

    expect(screen.getByText("(61) 99999-0001")).toBeDefined();
    expect(screen.queryByText("+5561999990001")).toBeNull();
  });
});

describe("AccountPanel delete control", () => {
  it("opens a dialog that explains what happens, separate from the everyday actions", async () => {
    const open = await show({ deleteAccount: () => Promise.resolve() });

    fireEvent.click(open);

    expect(screen.getByText("Excluir sua conta?")).toBeDefined();
    expect(
      screen.getByText(/A conta some e as caronas publicadas por ela saem do mural/),
    ).toBeDefined();
  });

  it("cancelling the dialog never calls the deletion", async () => {
    const deleteAccount = vi.fn(() => Promise.resolve());
    const open = await show({ deleteAccount });

    fireEvent.click(open);
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(deleteAccount).not.toHaveBeenCalled();
    expect(screen.queryByText("Excluir sua conta?")).toBeNull();
  });

  it("confirming calls the deletion and hands off to where the account goes next", async () => {
    const deleteAccount = vi.fn(() => Promise.resolve());
    const onDeleted = vi.fn();
    const open = await show({ deleteAccount, onDeleted });

    fireEvent.click(open);
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir conta" }),
    );

    expect(deleteAccount).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledTimes(1);
    });
  });

  it("a refused deletion shows the reason", async () => {
    const deleteAccount = vi.fn(() => Promise.reject(new Error("Não foi possível excluir.")));
    const open = await show({ deleteAccount });

    fireEvent.click(open);
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir conta" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe("Sem resposta do serviço. Tente de novo.");
    });
  });
});

describe("AccountPanel profile", () => {
  it("shows the phone formatted and says it cannot be edited here", async () => {
    await show();

    expect(screen.getByText("(61) 99999-0001")).toBeDefined();
    expect(screen.getByText("O telefone não muda por aqui.")).toBeDefined();
  });

  it("warns when there is no e-mail", async () => {
    await show({ account: ana }); // ana has no e-mail

    expect(screen.getByText("Sem e-mail você não recupera a senha.")).toBeDefined();
  });

  it("saving a changed name and e-mail calls updateProfile with only what changed", async () => {
    const updated: Account = { ...ana, displayName: "Ana Paula", email: "ana@example.com" };
    const updateProfile = vi.fn(() => Promise.resolve(updated));
    await show({ updateProfile });

    fireEvent.change(screen.getByLabelText("Nome social"), { target: { value: "Ana Paula" } });
    fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: "ana@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar dados" }));

    await waitFor(() => {
      expect(screen.getByText("Dados salvos.")).toBeDefined();
    });
    expect(updateProfile).toHaveBeenCalledWith({
      displayName: "Ana Paula",
      email: "ana@example.com",
    });
  });

  it("clearing a previous e-mail sends an empty string", async () => {
    const withEmail: Account = { ...ana, email: "ana@example.com" };
    const updated: Account = { ...withEmail, email: null };
    const updateProfile = vi.fn(() => Promise.resolve(updated));
    await show({ account: withEmail, updateProfile });

    fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar dados" }));

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith({ email: "" });
    });
  });

  it("an invalid e-mail shows the reason the API gives", async () => {
    const updateProfile = vi.fn(() =>
      Promise.reject(new AccountRequestError(422, "e-mail inválido")),
    );
    await show({ updateProfile });

    fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar dados" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe("e-mail inválido");
    });
  });
});

describe("AccountPanel password", () => {
  it("changing the password successfully shows a confirmation", async () => {
    const changePassword = vi.fn(() => Promise.resolve());
    await show({ changePassword });

    fireEvent.change(screen.getByLabelText(/^Senha atual/), { target: { value: "senha-antiga" } });
    fireEvent.change(screen.getByLabelText(/^Nova senha/), { target: { value: "senha-nova-boa" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar senha" }));

    await waitFor(() => {
      expect(screen.getByText("Senha alterada.")).toBeDefined();
    });
    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: "senha-antiga",
      newPassword: "senha-nova-boa",
    });
  });

  it("the wrong current password shows the reason the API gives", async () => {
    const changePassword = vi.fn(() =>
      Promise.reject(new AccountRequestError(403, "senha atual não confere")),
    );
    await show({ changePassword });

    fireEvent.change(screen.getByLabelText(/^Senha atual/), { target: { value: "errada" } });
    fireEvent.change(screen.getByLabelText(/^Nova senha/), { target: { value: "senha-nova-boa" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar senha" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe("senha atual não confere");
    });
  });

  it("a weak new password shows the reason the API gives", async () => {
    const changePassword = vi.fn(() =>
      Promise.reject(new AccountRequestError(422, "senha muito curta")),
    );
    await show({ changePassword });

    fireEvent.change(screen.getByLabelText(/^Senha atual/), { target: { value: "senha-antiga" } });
    fireEvent.change(screen.getByLabelText(/^Nova senha/), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar senha" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe("senha muito curta");
    });
  });
});
