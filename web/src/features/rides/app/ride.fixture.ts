import type { Ride } from "../domain/ride";

/** A ride as the board hands it to a passenger: open, with room, not theirs. Test data only. */
export const openRide: Ride = {
  id: "r1",
  driverName: "Ana",
  car: { model: "Gol", color: "prata" },
  origin: "published",
  originMessage: null,
  stops: [
    { placeId: "brazlandia", label: "Brazlândia", fare: null },
    { placeId: null, label: "Incra 8", fare: null },
  ],
  notes: null,
  departureAt: "2026-09-23T07:00:00-03:00",
  seatsAvailable: 3,
  price: "7.00",
  hasFares: false,
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

/** A ride read from a WhatsApp group (ADR-0015): no car, nobody's, the original words attached. */
export const importedRide: Ride = {
  ...openRide,
  id: "r2",
  driverName: "Zé do grupo",
  car: null,
  origin: "whatsapp",
  originMessage: {
    text: "03 VAGAS\nSaindo às 07:00\nBrazlândia\nIncra 8\n7,00 Dinheiro ou PIX",
    groupLabel: "Rota Plano Piloto",
    sentAt: "2026-09-22T21:15:00-03:00",
  },
};

/** A ride whose stops carry their own price, so the board shows a "from" price (D-131). */
export const faredRide: Ride = {
  ...openRide,
  id: "r3",
  stops: [
    { placeId: "brazlandia", label: "Brazlândia", fare: null },
    { placeId: null, label: "Incra 8", fare: "9.00" },
    { placeId: "esplanada", label: "Esplanada", fare: "7.00" },
  ],
  notes: "Levo mala pequena e aviso no grupo se atrasar.",
  price: "7.00",
  hasFares: true,
};
