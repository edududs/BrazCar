from datetime import datetime
from uuid import UUID

from asgiref.sync import sync_to_async
from django.db import transaction
from django.utils import timezone
from pydantic import TypeAdapter

from brazcar.rides.application import ContactRequestRecord, DriverKind
from brazcar.rides.domain import (
    AccountId,
    CarSnapshot,
    CatalogStop,
    Driver,
    ExternalDriver,
    FreeTextStop,
    PaymentMethod,
    PublishedOrigin,
    RegisteredDriver,
    RideEvent,
    RideId,
    RideOffer,
    RideOrigin,
    Stop,
    WhatsAppOrigin,
)
from brazcar.shared.adapters.board_revision import bump_board_revision
from brazcar.shared.domain.phone import PhoneNumber

from .models import ContactRequestModel, RideEventModel, RideModel, StopModel

_events = TypeAdapter[RideEvent](RideEvent)


class DjangoRideRepository:
    """`RideRepository` over the ORM: one thread hop and one transaction per write (ADR-0008)."""

    async def get(self, ride_id: RideId) -> RideOffer | None:
        return await sync_to_async(_get)(ride_id)

    async def save(self, ride: RideOffer, events: tuple[RideEvent, ...]) -> None:
        await sync_to_async(_save)(ride, events)

    async def delete(self, ride_id: RideId) -> None:
        await sync_to_async(_delete)(ride_id)

    async def upcoming(self, since: datetime) -> tuple[RideOffer, ...]:
        return await sync_to_async(_upcoming)(since)

    async def by_driver(self, driver_id: AccountId) -> tuple[RideOffer, ...]:
        return await sync_to_async(_by_driver)(driver_id)

    async def find_imported(
        self, driver: AccountId | PhoneNumber, departure_at: datetime
    ) -> RideOffer | None:
        return await sync_to_async(_find_imported)(driver, departure_at)

    async def external_rides(
        self, *, departed_before: datetime | None = None, phone: PhoneNumber | None = None
    ) -> tuple[RideId, ...]:
        return await sync_to_async(_external_rides)(departed_before, phone)

    async def history(self, ride_id: RideId) -> tuple[RideEvent, ...]:
        return await sync_to_async(_history)(ride_id)


class DjangoContactRequests:
    async def record(  # noqa: PLR0913 - one row, every fact of the request at once
        self,
        *,
        requester_id: AccountId,
        ride_id: RideId,
        phone_revealed: PhoneNumber,
        driver_kind: DriverKind,
        driver_account_id: AccountId | None,
        at: datetime,
    ) -> None:
        await ContactRequestModel.objects.acreate(
            requester_id=requester_id,
            ride_id=ride_id,
            phone_revealed=phone_revealed.e164(),
            driver_kind=driver_kind,
            driver_account_id=driver_account_id,
            at=at,
        )

    async def by_account(
        self, requester_id: AccountId, *, since: datetime
    ) -> tuple[ContactRequestRecord, ...]:
        return await sync_to_async(_contacts_by_account)(requester_id, since)

    async def by_phone(self, phone: PhoneNumber, *, since: datetime) -> tuple[ContactRequestRecord, ...]:
        return await sync_to_async(_contacts_by_phone)(phone, since)

    async def count_by_account(self, requester_id: AccountId, *, since: datetime) -> int:
        return await sync_to_async(_count_contacts_by_account)(requester_id, since)


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


def _find_imported(driver: AccountId | PhoneNumber, departure_at: datetime) -> RideOffer | None:
    rows = RideModel.objects.filter(origin_kind="whatsapp", departure_at=departure_at, cancelled_at=None)
    rows = (
        rows.filter(driver_id=driver)
        if isinstance(driver, UUID)
        else rows.filter(driver_phone=driver.jid_user())
    )
    row = rows.prefetch_related("stops").first()
    return None if row is None else _to_entity(row)


def _external_rides(departed_before: datetime | None, phone: PhoneNumber | None) -> tuple[RideId, ...]:
    rows = RideModel.objects.filter(driver_id=None)
    if departed_before is not None:
        rows = rows.filter(departure_at__lt=departed_before)
    if phone is not None:
        rows = rows.filter(driver_phone=phone.jid_user())
    return tuple(rows.order_by("departure_at").values_list("id", flat=True))


@transaction.atomic
def _delete(ride_id: RideId) -> None:
    """Stops and events cascade; contact requests keep their history, `ride` set to null (D-140)."""
    deleted, _ = RideModel.objects.filter(id=ride_id).delete()
    if deleted:
        bump_board_revision()


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
        **_driver_fields(ride.driver),
        **_origin_fields(ride.origin),
        "departure_at": ride.departure_at,
        "original_departure_at": ride.original_departure_at,
        "seats_available": ride.seats_available,
        "price": ride.price,
        "payment_methods": sorted(method.value for method in ride.payment_methods),
        "notes": ride.notes or "",  # blank is none, as with every other optional text here
        "published_at": ride.published_at,
        "reopened_at": ride.reopened_at,
        "cancelled_at": ride.cancelled_at,
    }


