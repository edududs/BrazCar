// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderRouted } from "../testing/render-routed";
import { ShellOverlays } from "./shell-overlays";

const state = vi.hoisted(() => ({
  update: false,
  flash: null as { message: string } | null,
  hint: true,
}));

vi.mock("../app/use-app-update", () => ({
  useAppUpdate: () => ({
    available: state.update,
    request: vi.fn(),
    confirming: false,
    confirm: vi.fn(),
    cancel: vi.fn(),
  }),
}));
vi.mock("../app/use-flash", () => ({ useFlash: () => state.flash }));
vi.mock("../app/use-install-hint", () => ({
  useInstallHint: () => ({ visible: state.hint, dismiss: vi.fn() }),
}));

beforeEach(() => {
  state.update = false;
  state.flash = null;
  state.hint = true;
});

describe("ShellOverlays", () => {
  it("shows the install hint on the board when nothing else has to be said", async () => {
    renderRouted(<ShellOverlays />);
    expect(await screen.findByRole("complementary", { name: "Use como app" })).toBeDefined();
  });

  it("gives way to the line the last screen left: never both in the same spot", async () => {
    state.flash = { message: "Você saiu da conta." };
    renderRouted(<ShellOverlays />);
    expect(await screen.findByText("Você saiu da conta.")).toBeDefined();
    expect(screen.queryByRole("complementary", { name: "Use como app" })).toBeNull();
  });

  it("puts a new build first of all", async () => {
    state.update = true;
    state.flash = { message: "Você saiu da conta." };
    renderRouted(<ShellOverlays />);
    expect(await screen.findByText("Há uma versão nova do BrazCar.")).toBeDefined();
    expect(screen.queryByText("Você saiu da conta.")).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Use como app" })).toBeNull();
  });
});
