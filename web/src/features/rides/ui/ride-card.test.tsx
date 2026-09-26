// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as accountsGateway from "@/features/accounts/adapters/accounts-gateway";
import type { Account } from "@/features/accounts/domain/account";
import { renderRouted } from "@/shared/testing/render-routed";

import { anonymousRide, faredRide, importedRide, openRide } from "../app/ride.fixture";
import { formatTime } from "./format";
import { RideCard } from "./ride-card";

vi.mock("@/features/accounts/adapters/accounts-gateway");

const passenger: Account = {
  id: "a1",
  phone: "+5561999990001",
  phoneDisplay: "(61) 99999-0001",
  displayName: "Passageira",
  email: null,
  emailConfirmed: true,
  requiredAction: null,
  cars: [],
  canDrive: false,
};
const mockedAccounts = vi.mocked(accountsGateway);

/** Every skeleton `PersonalData` draws, never a name in disguise. */
function skeletonsIn(container: HTMLElement) {
  return container.querySelectorAll('[class*="animate-pulse"]');
}

beforeEach(() => {
  vi.resetAllMocks();
  // Signed in by default: most fixtures carry a real driver name, which only a session unlocks.
  mockedAccounts.fetchCurrentAccount.mockResolvedValue(passenger);
});

describe("RideCard", () => {
  it("shows the driver with the car for a ride published here", async () => {
    renderRouted(<RideCard ride={openRide} />);

    await waitFor(() => {
      expect(screen.getByRole("link").textContent).toContain("Ana · Gol prata");
    });
    expect(screen.queryByText("via WhatsApp")).toBeNull();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/caronas/r1");
  });

  it("marks a ride read from WhatsApp and shows no car", async () => {
    renderRouted(<RideCard ride={importedRide} />);

    // "via WhatsApp" draws with no session at all; wait for the driver's name instead, since only
    // that one is behind the session query settling.
    await waitFor(() => {
      expect(screen.getByText("Zé do grupo")).toBeDefined();
    });
    expect(screen.getByText("via WhatsApp")).toBeDefined();
    expect(screen.queryByText(/Gol/)).toBeNull();
  });

  it("says the price is a starting one and shows the notes on one line", async () => {
    renderRouted(<RideCard ride={faredRide} />);

    await waitFor(() => {
      expect(screen.getByText("a partir de")).toBeDefined();
      expect(screen.getByText("R$ 7")).toBeDefined();
    });
    const notes = screen.getByText("“Levo mala pequena e aviso no grupo se atrasar.”");
    expect(notes.className).toContain("truncate");
  });

  it("shows a plain price and no notes line when the ride has neither", async () => {
    renderRouted(<RideCard ride={openRide} />);

    await waitFor(() => {
      expect(screen.getByText("R$ 7")).toBeDefined();
    });
    expect(screen.queryByText(/a partir de/)).toBeNull();
  });

  it("draws a skeleton in place of the driver while the session is still checking", async () => {
    mockedAccounts.fetchCurrentAccount.mockImplementation(() => new Promise(() => undefined));

    const { container } = renderRouted(<RideCard ride={openRide} />);

    // The account query never settles in this test; this waits only for the router to mount.
    await waitFor(() => {
      expect(skeletonsIn(container).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText("Ana")).toBeNull();
  });

  it("draws a skeleton for the driver, and shows the rest of the ride, for a viewer without a session", async () => {
    mockedAccounts.fetchCurrentAccount.mockResolvedValue(null);

    const { container } = renderRouted(<RideCard ride={anonymousRide} />);

    await waitFor(() => {
      expect(skeletonsIn(container).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText("Ana")).toBeNull();
    expect(screen.getByText(formatTime(anonymousRide.departureAt))).toBeDefined();
    expect(screen.getByText("Brazlândia")).toBeDefined();
    expect(screen.getByText("3 vagas")).toBeDefined();
  });
});
