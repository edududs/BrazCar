import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/shared/adapters/api/client";
import type { components } from "@/shared/adapters/api/schema";

import type { BoardFilters } from "../domain/board";
import { RideRequestError } from "../domain/ride";
import {
  cancelRide,
  changeSeats,
  editRide,
  fetchBoard,
  fetchBoardRevision,
  fetchMyRides,
  fetchRide,
  publishRide,
  repeatRide,
  requestContact,
} from "./rides-gateway";

vi.mock("@/shared/adapters/api/client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
}));

const get = vi.mocked(apiClient.GET);
const post = vi.mocked(apiClient.POST);
const patch = vi.mocked(apiClient.PATCH);

afterEach(() => {
  vi.resetAllMocks();
});

const RIDE_OUT: components["schemas"]["RideOut"] = {
  id: "r1",
  driver_name: "Ana",
  car: { model: "Gol", color: "prata" },
  origin: "published",
  origin_message: null,
  stops: [{ place_id: "brazlandia", label: "Brazlândia", fare: null }],
  notes: "Levo mala pequena.",
  departure_at: "2026-01-15T09:00:00-03:00",
  seats_available: 3,
  price: "7.00",
  has_fares: false,
  payment_methods: ["cash", "pix"],
  status: "open",
  actions: {
    can_edit: true,
    can_change_seats: true,
    can_cancel: true,
    can_repeat: true,
    can_contact: false,
    delay_until: null,
  },
  is_mine: true,
};

const RIDE = {
  id: "r1",
  driverName: "Ana",
  car: { model: "Gol", color: "prata" },
  origin: "published",
  originMessage: null,
  stops: [{ placeId: "brazlandia", label: "Brazlândia", fare: null }],
  notes: "Levo mala pequena.",
  departureAt: "2026-01-15T09:00:00-03:00",
  seatsAvailable: 3,
  price: "7.00",
  hasFares: false,
  paymentMethods: ["cash", "pix"],
  status: "open",
  actions: {
    canEdit: true,
    canChangeSeats: true,
    canCancel: true,
    canRepeat: true,
    canContact: false,
    delayUntil: null,
  },
  isMine: true,
};

const FILTERS: BoardFilters = {
  day: null,
  text: null,
  withSeats: false,
  maxPrice: null,
  fromTime: null,
};

describe("fetchBoard", () => {
  it("translates the query and every card the API sends", async () => {
    get.mockResolvedValue({
      data: [RIDE_OUT],
      error: undefined,
      response: { status: 200 },
    });
    const controller = new AbortController();

    const rides = await fetchBoard(FILTERS, controller.signal);

    expect(rides).toEqual([RIDE]);
    expect(get).toHaveBeenCalledWith("/api/rides", {
      params: { query: { day: null, q: null, with_seats: false, max_price: null, from: null } },
      signal: controller.signal,
    });
  });

  it("throws the API's own refusal, with its status and message", async () => {
    get.mockResolvedValue({
      data: undefined,
      error: { detail: "confira os filtros" },
      response: { status: 422 },
    });

    await expect(fetchBoard(FILTERS, new AbortController().signal)).rejects.toMatchObject({
      status: 422,
      message: "confira os filtros",
    });
  });

  it("falls back to a generic message when the API gives no detail", async () => {
    get.mockResolvedValue({
      data: undefined,
      error: undefined,
      response: { status: 500 },
    });

    const error = await fetchBoard(FILTERS, new AbortController().signal).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(RideRequestError);
    expect((error as RideRequestError).message).toBe("Não foi possível concluir.");
  });

  it("turns a list of field errors into a plain word for the screen", async () => {
    get.mockResolvedValue({
      data: undefined,
      error: { detail: [{ type: "missing", loc: ["query", "day"], msg: "Field required" }] },
      response: { status: 422 },
    });

    const error = await fetchBoard(FILTERS, new AbortController().signal).catch(
      (caught: unknown) => caught,
    );

    expect((error as RideRequestError).message).toBe("Confira os dados informados.");
  });
});

describe("fetchRide", () => {
  it("fetches by id and translates the card", async () => {
    get.mockResolvedValue({ data: RIDE_OUT, error: undefined, response: { status: 200 } });
    await expect(fetchRide("r1", new AbortController().signal)).resolves.toEqual(RIDE);
    expect(get).toHaveBeenCalledWith("/api/rides/{ride_id}", {
      params: { path: { ride_id: "r1" } },
      signal: expect.any(AbortSignal) as AbortSignal,
    });
  });
});

