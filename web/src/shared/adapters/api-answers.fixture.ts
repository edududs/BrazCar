/** The API's own answers, typed by the contract, for tests that run the whole app. Test data only. */
import type { components } from "./api/schema";

type AccountOut = components["schemas"]["AccountOut"];
type RideOut = components["schemas"]["RideOut"];

/** A person with a car, so every door of the app is open. */
export const driverOut: AccountOut = {
  id: "a1",
  phone: "+5561999990001",
  phone_display: "(61) 99999-0001",
  display_name: "Ana Souza",
  email: "ana@example.com",
  email_confirmed: true,
  required_action: null,
  cars: [{ id: "c1", model: "Gol", color: "prata", plate: "ABC1D23" }],
  can_drive: true,
  terms_accepted_at: "2026-09-01T10:00:00-03:00",
};

/** A ride on the board, a day in the future so no clock makes it leave. */
export const rideOut: RideOut = {
  id: "r1",
  driver_name: "Bruno Lima",
  car: { model: "Onix", color: "branco" },
  origin: "published",
  origin_message: null,
  stops: [
    { place_id: "brazlandia", label: "Brazlândia", fare: null },
    { place_id: "esplanada", label: "Esplanada", fare: null },
  ],
  notes: null,
  departure_at: "2099-09-23T07:00:00-03:00",
  seats_available: 3,
  price: "7.00",
  has_fares: false,
  payment_methods: ["pix"],
  status: "open",
  actions: {
    can_edit: false,
    can_change_seats: false,
    can_cancel: false,
    can_repeat: false,
    can_contact: true,
    delay_until: null,
  },
  is_mine: false,
};

/** The owner's view of the same ride. */
export const myRideOut: RideOut = {
  ...rideOut,
  driver_name: "Ana Souza",
  is_mine: true,
  actions: {
    can_edit: true,
    can_change_seats: true,
    can_cancel: true,
    can_repeat: true,
    can_contact: false,
    delay_until: null,
  },
};
