"""What `importing` asks the other contexts, through their own ports and use cases (D-006)."""

import re
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from brazcar.importing.application import ImportedRide
from brazcar.importing.domain import ResolvedStop, RideDraft, Sender
from brazcar.places.application import CatalogRepository
from brazcar.rides.application import ForgetRides, ImportRide, RideRepository
from brazcar.rides.domain import (
    CatalogStop,
    FreeTextStop,
    PaymentMethod,
    Stop,
    UnknownPlaceError,
    WhatsAppOrigin,
)
from brazcar.shared.domain.phone import PhoneNumber


class CatalogStopResolver:
    """A stop's words against the catalog's names and aliases, exactly; the model never picks an id."""

    def __init__(self, catalog: CatalogRepository) -> None:
        self._catalog = catalog

    async def resolve(self, texts: tuple[str, ...]) -> tuple[ResolvedStop, ...]:
        """ "Vila/Veredas" or "Fassincra ou Rodeador" are two stops when both halves are known places;
        "33/34" is one stop nobody knows. A detail in parentheses does not hide the place."""
        catalog = await self._catalog.load()
        resolved: list[ResolvedStop] = []
        for text in texts:
            parts = [part.strip() for part in re.split(r"\s*/\s*|\s+ou\s+", text) if part.strip()]
            places = [catalog.named(part) or catalog.named(part.partition("(")[0]) for part in parts]
            if len(parts) > 1 and all(place is not None for place in places):
                resolved.extend(
                    ResolvedStop(text=part, place_id=place.id)
                    for part, place in zip(parts, places, strict=True)
                    if place is not None
                )
                continue
            place = catalog.named(text) or catalog.named(text.partition("(")[0])
            resolved.append(ResolvedStop(text=text, place_id=None if place is None else place.id))
        return tuple(resolved)


class RidesBridge:
    """`ImportedRides` over the use cases of `rides` (ADR-0015)."""

    def __init__(self, import_ride: ImportRide, forget: ForgetRides, rides: RideRepository) -> None:
        self._import = import_ride
        self._forget = forget
        self._rides = rides

    async def create(
        self, *, sender: Sender, message_text: str, group_label: str, sent_at: datetime, draft: RideDraft
    ) -> ImportedRide:
        try:
            imported = await self._import(
                sender_phone=sender.phone,
                sender_name=sender.display_name or "Motorista",
                origin=WhatsAppOrigin(message_text=message_text, group_label=group_label, sent_at=sent_at),
                route=tuple(_stop(stop) for stop in draft.stops),
                departure_at=draft.departure_at,
                seats_available=draft.seats,
                price=Decimal(draft.price),
                payment_methods=frozenset(PaymentMethod(method) for method in draft.payment_methods),
            )
        except UnknownPlaceError as error:
            raise LookupError(error.place_id) from error
        return ImportedRide(ride_id=imported.ride.id, created=imported.created)

    async def forget_departed(self, before: datetime) -> tuple[UUID, ...]:
        return await self._forget_all(await self._rides.external_rides(departed_before=before))

    async def forget_from(self, phone: PhoneNumber) -> tuple[UUID, ...]:
        return await self._forget_all(await self._rides.external_rides(phone=phone))

    async def release(self, ride_id: UUID) -> bool:
        ride = await self._rides.get(ride_id)
        if ride is None:
            return True
        if ride.driver_id is not None:
            return False
        await self._forget([ride_id])
        return True

    async def _forget_all(self, ride_ids: tuple[UUID, ...]) -> tuple[UUID, ...]:
        await self._forget(ride_ids)
        return ride_ids


def _stop(stop: ResolvedStop) -> Stop:
    if stop.place_id is not None:
        return CatalogStop(place_id=stop.place_id, fare=stop.fare)
    return FreeTextStop(text=stop.text, fare=stop.fare)
