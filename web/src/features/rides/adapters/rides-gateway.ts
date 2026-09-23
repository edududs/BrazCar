import { apiClient } from "@/shared/adapters/api/client";
import type { components } from "@/shared/adapters/api/schema";

import type { BoardFilters } from "../domain/board";
import {
  type Contact,
  type Ride,
  type RideChanges,
  type RideDraft,
  RideRequestError,
  type StopDraft,
} from "../domain/ride";

type RideOut = components["schemas"]["RideOut"];
type StopIn = components["schemas"]["StopIn"];
type EditIn = components["schemas"]["EditIn"];

function toRide(out: RideOut): Ride {
  return {
    id: out.id,
    driverName: out.driver_name,
    carModel: out.car_model,
    carColor: out.car_color,
    stops: out.stops.map((stop) => ({ placeId: stop.place_id, label: stop.label })),
    departureAt: out.departure_at,
    seatsAvailable: out.seats_available,
    price: out.price,
    paymentMethods: out.payment_methods,
    status: out.status,
    actions: {
      canEdit: out.actions.can_edit,
      canChangeSeats: out.actions.can_change_seats,
      canCancel: out.actions.can_cancel,
      canRepeat: out.actions.can_repeat,
      canContact: out.actions.can_contact,
      delayUntil: out.actions.delay_until,
    },
    isMine: out.is_mine,
  };
}

function toStopIn(stop: StopDraft): StopIn {
  return stop.placeId === null ? { text: stop.text } : { place_id: stop.placeId };
}

function detailOf(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "detail" in error) {
    const { detail } = error;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return "Confira os dados informados.";
  }
  return null;
}

function refused(status: number, error: unknown): RideRequestError {
  return new RideRequestError(status, detailOf(error) ?? "Não foi possível concluir.");
}

export async function fetchBoard(filters: BoardFilters, signal: AbortSignal): Promise<Ride[]> {
  const { data, error, response } = await apiClient.GET("/api/rides", {
    params: {
      query: {
        day: filters.day,
        q: filters.text,
        with_seats: filters.withSeats,
        max_price: filters.maxPrice,
      },
    },
    signal,
  });
  if (data === undefined) throw refused(response.status, error);
  return data.map(toRide);
}

export async function fetchRide(rideId: string, signal: AbortSignal): Promise<Ride> {
  const { data, error, response } = await apiClient.GET("/api/rides/{ride_id}", {
    params: { path: { ride_id: rideId } },
    signal,
  });
  if (data === undefined) throw refused(response.status, error);
  return toRide(data);
}

export async function fetchMyRides(signal: AbortSignal): Promise<Ride[]> {
  const { data, error, response } = await apiClient.GET("/api/rides/mine", { signal });
  if (data === undefined) throw refused(response.status, error);
  return data.map(toRide);
}

export async function fetchBoardRevision(signal: AbortSignal): Promise<number> {
  const { data, error, response } = await apiClient.GET("/api/rides/revision", { signal });
  if (data === undefined) throw refused(response.status, error);
  return data.revision;
}

export async function publishRide(draft: RideDraft): Promise<Ride> {
  const { data, error, response } = await apiClient.POST("/api/rides", {
    body: {
      car_id: draft.carId,
      stops: draft.stops.map(toStopIn),
      departure_at: draft.departureAt,
      seats_available: draft.seatsAvailable,
      price: draft.price,
      payment_methods: [...draft.paymentMethods],
    },
  });
  if (data === undefined) throw refused(response.status, error);
  return toRide(data);
}

export async function editRide(rideId: string, changes: RideChanges): Promise<Ride> {
  const body: EditIn = {};
  if (changes.stops !== undefined) body.stops = changes.stops.map(toStopIn);
  if (changes.departureAt !== undefined) body.departure_at = changes.departureAt;
  if (changes.price !== undefined) body.price = changes.price;
  if (changes.paymentMethods !== undefined) body.payment_methods = [...changes.paymentMethods];
  const { data, error, response } = await apiClient.PATCH("/api/rides/{ride_id}", {
    params: { path: { ride_id: rideId } },
    body,
  });
  if (data === undefined) throw refused(response.status, error);
  return toRide(data);
}

export async function changeSeats(rideId: string, seatsAvailable: number): Promise<Ride> {
  const { data, error, response } = await apiClient.POST("/api/rides/{ride_id}/seats", {
    params: { path: { ride_id: rideId } },
    body: { seats_available: seatsAvailable },
  });
  if (data === undefined) throw refused(response.status, error);
  return toRide(data);
}

export async function cancelRide(rideId: string): Promise<Ride> {
  const { data, error, response } = await apiClient.POST("/api/rides/{ride_id}/cancel", {
    params: { path: { ride_id: rideId } },
  });
  if (data === undefined) throw refused(response.status, error);
  return toRide(data);
}

export async function repeatRide(rideId: string, departureAt: string): Promise<Ride> {
  const { data, error, response } = await apiClient.POST("/api/rides/{ride_id}/repeat", {
    params: { path: { ride_id: rideId } },
    body: { departure_at: departureAt },
  });
  if (data === undefined) throw refused(response.status, error);
  return toRide(data);
}

export async function requestContact(rideId: string): Promise<Contact> {
  const { data, error, response } = await apiClient.POST("/api/rides/{ride_id}/contact", {
    params: { path: { ride_id: rideId } },
  });
  if (data === undefined) throw refused(response.status, error);
  return { whatsappUrl: data.whatsapp_url, plate: data.plate };
}
