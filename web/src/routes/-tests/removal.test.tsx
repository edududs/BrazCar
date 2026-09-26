// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderApp } from "@/shared/testing/render-app";

import { serveShell } from "./fixtures";

// The real adapter imports vite-plugin-pwa's virtual module, which Vitest cannot resolve; the
// shell mounts it on every route, so any test rendering the whole app needs this double (D-106).
vi.mock("@/shared/adapters/service-worker", () => ({
  applyUpdate: vi.fn(() => Promise.resolve()),
  readUpdateWaiting: () => false,
  subscribeToUpdateWaiting: () => () => undefined,
}));

const api = await vi.hoisted(async () => {
  const { installFakeApi } = await import("@/shared/testing/fake-api");
  return installFakeApi();
});

beforeEach(() => {
  api.reset();
  serveShell(api, null);
});

describe("/sair-do-mural (D-162, D-172)", () => {
  it("explains the board and the request, and opens with no session", async () => {
    await renderApp("/sair-do-mural");

    expect(await screen.findByRole("heading", { name: "Sair do mural" })).toBeDefined();
    expect(
      screen.getByText(/anunciada num grupo de WhatsApp de onde o BrazCar lê ofertas/),
    ).toBeDefined();
    expect(screen.getByLabelText("Celular")).toBeDefined();
  });

  it("an unfinished phone is marked, and nothing is sent", async () => {
    const user = userEvent.setup();
    await renderApp("/sair-do-mural");

    await user.click(await screen.findByRole("button", { name: "Pedir remoção" }));

    expect(
      await screen.findByText("Digite o celular com DDD, como (61) 99999-9999."),
    ).toBeDefined();
    expect(api.sentTo("POST", "/api/removal-requests")).toHaveLength(0);
  });

  it("types the phone and an explanation key by key, sends and shows it was received", async () => {
    const user = userEvent.setup();
    api.answer(202, { ok: true });
    await renderApp("/sair-do-mural");

    await user.click(await screen.findByLabelText("Celular"));
    await user.keyboard("61999990002");
    expect(screen.getByLabelText<HTMLInputElement>("Celular").value).toBe("(61) 99999-0002");
    await user.click(screen.getByLabelText(/^Quer explicar algo/));
    await user.keyboard("Não anuncio mais nesse número.");
    await user.click(screen.getByRole("button", { name: "Pedir remoção" }));

    await waitFor(() => {
      expect(api.sentTo("POST", "/api/removal-requests")[0]?.body).toEqual({
        phone: "+5561999990002",
        note: "Não anuncio mais nesse número.",
      });
    });
    expect(await screen.findByRole("heading", { name: "Pedido recebido" })).toBeDefined();
    expect(screen.getByText(/Não há prazo/)).toBeDefined();
  });

  it("a request without an explanation sends the note as null", async () => {
    const user = userEvent.setup();
    api.answer(202, { ok: true });
    await renderApp("/sair-do-mural");

    await user.click(await screen.findByLabelText("Celular"));
    await user.keyboard("61999990002{Enter}");

    await waitFor(() => {
      expect(api.sentTo("POST", "/api/removal-requests")[0]?.body).toMatchObject({ note: null });
    });
  });

  it("too many requests (429) is said in the API's own words, and the form stays", async () => {
    const user = userEvent.setup();
    api.answer(429, { detail: "Muitos pedidos hoje. Tente de novo amanhã." });
    await renderApp("/sair-do-mural");

    await user.click(await screen.findByLabelText("Celular"));
    await user.keyboard("61999990002{Enter}");

    expect(await screen.findByText("Muitos pedidos hoje. Tente de novo amanhã.")).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Pedido recebido" })).toBeNull();
  });

  it("an invalid phone (422) is said in the API's own words", async () => {
    const user = userEvent.setup();
    api.answer(422, { detail: "Telefone inválido." });
    await renderApp("/sair-do-mural");

    await user.click(await screen.findByLabelText("Celular"));
    await user.keyboard("61999990002{Enter}");

    expect(await screen.findByText("Telefone inválido.")).toBeDefined();
  });
});
