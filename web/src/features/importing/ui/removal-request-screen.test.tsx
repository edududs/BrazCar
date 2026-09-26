// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderRouted } from "@/shared/testing/render-routed";

import * as gateway from "../adapters/removal-gateway";
import { RemovalRequestError } from "../domain/removal-request";
import { RemovalRequestScreen } from "./removal-request-screen";

vi.mock("../adapters/removal-gateway");
const mocked = vi.mocked(gateway);

describe("RemovalRequestScreen, as a person uses it (D-172)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("explains itself before any field", async () => {
    renderRouted(<RemovalRequestScreen />);

    expect(
      await screen.findByText(/foi anunciada num grupo de WhatsApp de onde o BrazCar lê ofertas/),
    ).toBeDefined();
    expect(screen.getByLabelText("Celular")).toBeDefined();
    expect(screen.getByLabelText(/^Quer explicar algo/)).toBeDefined();
  });

  it("types the phone and the note key by key, tabs between them, and sends on Enter", async () => {
    const user = userEvent.setup();
    mocked.requestRemoval.mockResolvedValue();
    renderRouted(<RemovalRequestScreen />);

    await user.click(await screen.findByLabelText("Celular"));
    await user.keyboard("61999990002");
    expect(screen.getByLabelText<HTMLInputElement>("Celular").value).toBe("(61) 99999-0002");
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText(/^Quer explicar algo/));
    await user.keyboard("Não anuncio mais nesse número.");
    expect(screen.getByText("30/500")).toBeDefined();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Pedir remoção" }));
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(mocked.requestRemoval).toHaveBeenCalledWith({
        phone: "+5561999990002",
        note: "Não anuncio mais nesse número.",
      });
    });
    expect(await screen.findByRole("heading", { name: "Pedido recebido" })).toBeDefined();
  });

  it("an unfinished phone is marked, and nothing is sent", async () => {
    const user = userEvent.setup();
    renderRouted(<RemovalRequestScreen />);

    await user.click(await screen.findByLabelText("Celular"));
    await user.keyboard("6199");
    await user.click(screen.getByRole("button", { name: "Pedir remoção" }));

    expect(
      await screen.findByText("Digite o celular com DDD, como (61) 99999-9999."),
    ).toBeDefined();
    expect(mocked.requestRemoval).not.toHaveBeenCalled();
  });

  it("what the API refuses is said on the same screen, which stays open", async () => {
    const user = userEvent.setup();
    mocked.requestRemoval.mockRejectedValue(
      new RemovalRequestError(429, "Muitos pedidos hoje. Tente de novo amanhã."),
    );
    renderRouted(<RemovalRequestScreen />);

    await user.click(await screen.findByLabelText("Celular"));
    await user.keyboard("61999990002{Enter}");

    expect(await screen.findByText("Muitos pedidos hoje. Tente de novo amanhã.")).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Pedido recebido" })).toBeNull();
  });
});
