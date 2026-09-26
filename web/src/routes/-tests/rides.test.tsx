// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { installFakeEventSource } from "@/shared/testing/fake-event-source";
import { renderApp } from "@/shared/testing/render-app";

import { driverOut, heldOut, myRideOut, rideOut, serveShell } from "./fixtures";

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

const place = (id: string, name: string) => ({
  place: { id, name, kind: "area", aliases: [], parent_id: null },
  descendants: [],
});

beforeEach(() => {
  api.reset();
  installFakeEventSource();
  serveShell(api, null);
  api.serve("GET", "/api/rides", 200, []);
  api.serve("GET", "/api/places", 200, []);
  api.serve("GET", "/api/places/brazlandia", 200, place("brazlandia", "Brazlândia"));
  api.serve("GET", "/api/places/esplanada", 200, place("esplanada", "Esplanada"));
});

describe("/caronas/$rideId", () => {
  it("shows the ride the address names, without tabs", async () => {
    // Signed in: the driver's name is personal data, and the routing this test checks is not
    // what is under test here (D-171).
    serveShell(api, driverOut);
    api.serve("GET", "/api/rides/r1", 200, rideOut);

    await renderApp("/caronas/r1");

    expect(await screen.findByText("Bruno Lima")).toBeDefined();
    expect(screen.getByRole("heading", { level: 1, name: "Carona" })).toBeDefined();
    expect(screen.queryByRole("navigation", { name: "Principal" })).toBeNull();
  });

  it("a ride the API does not know says so and leads back to the board", async () => {
    api.serve("GET", "/api/rides/gone", 404, { detail: "Carona não encontrada." });

    await renderApp("/caronas/gone");

    expect(await screen.findByText("Esta carona não existe")).toBeDefined();
    expect(screen.getByRole("link", { name: "Voltar ao mural" }).getAttribute("href")).toBe("/");
  });

  it("a ride that fails to load says it could not", async () => {
    api.serve("GET", "/api/rides/r1", 500, {});

    await renderApp("/caronas/r1");

    expect(await screen.findByText("Não foi possível carregar a carona.")).toBeDefined();
  });

  it("repeating a ride opens the new one with a notice", async () => {
    const user = userEvent.setup();
    serveShell(api, driverOut);
    api.serve("GET", "/api/rides/r1", 200, myRideOut);
    const copy = { ...myRideOut, id: "r9", departure_at: "2099-09-24T07:00:00-03:00" };
    api.serve("POST", "/api/rides/r1/repeat", 201, copy);
    api.serve("GET", "/api/rides/r9", 200, copy);
    const { router } = await renderApp("/caronas/r1");

    await user.click(await screen.findByRole("button", { name: /^Repetir/ }));
    await user.click(await screen.findByRole("button", { name: "Repetir carona" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/caronas/r9");
    });
    expect(await screen.findByText(/^Carona repetida\. Esta é a nova, de /)).toBeDefined();
  });

  it("asking for the contact goes to the API and reveals the phone", async () => {
    const user = userEvent.setup();
    serveShell(api, driverOut);
    api.serve("GET", "/api/rides/r1", 200, rideOut);
    api.serve("POST", "/api/rides/r1/contact", 200, {
      whatsapp_url: "https://wa.me/5561988887777",
      phone_display: "(61) 98888-7777",
      plate: "XYZ9A87",
    });
    await renderApp("/caronas/r1");

    await user.click(await screen.findByRole("button", { name: "Pedir contato" }));

    expect(await screen.findByText("(61) 98888-7777")).toBeDefined();
    expect(api.sentTo("POST", "/api/rides/r1/contact")).toHaveLength(1);
  });

  it("a held account asking for the contact sees the phrase and a way to its own account, not a generic error (D-168)", async () => {
    const user = userEvent.setup();
    serveShell(api, heldOut);
    api.serve("GET", "/api/rides/r1", 200, rideOut);
    api.serve("POST", "/api/rides/r1/contact", 403, {
      detail: "confirme seu e-mail para continuar",
      required_action: "confirm_email",
    });
    await renderApp("/caronas/r1");

    await user.click(await screen.findByRole("button", { name: "Pedir contato" }));

    expect(await screen.findByText("confirme seu e-mail para continuar")).toBeDefined();
    expect(screen.getByRole("link", { name: "Ir para minha conta" }).getAttribute("href")).toBe(
      "/conta",
    );
  });
});

describe("/caronas/$rideId/editar", () => {
  it("saving goes back to the ride with the time the board now shows", async () => {
    const user = userEvent.setup();
    serveShell(api, driverOut);
    api.serve("GET", "/api/rides/r1", 200, myRideOut);
    api.serve("PATCH", "/api/rides/r1", 200, myRideOut);
    const { router } = await renderApp("/caronas/r1/editar");

    expect(
      await screen.findByText("Antes de sair, o horário só muda dentro do mesmo dia."),
    ).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/caronas/r1");
    });
    expect(api.sentTo("PATCH", "/api/rides/r1")[0]?.body).toEqual({});
    expect(
      await screen.findByText(/^Alterações salvas\. O mural já mostra \d\d:\d\d\.$/),
    ).toBeDefined();
  });

  it("after leaving, it says the time can only be pushed back, and until when", async () => {
    serveShell(api, driverOut);
    api.serve("GET", "/api/rides/r1", 200, {
      ...myRideOut,
      actions: { ...myRideOut.actions, delay_until: "2099-09-23T07:30:00-03:00" },
    });

    await renderApp("/caronas/r1/editar");

    expect(
      await screen.findByText(/^Depois de sair, só dá para adiar, até \d\d:\d\d\.$/),
    ).toBeDefined();
  });

  it("a ride that cannot be edited any more says so, with no form", async () => {
    serveShell(api, driverOut);
    api.serve("GET", "/api/rides/r1", 200, {
      ...myRideOut,
      actions: { ...myRideOut.actions, can_edit: false },
    });

    await renderApp("/caronas/r1/editar");

    expect(await screen.findByText("Esta carona não pode mais ser editada.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Salvar alterações" })).toBeNull();
  });

  it("a ride that does not exist says so", async () => {
    serveShell(api, driverOut);
    api.serve("GET", "/api/rides/gone", 404, { detail: "Carona não encontrada." });

    await renderApp("/caronas/gone/editar");

    expect(await screen.findByText("Esta carona não existe.")).toBeDefined();
  });

  it("a held account sees the guard instead of the form (D-168)", async () => {
    serveShell(api, heldOut);
    api.serve("GET", "/api/rides/r1", 200, myRideOut);

    await renderApp("/caronas/r1/editar");

    expect(await screen.findByText("Falta confirmar seu e-mail")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Salvar alterações" })).toBeNull();
  });
});

