// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderRouted } from "@/shared/testing/render-routed";

import type { Account, CarData } from "../domain/account";
import { AccountPanel } from "./account-panel";

const ana: Account = {
  id: "a1",
  phone: "+5561999990001",
  phoneDisplay: "(61) 99999-0001",
  displayName: "Ana Paula",
  email: null,
  cars: [{ id: "c1", model: "Gol", color: "prata", plate: "ABC1D23" }],
  canDrive: true,
};

const notInThisTest = () => Promise.reject(new Error("not in this test"));

function show(overrides: Partial<Parameters<typeof AccountPanel>[0]> = {}) {
  renderRouted(
    <AccountPanel
      account={ana}
      busy={false}
      updateProfile={notInThisTest}
      changePassword={notInThisTest}
      passwordBusy={false}
      addCar={notInThisTest}
      removeCar={notInThisTest}
      logOut={notInThisTest}
      deleteAccount={notInThisTest}
      onDeleted={vi.fn()}
      {...overrides}
    />,
  );
}

describe("AccountPanel, as the owner uses it", () => {
  it("opens in reading; editing is asked for, and the sheet takes typing at once", async () => {
    const user = userEvent.setup();
    const updateProfile = vi.fn(() => Promise.resolve({ ...ana, email: "ana@exemplo.com" }));
    show({ updateProfile });

    expect(await screen.findByText("Ana Paula")).toBeDefined();
    expect(screen.queryByLabelText("Nome social")).toBeNull();

    await user.click(screen.getByRole("button", { name: /^Editar dados/ }));
    const sheet = screen.getByRole("dialog", { name: "Seus dados" });
    await user.click(within(sheet).getByLabelText(/^E-mail/));
    await user.keyboard("ana@exemplo.com");
    await user.click(within(sheet).getByRole("button", { name: "Salvar dados" }));

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith({ email: "ana@exemplo.com" });
    });
    expect(await screen.findByText("Dados salvos.")).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the phone but never lets it be typed over", async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole("button", { name: /^Editar dados/ }));
    const phone = within(screen.getByRole("dialog")).getByLabelText("Celular");
    expect(phone).toHaveProperty("readOnly", true);
    expect(phone).toHaveProperty("value", "(61) 99999-0001");
  });

  it("registers a car on a sheet, typed field by field with Tab, and says it worked", async () => {
    const user = userEvent.setup();
    const addCar = vi.fn((car: CarData) =>
      Promise.resolve({ ...ana, cars: [...ana.cars, { id: "c2", ...car }] }),
    );
    show({ addCar });

    await user.click(await screen.findByRole("button", { name: "Adicionar outro carro" }));
    const sheet = screen.getByRole("dialog", { name: "Novo carro" });
    await user.click(within(sheet).getByLabelText("Modelo"));
    await user.keyboard("Onix");
    await user.tab();
    await user.keyboard("branco");
    await user.tab();
    await user.keyboard("DEM7X77{Enter}");

    await waitFor(() => {
      expect(addCar).toHaveBeenCalledWith({ model: "Onix", color: "branco", plate: "DEM7X77" });
    });
    expect(await screen.findByText("Carro cadastrado. Já dá para publicar.")).toBeDefined();
  });

  it("removes a car from the button named after it", async () => {
    const user = userEvent.setup();
    const removeCar = vi.fn(() => Promise.resolve({ ...ana, cars: [] }));
    show({ removeCar });
    await user.click(await screen.findByRole("button", { name: "Remover Gol prata" }));
    expect(removeCar).toHaveBeenCalledWith("c1");
  });

  it("changes the password with both fields able to be shown", async () => {
    const user = userEvent.setup();
    const changePassword = vi.fn(() => Promise.resolve());
    show({ changePassword });

    await user.click(await screen.findByRole("button", { name: "Trocar senha" }));
    const sheet = screen.getByRole("dialog", { name: "Trocar senha" });
    await user.click(within(sheet).getByLabelText("Senha atual"));
    await user.keyboard("antiga-senha");
    await user.click(within(sheet).getByLabelText("Nova senha"));
    await user.keyboard("nova-senha-boa");
    expect(within(sheet).getAllByRole("button", { name: "Mostrar senha" })).toHaveLength(2);
    await user.click(within(sheet).getByRole("button", { name: "Salvar senha" }));

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: "antiga-senha",
        newPassword: "nova-senha-boa",
      });
    });
  });

  it("offers an opinion only when the page gives a way to send one", async () => {
    const user = userEvent.setup();
    const onFeedback = vi.fn();
    show({ onFeedback });

    await user.click(await screen.findByRole("button", { name: /^Enviar opinião/ }));

    expect(onFeedback).toHaveBeenCalledOnce();
  });

  it("without that way, there is no row", async () => {
    show();

    expect(await screen.findByText("Ana Paula")).toBeDefined();
    expect(screen.queryByRole("button", { name: /^Enviar opinião/ })).toBeNull();
  });
});
