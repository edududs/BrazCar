// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderRouted } from "@/shared/testing/render-routed";

import type { RideDraft } from "../domain/ride";
import { RideForm } from "./ride-form";

vi.mock("@/features/places/adapters/places-gateway");

const draft: RideDraft = {
  carId: "",
  stops: [
    { placeId: null, text: "Brazlândia", fare: "" },
    { placeId: null, text: "Incra 8", fare: "" },
  ],
  departureAt: "2026-09-23T10:00:00.000Z",
  seatsAvailable: 3,
  price: "7.00",
  paymentMethods: ["pix"],
  notes: "",
};

function show(onSubmit: (draft: RideDraft) => Promise<unknown>) {
  return renderRouted(
    <RideForm initial={draft} busy={false} submitLabel="Salvar" onSubmit={onSubmit} />,
  );
}

describe("RideForm", () => {
  it("counts the notes against the limit and sends them", async () => {
    const onSubmit = vi.fn<(draft: RideDraft) => Promise<unknown>>(() => Promise.resolve());
    show(onSubmit);

    const notes = await screen.findByLabelText(/^Observações/);
    fireEvent.change(notes, { target: { value: "Levo mala" } });

    expect(screen.getByText("9/500")).toBeDefined();
    expect(notes.getAttribute("maxlength")).toBe("500");

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0]?.[0].notes).toBe("Levo mala");
  });

  it("asks no fare for the stop the ride leaves from", async () => {
    show(() => Promise.resolve());

    await screen.findByLabelText(/^Observações/);

    expect(screen.getAllByLabelText("Preço até aqui")).toHaveLength(1);
  });

  it("drops the price field once a stop carries a fare, and sends the fare (D-131)", async () => {
    const onSubmit = vi.fn<(draft: RideDraft) => Promise<unknown>>(() => Promise.resolve());
    show(onSubmit);

    const fare = await screen.findByLabelText("Preço até aqui");
    expect(screen.getByLabelText("Preço")).toBeDefined();

    fireEvent.change(fare, { target: { value: "9.00" } });

    await waitFor(() => {
      expect(screen.queryByLabelText("Preço")).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0]?.[0].stops.map((stop) => stop.fare)).toEqual(["", "9.00"]);
  });

  it("shows what the API refused", async () => {
    show(() => Promise.reject(new Error("boom")));

    fireEvent.click(await screen.findByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined();
    });
  });
});
