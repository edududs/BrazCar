// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
} from "@tanstack/react-router";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Flash } from "../domain/flash";
import { FlashToast } from "../ui/flash-toast";
import { useFlash } from "./use-flash";

/** Two pages: the first navigates to the second with a flash; the second shows the toast. */
function Sender() {
  const navigate = useNavigate();
  const flash: Flash = { message: "Carona publicada. Já está no mural." };
  return (
    <button
      type="button"
      onClick={() => {
        void navigate({ to: "/publicar", state: { flash } });
      }}
    >
      Ir
    </button>
  );
}

/** The toast while the flash lasts, as the shell shows it. */
function Shown() {
  const flash = useFlash();
  return flash === null ? null : <FlashToast flash={flash} />;
}

function mount() {
  const root = createRootRoute({
    component: () => (
      <>
        <Outlet />
        <Shown />
      </>
    ),
  });
  const home = createRoute({ getParentRoute: () => root, path: "/", component: Sender });
  const after = createRoute({
    getParentRoute: () => root,
    path: "/publicar",
    component: () => <p>Depois</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([home, after]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useFlash and FlashToast", () => {
  it("shows the line carried by the navigation, then lets it go", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Ir" }));

    const toast = await screen.findByRole("status");
    expect(toast.textContent).toContain("Carona publicada. Já está no mural.");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });
});
