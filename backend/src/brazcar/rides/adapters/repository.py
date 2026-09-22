from datetime import datetime
from uuid import UUID

from asgiref.sync import sync_to_async
from django.db import transaction
from django.utils import timezone
from pydantic import TypeAdapter

from brazcar.rides.domain import (
    AccountId,
    CarSnapshot,
    CatalogStop,
    FreeTextStop,
    PaymentMethod,
    RideEvent,
    RideId,
    RideOffer,
    Stop,
)
from brazcar.shared.adapters.board_revision import bump_board_revision

from .models import ContactRequestModel, RideEventModel, RideModel, StopModel

_events = TypeAdapter[RideEvent](RideEvent)


class DjangoRideRepository:
    """`RideRepository` over the ORM: one thread hop and one transaction per write (ADR-0008)."""

    async def get(self, ride_id: RideId) -> RideOffer | None:
        return await sync_to_async(_get)(ride_id)

    async def save(self, ride: RideOffer, events: tuple[RideEvent, ...]) -> None:
        await sync_to_async(_save)(ride, events)

    async def upcoming(self, since: datetime) -> tuple[RideOffer, ...]:
        return await sync_to_async(_upcoming)(since)

    async def by_driver(self, driver_id: AccountId) -> tuple[RideOffer, ...]:
        return await sync_to_async(_by_driver)(driver_id)

    async def history(self, ride_id: RideId) -> tuple[RideEvent, ...]:
        return await sync_to_async(_history)(ride_id)


class DjangoContactRequests:
    async def record(self, *, requester_id: AccountId, ride_id: RideId, at: datetime) -> None:
        await ContactRequestModel.objects.acreate(requester_id=requester_id, ride_id=ride_id, at=at)


def _get(ride_id: RideId) -> RideOffer | None:
    row = RideModel.objects.filter(id=ride_id).prefetch_related("stops").first()
    return None if row is None else _to_entity(row)


def _upcoming(since: datetime) -> tuple[RideOffer, ...]:
    rows = (
        RideModel.objects.filter(cancelled_at=None, departure_at__gte=since)
        .order_by("departure_at", "published_at")
        .prefetch_related("stops")
    )
    return tuple(_to_entity(row) for row in rows)


def _by_driver(driver_id: AccountId) -> tuple[RideOffer, ...]:
    rows = RideModel.objects.filter(driver_id=driver_id).order_by("-departure_at").prefetch_related("stops")
    return tuple(_to_entity(row) for row in rows)


def _history(ride_id: RideId) -> tuple[RideEvent, ...]:
    rows = RideEventModel.objects.filter(ride_id=ride_id).order_by("position")
    return tuple(_events.validate_python(row.payload) for row in rows)


@transaction.atomic
def _save(ride: RideOffer, events: tuple[RideEvent, ...]) -> None:
    RideModel.objects.update_or_create(id=ride.id, defaults=_fields(ride))
    StopModel.objects.filter(ride_id=ride.id).delete()
    StopModel.objects.bulk_create(_stop_row(ride.id, n, stop) for n, stop in enumerate(ride.route))
    if not events:
        return
    first = RideEventModel.objects.filter(ride_id=ride.id).count()
    RideEventModel.objects.bulk_create(
        RideEventModel(
            ride_id=ride.id,
            position=first + n,
            kind=event.kind,
            at=event.at,
            payload=event.model_dump(mode="json"),
        )
        for n, event in enumerate(events)
    )
    bump_board_revision()  # the same transaction as the state (ADR-0010)


def _fields(ride: RideOffer) -> dict[str, object]:
    return {
        "driver_id": ride.driver_id,
        "car_id": ride.car.car_id,
        "car_model": ride.car.model,
        "car_color": ride.car.color,
        "car_plate": ride.car.plate,
        "departure_at": ride.departure_at,
        "original_departure_at": ride.original_departure_at,
        "seats_available": ride.seats_available,
        "price": ride.price,
        "payment_methods": sorted(method.value for method in ride.payment_methods),
        "published_at": ride.published_at,
        "reopened_at": ride.reopened_at,
        "cancelled_at": ride.cancelled_at,
    }


def _stop_row(ride_id: RideId, position: int, stop: Stop) -> StopModel:
    if isinstance(stop, CatalogStop):
        return StopModel(ride_id=ride_id, position=position, kind=stop.kind, place_id=stop.place_id)
    return StopModel(ride_id=ride_id, position=position, kind=stop.kind, text=stop.text)


def _to_entity(row: RideModel) -> RideOffer:
    assert isinstance(row.driver_id, UUID)  # noqa: S101 - the user's key is the account's UUID (D-090)
    return RideOffer(
        id=row.id,
        driver_id=row.driver_id,
        car=CarSnapshot(car_id=row.car_id, model=row.car_model, color=row.car_color, plate=row.car_plate),
        route=tuple(_to_stop(stop) for stop in row.stops.all()),
        departure_at=_local(row.departure_at),
        original_departure_at=_local(row.original_departure_at),
        seats_available=row.seats_available,
        price=row.price,
        payment_methods=frozenset(PaymentMethod(value) for value in row.payment_methods),
        published_at=_local(row.published_at),
        reopened_at=None if row.reopened_at is None else _local(row.reopened_at),
        cancelled_at=None if row.cancelled_at is None else _local(row.cancelled_at),
    )


def _to_stop(row: StopModel) -> Stop:
    return CatalogStop(place_id=row.place_id) if row.kind == "catalog" else FreeTextStop(text=row.text)


def _local(moment: datetime) -> datetime:
    """The database keeps UTC; the rules about "the same day" need the board's own zone (ADR-0004)."""
    return timezone.localtime(moment)
