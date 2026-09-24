// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderRouted } from "@/shared/testing/render-routed";

import { faredRide, importedRide, openRide } from "../app/ride.fixture";
import { RideCard } from "./ride-card";

describe("RideCard", () => {
  it("shows the driver with the car for a ride published here", async () => {
    renderRouted(<RideCard ride={openRide} />);

    await waitFor(() => {
      expect(screen.getByText(/Ana · Gol, prata/)).toBeDefined();
    });
    expect(screen.queryByText("via WhatsApp")).toBeNull();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/caronas/r1");
  });

  it("marks a ride read from WhatsApp and shows no car", async () => {
    renderRouted(<RideCard ride={importedRide} />);

    await waitFor(() => {
      expect(screen.getByText("via WhatsApp")).toBeDefined();
    });
    expect(screen.getByText("Zé do grupo")).toBeDefined();
    expect(screen.queryByText(/Gol/)).toBeNull();
  });

  it("says the price is a starting one and shows the notes on one line", async () => {
    renderRouted(<RideCard ride={faredRide} />);

    await waitFor(() => {
      expect(screen.getByText(/a partir de R\$\s?7,00/)).toBeDefined();
    });
    const notes = screen.getByText("Levo mala pequena e aviso no grupo se atrasar.");
    expect(notes.className).toContain("truncate");
  });

  it("shows a plain price and no notes line when the ride has neither", async () => {
    renderRouted(<RideCard ride={openRide} />);

    await waitFor(() => {
      expect(screen.getByText(/R\$\s?7,00/)).toBeDefined();
    });
    expect(screen.queryByText(/a partir de/)).toBeNull();
  });
});
