// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Session } from "@/features/accounts/domain/session";
import { renderRouted } from "@/shared/testing/render-routed";

import * as gateway from "../adapters/rides-gateway";
import type { RideActions } from "../app/use-ride";
import { faredRide, importedRide, openRide } from "../app/ride.fixture";
import { RideRequestError, type Ride } from "../domain/ride";
import { RideDetail } from "./ride-detail";

vi.mock("../adapters/rides-gateway");
const mocked = vi.mocked(gateway);

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

const signedIn: Session = {
  status: "signed-in",
  account: {
    id: "a1",
    displayName: "Passageira",
    phone: "+5561999990002",
    phoneDisplay: "(61) 99999-0002",
    email: null,
    cars: [],
    canDrive: false,
  },
};

function show(ride: Ride, session: Session = { status: "anonymous" }) {
  return renderRouted(
    <RideDetail ride={ride} session={session} actions={idle(ride)} onRepeated={vi.fn()} />,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("RideDetail", () => {
  it("shows the original message and the group for a ride read from WhatsApp", async () => {
    show(importedRide);

    await waitFor(() => {
      expect(screen.getByText("Mensagem original")).toBeDefined();
    });
    expect(screen.getByText(/03 VAGAS/).textContent).toContain("7,00 Dinheiro ou PIX");
    expect(screen.getByText(/Rota Plano Piloto/)).toBeDefined();
    expect(screen.getByText("via WhatsApp")).toBeDefined();
    expect(screen.getByText("Anunciou num grupo de WhatsApp")).toBeDefined();
    expect(screen.queryByText(/Gol/)).toBeNull();
    expect(screen.queryByText("Sua carona")).toBeNull();
  });

  it("shows the car and no message block for a ride published here", async () => {
    show(openRide);

    await waitFor(() => {
      expect(screen.getByText("Gol prata")).toBeDefined();
    });
    expect(screen.queryByText("Mensagem original")).toBeNull();
    expect(screen.queryByText("via WhatsApp")).toBeNull();
  });

  it("draws the route as a line, the fare beside each priced stop, and the notes in full", async () => {
    show(faredRide);

    await waitFor(() => {
      expect(screen.getByText("Incra 8")).toBeDefined();
    });
    const stops = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent.replace(/\s+/g, " "));
    expect(stops).toEqual(["Sai deBrazlândia", "Incra 8R$ 9,00", "Vai paraEsplanadaR$ 7,00"]);
    expect(screen.getByText("a partir de")).toBeDefined();
    expect(screen.getByText("Levo mala pequena e aviso no grupo se atrasar.")).toBeDefined();
    expect(screen.getByRole("heading", { name: "Observações de Ana" })).toBeDefined();
  });

  it("invites a visitor to sign in, right where the action goes", async () => {
    show(openRide);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Entrar para pedir contato" })).toBeDefined();
    });
    expect(screen.getByText(/só aparecem para quem entra/)).toBeDefined();
  });

  it("reveals the phone and the plate on the driver's card once the API hands them out", async () => {
    mocked.requestContact.mockResolvedValue({
      whatsappUrl: "https://wa.me/5561999990001?text=Oi",
      phoneDisplay: "(61) 99999-0001",
      plate: "ABC1234",
    });
    show(openRide, signedIn);

    const ask = await screen.findByRole("button", { name: "Pedir contato" });
    fireEvent.click(ask);

    const link = await screen.findByRole("link", { name: "Falar no WhatsApp" });
    expect(link.getAttribute("href")).toBe("https://wa.me/5561999990001?text=Oi");
    expect(screen.getByText("(61) 99999-0001")).toBeDefined();
    expect(screen.getByLabelText("Placa ABC1234")).toBeDefined();
    expect(mocked.requestContact).toHaveBeenCalledWith("r1");
  });

  it("says there is no plate for a driver the platform only knows by phone", async () => {
    mocked.requestContact.mockResolvedValue({
      whatsappUrl: "https://wa.me/5561999990042",
      phoneDisplay: "(61) 99999-0042",
      plate: null,
    });
    show(importedRide, signedIn);

    fireEvent.click(await screen.findByRole("button", { name: "Pedir contato" }));

    await screen.findByRole("link", { name: "Falar no WhatsApp" });
    expect(screen.getByText(/Sem placa cadastrada/)).toBeDefined();
    expect(screen.queryByLabelText(/^Placa/)).toBeNull();
  });

  it("shows the refusal and keeps the button", async () => {
    mocked.requestContact.mockRejectedValue(
      new RideRequestError(429, "muitos pedidos de contato; tente depois"),
    );
    show(openRide, signedIn);

    fireEvent.click(await screen.findByRole("button", { name: "Pedir contato" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("muitos pedidos de contato");
    });
    expect(screen.getByRole("button", { name: "Pedir contato" })).toBeDefined();
  });
});
