import { beforeEach, describe, expect, it, vi } from "vitest";

import type { components } from "@/shared/adapters/api/schema";

import { noFilters } from "../domain/board";
import { type RideDraft, RideRequestError } from "../domain/ride";
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

const api = await vi.hoisted(async () => {
  const { installFakeApi } = await import("@/shared/testing/fake-api");
  return installFakeApi();
});

type RideOut = components["schemas"]["RideOut"];

const rideOut: RideOut = {
  id: "0b1c",
  driver_name: "Ana",
  car: { model: "Gol", color: "prata" },
  origin: "whatsapp",
  origin_message: {
    text: "03 VAGAS saindo às 07:00",
    group_label: "Rota Plano Piloto",
    sent_at: "2026-09-22T21:15:00-03:00",
  },
  stops: [
    { place_id: "brazlandia", label: "Brazlândia", fare: null },
    { place_id: null, label: "Incra 8", fare: "9.00" },
  ],
  notes: "Levo mala pequena.",
  departure_at: "2026-09-23T07:00:00-03:00",
  seats_available: 3,
  price: "9.00",
  has_fares: true,
  payment_methods: ["pix", "cash"],
  status: "open",
  actions: {
    can_edit: true,
    can_change_seats: true,
    can_cancel: false,
    can_repeat: false,
    can_contact: true,
    delay_until: "2026-09-23T07:30:00-03:00",
  },
  is_mine: true,
};

const draft: RideDraft = {
  carId: "car-1",
  stops: [
    { placeId: "brazlandia", text: "", fare: "" },
    { placeId: null, text: "Incra 8", fare: " 9.00 " },
  ],
  departureAt: "2026-09-23T07:00:00-03:00",
  seatsAvailable: 3,
  price: "9.00",
  paymentMethods: ["pix"],
  notes: "   ",
};

const signal = new AbortController().signal;

/** Awaits a promise that must fail and hands back what it failed with. */
async function refusal(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("The call was expected to fail.");
}

beforeEach(() => {
  api.reset();
});

describe("reading the board", () => {
  it("sends only the filters that are set, with the API's own names", async () => {
    api.answer(200, []);

    await fetchBoard(
      { day: "2026-09-23", text: "incra", withSeats: true, maxPrice: "8.00", fromTime: "07:30" },
      signal,
    );

    const sent = api.last();
    expect(sent.method).toBe("GET");
    expect(sent.path).toBe("/api/rides");
    expect(Object.fromEntries(sent.query)).toEqual({
      day: "2026-09-23",
      q: "incra",
      with_seats: "true",
      max_price: "8.00",
      from: "07:30",
    });
  });

  it("leaves unset filters out of the query instead of sending them empty", async () => {
    api.answer(200, []);

    await fetchBoard(noFilters, signal);

    expect([...api.last().query.keys()]).toEqual(["with_seats"]);
  });

  it("carries the session cookie on every call (ADR-0012)", async () => {
    api.answer(200, []);

    await fetchBoard(noFilters, signal);

    expect(api.last().credentials).toBe("include");
  });

  it("turns the API's ride into the screen's, field by field", async () => {
    api.answer(200, [rideOut]);

    const [ride] = await fetchBoard(noFilters, signal);

    expect(ride).toEqual({
      id: "0b1c",
      driverName: "Ana",
      car: { model: "Gol", color: "prata" },
      origin: "whatsapp",
      originMessage: {
        text: "03 VAGAS saindo às 07:00",
        groupLabel: "Rota Plano Piloto",
        sentAt: "2026-09-22T21:15:00-03:00",
      },
      stops: [
        { placeId: "brazlandia", label: "Brazlândia", fare: null },
        { placeId: null, label: "Incra 8", fare: "9.00" },
      ],
      notes: "Levo mala pequena.",
      departureAt: "2026-09-23T07:00:00-03:00",
      seatsAvailable: 3,
      price: "9.00",
      hasFares: true,
      paymentMethods: ["pix", "cash"],
      status: "open",
      actions: {
        canEdit: true,
        canChangeSeats: true,
        canCancel: false,
        canRepeat: false,
        canContact: true,
        delayUntil: "2026-09-23T07:30:00-03:00",
      },
      isMine: true,
    });
  });

  it("keeps a ride without a car and without original words as null, not as an empty object", async () => {
    api.answer(200, [{ ...rideOut, car: null, origin: "published", origin_message: null }]);

    const [ride] = await fetchBoard(noFilters, signal);

    expect(ride?.car).toBeNull();
    expect(ride?.originMessage).toBeNull();
  });

  it("never lets a phone or a plate slip into the card, even if the API sent one", async () => {
    api.answer(200, [{ ...rideOut, phone: "+5561999990001", plate: "ABC1D23" }]);

    const [ride] = await fetchBoard(noFilters, signal);

    expect(JSON.stringify(ride)).not.toMatch(/5561999990001|ABC1D23/);
  });

  it("reads one ride, my rides and the revision from their own paths", async () => {
    api.answer(200, rideOut);
    api.answer(200, [rideOut, rideOut]);
    api.answer(200, { revision: 42 });

    const ride = await fetchRide("0b1c", signal);
    expect(api.last().path).toBe("/api/rides/0b1c");
    const mine = await fetchMyRides(signal);
    expect(api.last().path).toBe("/api/rides/mine");
    const revision = await fetchBoardRevision(signal);
    expect(api.last().path).toBe("/api/rides/revision");

    expect(ride.id).toBe("0b1c");
    expect(mine).toHaveLength(2);
    expect(revision).toBe(42);
  });
});

