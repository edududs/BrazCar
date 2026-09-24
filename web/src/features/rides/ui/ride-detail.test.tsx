// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderRouted } from "@/shared/testing/render-routed";

import type { RideActions } from "../app/use-ride";
import { importedRide, openRide } from "../app/ride.fixture";
import type { Ride } from "../domain/ride";
import { RideDetail } from "./ride-detail";

vi.mock("../adapters/rides-gateway");

function idle(ride: Ride): RideActions {
  const unreachable = () => Promise.reject(new Error("not in this test"));
  return {
    ride,
    status: "ready",
    changeSeats: unreachable,
    edit: unreachable,
    cancel: unreachable,
    repeat: unreachable,
    busy: false,
  };
}

function show(ride: Ride) {
  return renderRouted(
    <RideDetail
      ride={ride}
      session={{ status: "anonymous" }}
      actions={idle(ride)}
      onRepeated={vi.fn()}
    />,
  );
}

describe("RideDetail", () => {
  it("shows the original message and the group for a ride read from WhatsApp", async () => {
    show(importedRide);

    await waitFor(() => {
      expect(screen.getByText("Mensagem original")).toBeDefined();
    });
    expect(screen.getByText(/03 VAGAS/).textContent).toContain("7,00 Dinheiro ou PIX");
    expect(screen.getByText(/Rota Plano Piloto/)).toBeDefined();
    expect(screen.getByText("via WhatsApp")).toBeDefined();
    expect(screen.queryByText(/Gol/)).toBeNull();
    expect(screen.queryByText("Sua carona")).toBeNull();
  });

  it("shows the car and no message block for a ride published here", async () => {
    show(openRide);

    await waitFor(() => {
      expect(screen.getByText(/Ana · Gol, prata/)).toBeDefined();
    });
    expect(screen.queryByText("Mensagem original")).toBeNull();
    expect(screen.queryByText("via WhatsApp")).toBeNull();
  });
});
