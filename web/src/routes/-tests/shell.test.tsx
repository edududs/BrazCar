// @vitest-environment jsdom
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeEventSource, installFakeEventSource } from "@/shared/testing/fake-event-source";
import { renderApp } from "@/shared/testing/render-app";

import { driverOut, rideOut, serveShell } from "./fixtures";

const api = await vi.hoisted(async () => {
  const { installFakeApi } = await import("@/shared/testing/fake-api");
  return installFakeApi();
});

vi.mock("@/shared/adapters/service-worker", () => ({
  applyUpdate: vi.fn(() => Promise.resolve()),
  readUpdateWaiting: () => false,
  subscribeToUpdateWaiting: () => () => undefined,
}));

beforeEach(() => {
  api.reset();
  installFakeEventSource();
  serveShell(api, null);
  api.serve("GET", "/api/rides", 200, [rideOut]);
  api.serve("GET", "/api/places", 200, []);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the shell", () => {
  it("an address that leads nowhere shows the empty route, inside the shell", async () => {
    await renderApp("/nada-aqui");

    expect(await screen.findByRole("heading", { level: 1 })).toBeDefined();
    expect(screen.getByRole("link", { name: /mural/i }).getAttribute("href")).toBe("/");
  });

  it("a signed-in person has 'Conta' as the last tab", async () => {
    serveShell(api, driverOut);

    await renderApp("/");

    const tabs = await screen.findByRole("navigation", { name: "Principal" });
    expect(await within(tabs).findByRole("link", { name: "Conta" })).toBeDefined();
  });

  it("below the version floor, the whole app is one screen that updates (D-105)", async () => {
    const user = userEvent.setup();
    const { applyUpdate } = await import("@/shared/adapters/service-worker");
    api.serve("GET", "/api/web-version", 200, { minimum: "999.0.0" });

    await renderApp("/");

    expect(await screen.findByText("Atualize o BrazCar")).toBeDefined();
    expect(screen.queryByRole("navigation", { name: "Principal" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Atualizar agora" }));
    expect(applyUpdate).toHaveBeenCalledTimes(1);
  });

  it("without a network the page stays, inert, under a notice, and the board loads fresh after (D-051)", async () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    await renderApp("/");
    await screen.findByRole("link", { name: /Bruno/ });

    onLine.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    const notice = await screen.findByRole("alert");
    expect(notice.textContent).toContain("Sem internet.");
    const page = screen.getByRole("main").parentElement;
    expect(page?.hasAttribute("inert")).toBe(true);
    expect(screen.getByRole("heading", { level: 1, name: "Caronas" })).toBeDefined();
    const asked = api.sentTo("GET", "/api/rides").length;

    onLine.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => {
      expect(screen.queryByText(/Sem internet/)).toBeNull();
    });
    expect(await screen.findByRole("link", { name: /Bruno/ })).toBeDefined();
    expect(api.sentTo("GET", "/api/rides").length).toBeGreaterThan(asked);
  });
});

describe("/diagnostics (D-049)", () => {
  it("without a token asks for one, and opening puts it in the address", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp("/diagnostics");

    await user.type(await screen.findByLabelText(/^Token/), " abc {Enter}");

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ token: "abc", tickSeconds: 1 });
    });
  });

  it("with a token opens the stream with the address's settings and shows it live", async () => {
    const user = userEvent.setup();
    await renderApp("/diagnostics?token=123&tickSeconds=5&heartbeatKind=comment&resumeGraceMs=x");

    expect(await screen.findByRole("heading", { name: "Diagnóstico SSE" })).toBeDefined();
    const url = new URL(FakeEventSource.latest().url, "https://front.test");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      token: "123",
      tick_seconds: "5",
      heartbeat_seconds: "15",
      heartbeat_kind: "comment",
    });

    act(() => {
      FakeEventSource.latest().open();
    });
    expect(await screen.findByText("conexão aberta")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Marcar momento" }));
    expect(screen.getByText("=== MARCA 1 ===")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Reconectar" }));
    expect(screen.getByText("conectando (motivo: manual)")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Limpar" }));
    expect(
      within(screen.getByRole("list", { name: "Registro de eventos" })).queryAllByRole("listitem"),
    ).toHaveLength(0);
  });
});