describe("refusals and failures", () => {
  it("a 4xx with a sentence becomes a RideRequestError with that sentence and the status", async () => {
    api.answer(404, { detail: "Carona não encontrada." });

    const error = await refusal(fetchRide("gone", signal));

    expect(error).toBeInstanceOf(RideRequestError);
    expect(error).toMatchObject({ status: 404, message: "Carona não encontrada." });
  });

  it("a validation list (422) becomes one line asking to check the data", async () => {
    api.answer(422, { detail: [{ loc: ["body", "price"], msg: "bad", type: "value_error" }] });

    const error = await refusal(publishRide(draft));

    expect(error).toMatchObject({ status: 422, message: "Confira os dados informados." });
  });

  it("a 5xx page from a proxy, not JSON, still becomes a refusal with a generic sentence", async () => {
    api.answerText(502, "<html><body>Bad Gateway</body></html>");

    const error = await refusal(fetchBoard(noFilters, signal));

    expect(error).toBeInstanceOf(RideRequestError);
    expect(error).toMatchObject({ status: 502, message: "Não foi possível concluir." });
  });

  it("an error body with a detail that is neither text nor a list falls back to the generic sentence", async () => {
    api.answer(409, { detail: { code: 1 } });

    const error = await refusal(cancelRide("0b1c"));

    expect(error).toMatchObject({ status: 409, message: "Não foi possível concluir." });
  });

  it("with the network down the failure is not dressed as a refusal of the API", async () => {
    api.dropConnection();

    const error = await refusal(fetchMyRides(signal));

    expect(error).toBeInstanceOf(TypeError);
    expect(error).not.toBeInstanceOf(RideRequestError);
  });

  it("a success whose body is cut in half rejects instead of handing back a broken ride", async () => {
    api.answerText(200, '{"id": "0b1c", "driver_', "application/json");

    const error = await refusal(fetchRide("0b1c", signal));

    expect(error).toBeInstanceOf(SyntaxError);
  });
});

