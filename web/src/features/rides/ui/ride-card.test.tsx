// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderRouted } from "@/shared/testing/render-routed";

import { anonymousRide, faredRide, importedRide, openRide } from "../app/ride.fixture";
import { formatTime } from "./format";
import { RideCard } from "./ride-card";

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

    await waitFor(() => {
      expect(screen.getByText("via WhatsApp")).toBeDefined();
    });
    expect(screen.getByText("Zé do grupo")).toBeDefined();
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

  it("draws no driver name for a viewer without a session, and shows the rest of the ride", async () => {
    renderRouted(<RideCard ride={anonymousRide} />);

    await waitFor(() => {
      expect(screen.getByText("R$ 7")).toBeDefined();
    });
    expect(screen.queryByText("Ana")).toBeNull();
    expect(screen.getByText(formatTime(anonymousRide.departureAt))).toBeDefined();
    expect(screen.getByText("Brazlândia")).toBeDefined();
    expect(screen.getByText("3 vagas")).toBeDefined();
  });
});