def _driver_fields(driver: Driver) -> dict[str, object]:
    if isinstance(driver, RegisteredDriver):
        car = driver.car
        return {
            "driver_id": driver.account_id,
            "driver_phone": "",
            "driver_name": "",
            "car_id": None if car is None else car.car_id,
            "car_model": "" if car is None else car.model,
            "car_color": "" if car is None else car.color,
            "car_plate": "" if car is None else car.plate,
        }
    return {
        "driver_id": None,
        "driver_phone": driver.phone.jid_user(),  # digits, as WhatsApp addresses it
        "driver_name": driver.display_name,
        "car_id": None,
        "car_model": "",
        "car_color": "",
        "car_plate": "",
    }


def _origin_fields(origin: RideOrigin) -> dict[str, object]:
    if isinstance(origin, WhatsAppOrigin):
        return {
            "origin_kind": origin.kind,
            "origin_text": origin.message_text,
            "origin_group_label": origin.group_label,
            "origin_sent_at": origin.sent_at,
        }
    return {"origin_kind": origin.kind, "origin_text": "", "origin_group_label": "", "origin_sent_at": None}


def _stop_row(ride_id: RideId, position: int, stop: Stop) -> StopModel:
    return StopModel(
        ride_id=ride_id,
        position=position,
        kind=stop.kind,
        place_id=stop.place_id if isinstance(stop, CatalogStop) else "",
        text="" if isinstance(stop, CatalogStop) else stop.text,
        fare=stop.fare,
    )


def _to_entity(row: RideModel) -> RideOffer:
    return RideOffer(
        id=row.id,
        driver=_to_driver(row),
        origin=_to_origin(row),
        route=tuple(_to_stop(stop) for stop in row.stops.all()),
        departure_at=_local(row.departure_at),
        original_departure_at=_local(row.original_departure_at),
        seats_available=row.seats_available,
        price=row.price,
        payment_methods=frozenset(PaymentMethod(value) for value in row.payment_methods),
        notes=row.notes or None,
        published_at=_local(row.published_at),
        reopened_at=None if row.reopened_at is None else _local(row.reopened_at),
        cancelled_at=None if row.cancelled_at is None else _local(row.cancelled_at),
    )


def _to_driver(row: RideModel) -> Driver:
    """One shape or the other (ADR-0015); a row with both or neither is bad data, not a state."""
    if row.driver_id is None:
        return ExternalDriver(phone=PhoneNumber.from_jid_user(row.driver_phone), display_name=row.driver_name)
    assert isinstance(row.driver_id, UUID)  # noqa: S101 - the user's key is the account's UUID (D-090)
    if row.car_id is None:  # linked by phone to the account, car unknown (D-127)
        return RegisteredDriver(account_id=row.driver_id, car=None)
    return RegisteredDriver(
        account_id=row.driver_id,
        car=CarSnapshot(car_id=row.car_id, model=row.car_model, color=row.car_color, plate=row.car_plate),
    )


def _to_origin(row: RideModel) -> RideOrigin:
    if row.origin_kind == "whatsapp":
        assert row.origin_sent_at is not None  # noqa: S101 - written together with the kind
        return WhatsAppOrigin(
            message_text=row.origin_text,
            group_label=row.origin_group_label,
            sent_at=_local(row.origin_sent_at),
        )
    return PublishedOrigin()


def _to_stop(row: StopModel) -> Stop:
    if row.kind == "catalog":
        return CatalogStop(place_id=row.place_id, fare=row.fare)
    return FreeTextStop(text=row.text, fare=row.fare)


def _local(moment: datetime) -> datetime:
    """The database keeps UTC; the rules about "the same day" need the board's own zone (ADR-0004)."""
    return timezone.localtime(moment)


def _contacts_by_account(requester_id: AccountId, since: datetime) -> tuple[ContactRequestRecord, ...]:
    rows = ContactRequestModel.objects.filter(requester_id=requester_id, at__gte=since).order_by("-at")
    return tuple(_to_contact_record(row) for row in rows)


def _contacts_by_phone(phone: PhoneNumber, since: datetime) -> tuple[ContactRequestRecord, ...]:
    rows = ContactRequestModel.objects.filter(phone_revealed=phone.e164(), at__gte=since).order_by("-at")
    return tuple(_to_contact_record(row) for row in rows)


def _count_contacts_by_account(requester_id: AccountId, since: datetime) -> int:
    return ContactRequestModel.objects.filter(requester_id=requester_id, at__gte=since).count()


def _to_contact_record(row: ContactRequestModel) -> ContactRequestRecord:
    assert isinstance(row.requester_id, UUID)  # noqa: S101 - the requester's key is the account's UUID
    assert row.ride_id is None or isinstance(row.ride_id, UUID)  # noqa: S101 - null once the ride is gone
    assert row.driver_kind in ("registered", "external")  # noqa: S101 - only these two are ever written
    return ContactRequestRecord(
        requester_id=row.requester_id,
        ride_id=row.ride_id,
        phone_revealed=PhoneNumber.parse(row.phone_revealed),
        driver_kind=row.driver_kind,
        driver_account_id=row.driver_account_id,
        at=_local(row.at),
    )
