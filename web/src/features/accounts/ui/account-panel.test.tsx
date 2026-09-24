// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderRouted } from "@/shared/testing/render-routed";

import type { Account } from "../domain/account";
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

/** Renders the panel and returns once the router has settled and the delete button is on screen. */
async function show(
  deleteAccount: () => Promise<void>,
  onDeleted: () => void = vi.fn(),
): Promise<HTMLElement> {
  renderRouted(
    <AccountPanel
      account={ana}
      busy={false}
      addCar={() => Promise.reject(new Error("not in this test"))}
      removeCar={() => Promise.reject(new Error("not in this test"))}
      logOut={() => Promise.reject(new Error("not in this test"))}
      deleteAccount={deleteAccount}
      onDeleted={onDeleted}
    />,
  );
  return screen.findByRole("button", { name: "Excluir conta" });
}

describe("AccountPanel data", () => {
  it("shows the phone formatted, never the raw E.164", async () => {
    await show(() => Promise.resolve());

    expect(screen.getByText("(61) 99999-0001")).toBeDefined();
    expect(screen.queryByText("+5561999990001")).toBeNull();
  });
});

describe("AccountPanel delete control", () => {
  it("opens a dialog that explains what happens, separate from the everyday actions", async () => {
    const open = await show(() => Promise.resolve());

    fireEvent.click(open);

    expect(screen.getByText("Excluir sua conta?")).toBeDefined();
    expect(
      screen.getByText(/A conta some e as caronas publicadas por ela saem do mural/),
    ).toBeDefined();
  });

  it("cancelling the dialog never calls the deletion", async () => {
    const deleteAccount = vi.fn(() => Promise.resolve());
    const open = await show(deleteAccount);

    fireEvent.click(open);
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(deleteAccount).not.toHaveBeenCalled();
    expect(screen.queryByText("Excluir sua conta?")).toBeNull();
  });

  it("confirming calls the deletion and hands off to where the account goes next", async () => {
    const deleteAccount = vi.fn(() => Promise.resolve());
    const onDeleted = vi.fn();
    const open = await show(deleteAccount, onDeleted);

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
    const open = await show(deleteAccount);

    fireEvent.click(open);
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir conta" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe("Sem resposta do serviço. Tente de novo.");
    });
  });
});
