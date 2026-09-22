import type { Ride } from "../domain/ride";

/** A ride as the board hands it to a passenger: open, with room, not theirs. Test data only. */
export const openRide: Ride = {
  id: "r1",
  driverName: "Ana",
  carModel: "Gol",
  carColor: "prata",
  stops: [
    { placeId: "brazlandia", label: "Brazlândia" },
    { placeId: null, label: "Incra 8" },
  ],
  departureAt: "2026-09-23T07:00:00-03:00",
  seatsAvailable: 3,
  price: "7.00",
  paymentMethods: ["pix"],
  status: "open",
  actions: {
    canEdit: false,
    canChangeSeats: false,
    canCancel: false,
    canRepeat: false,
    canContact: true,
    delayUntil: null,
  },
  isMine: false,
};
