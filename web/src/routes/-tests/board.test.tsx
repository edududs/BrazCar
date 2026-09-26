// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeEventSource, installFakeEventSource } from "@/shared/testing/fake-event-source";
import { renderApp } from "@/shared/testing/render-app";

import { rideOut, serveShell } from "./fixtures";

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
  installFakeEventSource();
  serveShell(api, null);
  api.serve("GET", "/api/places", 200, []);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal("fetch", api.fetch);
});

describe("the board at /", () => {
  it("lists what the API sends, as links to each ride", async () => {
    api.serve("GET", "/api/rides", 200, [rideOut]);

    await renderApp("/");

    const card = await screen.findByRole("link", { name: /Bruno/ });
    expect(card.getAttribute("href")).toBe("/caronas/r1");
    expect(screen.getByRole("heading", { level: 1, name: "Caronas" })).toBeDefined();
  });

  it("reads the filters from the address and asks the API with them (D-056)", async () => {
    api.serve("GET", "/api/rides", 200, []);

    await renderApp("/?q=incra&withSeats=true&maxPrice=8&from=%2218%3A00%22&day=%222099-09-23%22");

    await screen.findByText("Nenhuma carona com esses filtros.");
    const query = Object.fromEntries(api.sentTo("GET", "/api/rides")[0]?.query ?? []);
    expect(query).toEqual({
      q: "incra",
      with_seats: "true",
      max_price: "8",
      from: "18:00",
      day: "2099-09-23",
    });
  });

  it("an empty board without filters says the board fills by itself", async () => {
    api.serve("GET", "/api/rides", 200, []);

    await renderApp("/");

    expect(await screen.findByText("Nenhuma carona publicada por enquanto.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).toBeNull();
  });

  it("clearing the filters from the empty state empties the address and asks again", async () => {
    const user = userEvent.setup();
    api.serve("GET", "/api/rides", 200, []);
    const { router } = await renderApp("/?q=incra&withSeats=true");

    await user.click(await screen.findByRole("button", { name: "Limpar filtros" }));

    await waitFor(() => {
      expect(router.state.location.search).toEqual({});
    });
    // The text filter waits for a typing pause, so the last request is the one to read.
    await waitFor(() => {
      expect(Object.fromEntries(api.sentTo("GET", "/api/rides").at(-1)?.query ?? [])).toEqual({
        with_seats: "false",
      });
    });
  });

  it("typing in 'Passa por' writes the search into the address", async () => {
    const user = userEvent.setup();
    api.serve("GET", "/api/rides", 200, [rideOut]);
    const { router } = await renderApp("/");

    await user.type(await screen.findByLabelText(/^Passa por/), "incra");

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ q: "incra" });
    });
  });

  it("a failed board says it could not load", async () => {
    api.serve("GET", "/api/rides", 503, { detail: "fora do ar" });

    await renderApp("/");

    expect(await screen.findByText("Não foi possível carregar as caronas.")).toBeDefined();
  });

  it("a revision from the signal asks the API for the board again", async () => {
    api.serve("GET", "/api/rides", 200, [rideOut]);
    await renderApp("/");
    await screen.findByRole("link", { name: /Bruno/ });
    const before = api.sentTo("GET", "/api/rides").length;

    FakeEventSource.latest().send("revision", '{"revision":2}');
    FakeEventSource.latest().send("revision", '{"revision":3}');

    await waitFor(
      () => {
        expect(api.sentTo("GET", "/api/rides").length).toBeGreaterThan(before);
      },
      { timeout: 4000 },
    );
  });

  it("right after deleting the account the board says so once", async () => {
    api.serve("GET", "/api/rides", 200, []);

    await renderApp("/?accountDeleted=true");

    expect(
      await screen.findByText("Conta excluída. As caronas dela saíram do mural."),
    ).toBeDefined();
  });

  it("has the four tabs, with 'Entrar' for a visitor", async () => {
    api.serve("GET", "/api/rides", 200, []);

    await renderApp("/");

    const tabs = await screen.findByRole("navigation", { name: "Principal" });
    await waitFor(() => {
      expect(
        within(tabs)
          .getAllByRole("link")
          .map((link) => link.textContent),
      ).toEqual(["Caronas", "Publicar", "Minhas", "Entrar"]);
    });
  });
});
