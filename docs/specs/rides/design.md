# Desenho (em andamento; apagar ao fechar)

## Domínio

- `Stop` é tipo-soma discriminado por `kind`: `CatalogStop(place_id)` | `FreeTextStop(text)`.
- `RideOffer.publish(...)`, `.change_seats(n, now)`, `.edit(..., now)`, `.cancel(now)` devolvem
  `Change(ride, events)`. `RideStatus` sai de `status_of(ride, now, tolerance)`.
- `allowed_actions(ride, viewer, now, tolerance)`: `can_edit`, `can_change_seats`, `can_cancel`,
  `can_repeat`, `delay_until` (limite do adiamento). O front só desenha (ADR-0011).
- "Mesmo dia" compara a data no fuso de `original_departure_at`.

## Portas

- `RideRepository`: `get`, `save(ride, events)` (grava estado, acrescenta eventos e incrementa a
  revisão numa transação), `upcoming(since)`, `by_driver(driver_id)`, `history(ride_id)`.
- `BoardRevision`: `current()`. A escrita é dever do `save`.
- `DriverDirectory` (porta para `accounts`): `get(account_id) -> Driver(display_name, phone, cars)`.
- `PlaceDirectory` (porta para `places`): `resolve(place_id) -> ids com descendentes`, `label(place_id)`.
- `ContactRequests`: `count_since(account_id, since)`, `record(...)`.

## Casos de uso

`PublishRide`, `EditRide`, `ChangeSeats`, `CancelRide`, `RepeatRide`, `ListBoard`, `MyRides`,
`RequestContact`. Filtros do mural em Python sobre `upcoming`: o volume é de dezenas por dia.

## Adaptadores

Models `RideModel`, `StopModel`, `RideEventModel`, `ContactRequestModel`, `BoardRevisionModel`
(uma linha). Rotas em `/api/rides`: `GET /` (mural), `GET /mine`, `POST /`, `PATCH /{id}`,
`POST /{id}/seats`, `POST /{id}/cancel`, `POST /{id}/repeat`, `POST /{id}/contact`, `GET /revision`.