describe("the owner's actions", () => {
  it("publishes with the API's names, a place by id, free text by text, and blank notes as null", async () => {
    api.answer(201, rideOut);

    const ride = await publishRide(draft);

    const sent = api.last();
    expect(sent.method).toBe("POST");
    expect(sent.path).toBe("/api/rides");
    expect(sent.contentType).toBe("application/json");
    expect(sent.body).toEqual({
      car_id: "car-1",
      stops: [
        { place_id: "brazlandia", fare: null },
        { text: "Incra 8", fare: "9.00" },
      ],
      departure_at: "2026-09-23T07:00:00-03:00",
      seats_available: 3,
      price: "9.00",
      payment_methods: ["pix"],
      notes: null,
    });
    expect(ride.id).toBe("0b1c");
  });

  it("publishes written notes as they are", async () => {
    api.answer(201, rideOut);

    await publishRide({ ...draft, notes: "Levo mala pequena." });

    expect(api.last().body).toMatchObject({ notes: "Levo mala pequena." });
  });

  it("an edit sends only what changed", async () => {
    api.answer(200, rideOut);

    await editRide("0b1c", { price: "8.00" });

    const sent = api.last();
    expect(sent.method).toBe("PATCH");
    expect(sent.path).toBe("/api/rides/0b1c");
    expect(sent.body).toEqual({ price: "8.00" });
  });

  it("an edit with nothing changed sends an empty body", async () => {
    api.answer(200, rideOut);

    await editRide("0b1c", {});

    expect(api.last().body).toEqual({});
  });

  it("an edit of everything maps every field, and empty notes go as empty to erase them (D-129)", async () => {
    api.answer(200, rideOut);

    await editRide("0b1c", {
      stops: draft.stops,
      departureAt: "2026-09-23T07:10:00-03:00",
      price: "9.00",
      paymentMethods: ["cash"],
      notes: "",
    });

    expect(api.last().body).toEqual({
      stops: [
        { place_id: "brazlandia", fare: null },
        { text: "Incra 8", fare: "9.00" },
      ],
      departure_at: "2026-09-23T07:10:00-03:00",
      price: "9.00",
      payment_methods: ["cash"],
      notes: "",
    });
  });

  it("changes seats, cancels and repeats on the ride's own paths", async () => {
    api.answer(200, rideOut);
    api.answer(200, rideOut);
    api.answer(201, rideOut);

    await changeSeats("0b1c", 2);
    expect(api.last()).toMatchObject({
      method: "POST",
      path: "/api/rides/0b1c/seats",
      body: { seats_available: 2 },
    });
    await cancelRide("0b1c");
    expect(api.last()).toMatchObject({ path: "/api/rides/0b1c/cancel", body: undefined });
    await repeatRide("0b1c", "2026-09-24T07:00:00-03:00");
    expect(api.last()).toMatchObject({
      path: "/api/rides/0b1c/repeat",
      body: { departure_at: "2026-09-24T07:00:00-03:00" },
    });
  });

  it("each owner action passes the API's refusal on", async () => {
    for (const call of [
      () => editRide("0b1c", {}),
      () => changeSeats("0b1c", 9),
      () => repeatRide("0b1c", "x"),
    ]) {
      api.answer(422, { detail: "Não dá." });
      await expect(call()).rejects.toMatchObject({ status: 422, message: "Não dá." });
    }
  });
});

describe("contact", () => {
  it("is the one call that brings the phone and the plate (ADR-0006)", async () => {
    api.answer(200, {
      whatsapp_url: "https://wa.me/5561999990001",
      phone_display: "(61) 99999-0001",
      plate: "ABC1D23",
    });

    const contact = await requestContact("0b1c");

    expect(api.last()).toMatchObject({ method: "POST", path: "/api/rides/0b1c/contact" });
    expect(contact).toEqual({
      whatsappUrl: "https://wa.me/5561999990001",
      phoneDisplay: "(61) 99999-0001",
      plate: "ABC1D23",
    });
  });

  it("a contact refused for lack of a session says why", async () => {
    api.answer(401, { detail: "Entre para ver o contato." });

    await expect(requestContact("0b1c")).rejects.toMatchObject({
      status: 401,
      message: "Entre para ver o contato.",
    });
  });
});