describe("fetchMyRides and fetchBoardRevision", () => {
  it("fetchMyRides translates every card", async () => {
    get.mockResolvedValue({
      data: [RIDE_OUT],
      error: undefined,
      response: { status: 200 },
    });
    await expect(fetchMyRides(new AbortController().signal)).resolves.toEqual([RIDE]);
  });

  it("fetchBoardRevision returns the number as is", async () => {
    get.mockResolvedValue({
      data: { revision: 7 },
      error: undefined,
      response: { status: 200 },
    });
    await expect(fetchBoardRevision(new AbortController().signal)).resolves.toBe(7);
  });
});

describe("publishRide", () => {
  it("sends a catalog stop, a free text stop, and clears blank notes", async () => {
    post.mockResolvedValue({
      data: RIDE_OUT,
      error: undefined,
      response: { status: 201 },
    });

    await publishRide({
      carId: "c1",
      stops: [
        { placeId: "brazlandia", text: "", fare: "" },
        { placeId: null, text: "Incra 8", fare: "9.00" },
      ],
      departureAt: "2026-01-15T09:00:00-03:00",
      seatsAvailable: 2,
      price: "7.00",
      paymentMethods: ["cash"],
      notes: "   ",
    });

    expect(post).toHaveBeenCalledWith("/api/rides", {
      body: {
        car_id: "c1",
        stops: [
          { place_id: "brazlandia", fare: null },
          { text: "Incra 8", fare: "9.00" },
        ],
        departure_at: "2026-01-15T09:00:00-03:00",
        seats_available: 2,
        price: "7.00",
        payment_methods: ["cash"],
        notes: null,
      },
    });
  });
});

describe("editRide", () => {
  it("sends only the changed fields, empty notes included (they erase, D-129)", async () => {
    patch.mockResolvedValue({
      data: RIDE_OUT,
      error: undefined,
      response: { status: 200 },
    } as never);

    await editRide("r1", { price: "8.00", notes: "" });

    expect(patch).toHaveBeenCalledWith("/api/rides/{ride_id}", {
      params: { path: { ride_id: "r1" } },
      body: { price: "8.00", notes: "" },
    });
  });

  it("omits every field the caller did not touch", async () => {
    patch.mockResolvedValue({
      data: RIDE_OUT,
      error: undefined,
      response: { status: 200 },
    } as never);

    await editRide("r1", {});

    expect(patch).toHaveBeenCalledWith("/api/rides/{ride_id}", {
      params: { path: { ride_id: "r1" } },
      body: {},
    });
  });
});

describe("changeSeats, cancelRide and repeatRide", () => {
  it("changeSeats posts the new count", async () => {
    post.mockResolvedValue({
      data: RIDE_OUT,
      error: undefined,
      response: { status: 200 },
    });
    await changeSeats("r1", 0);
    expect(post).toHaveBeenCalledWith("/api/rides/{ride_id}/seats", {
      params: { path: { ride_id: "r1" } },
      body: { seats_available: 0 },
    });
  });

  it("cancelRide posts with no body", async () => {
    post.mockResolvedValue({
      data: RIDE_OUT,
      error: undefined,
      response: { status: 200 },
    });
    await cancelRide("r1");
    expect(post).toHaveBeenCalledWith("/api/rides/{ride_id}/cancel", {
      params: { path: { ride_id: "r1" } },
    });
  });

  it("repeatRide posts the new departure", async () => {
    post.mockResolvedValue({
      data: RIDE_OUT,
      error: undefined,
      response: { status: 201 },
    });
    await repeatRide("r1", "2026-01-16T09:00:00-03:00");
    expect(post).toHaveBeenCalledWith("/api/rides/{ride_id}/repeat", {
      params: { path: { ride_id: "r1" } },
      body: { departure_at: "2026-01-16T09:00:00-03:00" },
    });
  });
});

describe("requestContact", () => {
  it("translates the API's contact payload", async () => {
    post.mockResolvedValue({
      data: {
        whatsapp_url: "https://wa.me/5561999990001",
        phone_display: "(61) 99999-0001",
        plate: "ABC1234",
      },
      error: undefined,
      response: { status: 200 },
    });

    await expect(requestContact("r1")).resolves.toEqual({
      whatsappUrl: "https://wa.me/5561999990001",
      phoneDisplay: "(61) 99999-0001",
      plate: "ABC1234",
    });
  });

  it("throws the API's refusal, e.g. the daily limit (D-097)", async () => {
    post.mockResolvedValue({
      data: undefined,
      error: { detail: "muitos pedidos de contato; tente depois" },
      response: { status: 429 },
    });

    await expect(requestContact("r1")).rejects.toMatchObject({
      status: 429,
      message: "muitos pedidos de contato; tente depois",
    });
  });
});