describe("/publicar", () => {
  it("a visitor is asked to sign in first", async () => {
    await renderApp("/publicar");

    expect(await screen.findByText("Entre para publicar")).toBeDefined();
    // Two "Entrar" links now (D-171): the page's own and the closed-beta notice in the shell.
    const links = screen.getAllByRole("link", { name: "Entrar" });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute("href")).toBe("/entrar");
    }
  });

  it("an account without a car is asked to add one", async () => {
    serveShell(api, { ...driverOut, cars: [], can_drive: false });

    await renderApp("/publicar");

    expect(await screen.findByText("Cadastre um carro para publicar")).toBeDefined();
    expect(screen.getByRole("link", { name: "Cadastrar um carro" }).getAttribute("href")).toBe(
      "/conta",
    );
  });

  it("a driver gets the form, closed by the X back to the board, with no tabs", async () => {
    serveShell(api, driverOut);

    await renderApp("/publicar");

    expect(await screen.findByRole("button", { name: "Publicar carona" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Fechar" }).getAttribute("href")).toBe("/");
    expect(screen.queryByRole("navigation", { name: "Principal" })).toBeNull();
  });

  it("a held account sees the guard instead of the form (D-168)", async () => {
    serveShell(api, heldOut);

    await renderApp("/publicar");

    expect(await screen.findByText("Falta confirmar seu e-mail")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Publicar carona" })).toBeNull();
  });
});

describe("/minhas-caronas", () => {
  it("a visitor is asked to sign in", async () => {
    await renderApp("/minhas-caronas");

    expect(await screen.findByText("Entre para ver suas caronas")).toBeDefined();
  });

  it("a driver without rides is offered to publish", async () => {
    serveShell(api, driverOut);
    api.serve("GET", "/api/rides/mine", 200, []);

    await renderApp("/minhas-caronas");

    expect(await screen.findByText("Você ainda não publicou caronas.")).toBeDefined();
    expect(
      within(screen.getByRole("main"))
        .getByRole("link", { name: "Publicar carona" })
        .getAttribute("href"),
    ).toBe("/publicar");
  });

  it("splits the driver's rides into what is still to leave and what is over", async () => {
    serveShell(api, driverOut);
    api.serve("GET", "/api/rides/mine", 200, [
      { ...myRideOut, id: "later", departure_at: "2099-09-25T07:00:00-03:00" },
      { ...myRideOut, id: "sooner", departure_at: "2099-09-24T07:00:00-03:00" },
      { ...myRideOut, id: "gone", status: "cancelled" },
    ]);

    await renderApp("/minhas-caronas");

    const upcoming = (await screen.findByRole("heading", { name: "Próximas" })).closest("section");
    const finished = screen.getByRole("heading", { name: "Encerradas" }).closest("section");
    if (upcoming === null || finished === null) throw new Error("Sections are missing.");
    expect(
      within(upcoming)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/caronas/sooner", "/caronas/later"]);
    expect(within(upcoming).getByText("2 caronas")).toBeDefined();
    expect(within(finished).getByText("1 carona")).toBeDefined();
  });

  it("a list that fails to load says so", async () => {
    serveShell(api, driverOut);
    api.serve("GET", "/api/rides/mine", 500, {});

    await renderApp("/minhas-caronas");

    expect(await screen.findByText("Não foi possível carregar as caronas.")).toBeDefined();
  });

  it("a held account sees the guard instead of the list (D-168)", async () => {
    serveShell(api, heldOut);

    await renderApp("/minhas-caronas");

    expect(await screen.findByText("Falta confirmar seu e-mail")).toBeDefined();
  });
});
