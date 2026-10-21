"""The port that tells a listener a ride was written with an event (D-177)."""

import logging
from datetime import timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest

from brazcar.rides.application import (
    CancelRide,
    ChangeSeats,
    DriverAccount,
    DriverCar,
    EditRide,
    ImportRide,
    PublishRide,
    RepeatRide,
    RideChanged,
)
from brazcar.rides.domain import CatalogStop, FreeTextStop, PaymentMethod, RideOffer
from brazcar.shared.domain.phone import PhoneNumber
from tests.shared.fakes import FailingRideChanged, RecordingRideChanged

from .fakes import FixedClock, InMemoryDrivers, InMemoryRideRepository, catalog_places, indexed_search
from .strategies import EPOCH, EXTERNAL_PHONE, whatsapp_origin

ANA = DriverAccount(
    id=uuid4(),
    display_name="Ana",
    phone=PhoneNumber.parse("+5561999990001"),
    cars=(DriverCar(car_id=uuid4(), model="Gol", color="prata", plate="ABC1234"),),
)
ROUTE = (CatalogStop(place_id="esplanada"), FreeTextStop(text="Incra 8"), CatalogStop(place_id="brazlandia"))
DEPARTURE = EPOCH + timedelta(hours=13)


class Context:
    def __init__(self, changed: RideChanged | None = None) -> None:
        self.rides = InMemoryRideRepository()
        self.drivers = InMemoryDrivers(ANA)
        self.places = catalog_places()
        self.search = indexed_search()
        self.clock = FixedClock()
        self.seen: list[tuple[int, bool]] = []  # (seats, found by the text of a stop) at each call
        self.changed = RecordingRideChanged(self.observe)
        listener = changed or self.changed
        self.publish = PublishRide(self.rides, self.drivers, self.places, self.search, self.clock, listener)
        self.edit = EditRide(self.rides, self.places, self.search, self.clock, listener)
        self.change_seats = ChangeSeats(self.rides, self.clock, listener)
        self.cancel = CancelRide(self.rides, self.clock)
        self.repeat = RepeatRide(self.rides, self.drivers, self.search, self.clock, listener)
        self.import_ride = ImportRide(
            self.rides, self.drivers, self.places, self.search, self.clock, listener
        )

    async def observe(self, ride_id: UUID) -> None:
        ride = await self.rides.get(ride_id)
        assert ride is not None
        found = await self.search.matching("incra", [ride_id])
        self.seen.append((ride.seats_available, ride_id in found))

    async def published(self, seats: int = 3) -> RideOffer:
        return await self.publish(
            ANA.id,
            car_id=ANA.cars[0].car_id,
            route=ROUTE,
            departure_at=DEPARTURE,
            seats_available=seats,
            payment_methods=frozenset({PaymentMethod.PIX}),
        )

    async def imported(self) -> bool:
        result = await self.import_ride(
            sender_phone=EXTERNAL_PHONE,
            sender_name="Zé do grupo",
            origin=whatsapp_origin(),
            route=ROUTE,
            departure_at=DEPARTURE,
            seats_available=2,
            price=Decimal("7.00"),
            payment_methods=frozenset({PaymentMethod.PIX}),
        )
        return result.created


@pytest.fixture
def ctx() -> Context:
    return Context()


async def test_publishing_tells_the_listener_once_with_the_ride_saved_and_indexed(ctx: Context) -> None:
    ride = await ctx.published()

    assert ctx.changed.calls == [ride.id]
    assert ctx.seen == [(3, True)]


async def test_editing_tells_the_listener_and_an_edit_without_change_does_not(ctx: Context) -> None:
    ride = await ctx.published()
    ctx.changed.calls.clear()
    ctx.seen.clear()

    await ctx.edit(ANA.id, ride.id, price=Decimal("9.00"))
    assert ctx.changed.calls == [ride.id]
    assert ctx.seen == [(3, True)]

    ctx.changed.calls.clear()
    await ctx.edit(ANA.id, ride.id)
    assert ctx.changed.calls == []


async def test_a_new_route_is_already_indexed_when_the_listener_hears(ctx: Context) -> None:
    ride = await ctx.published()
    ctx.seen.clear()

    await ctx.edit(
        ANA.id, ride.id, route=(CatalogStop(place_id="esplanada"), CatalogStop(place_id="brazlandia"))
    )

    assert ctx.seen == [(3, False)]


async def test_seats_going_down_to_zero_and_reopening_tell_the_listener(ctx: Context) -> None:
    ride = await ctx.published()
    ctx.changed.calls.clear()
    ctx.seen.clear()

    await ctx.change_seats(ANA.id, ride.id, 2)
    await ctx.change_seats(ANA.id, ride.id, 0)
    await ctx.change_seats(ANA.id, ride.id, 1)

    assert ctx.changed.calls == [ride.id] * 3
    assert ctx.seen == [(2, True), (0, True), (1, True)]


async def test_the_same_number_of_seats_does_not_tell_the_listener(ctx: Context) -> None:
    ride = await ctx.published()
    ctx.changed.calls.clear()

    await ctx.change_seats(ANA.id, ride.id, 3)

    assert ctx.changed.calls == []


async def test_cancelling_never_tells_the_listener(ctx: Context) -> None:
    ride = await ctx.published()
    ctx.changed.calls.clear()

    await ctx.cancel(ANA.id, ride.id)

    assert ctx.changed.calls == []


async def test_repeating_tells_the_listener_with_the_new_ride(ctx: Context) -> None:
    ride = await ctx.published()
    ctx.changed.calls.clear()
    ctx.seen.clear()

    again = await ctx.repeat(ANA.id, ride.id, departure_at=DEPARTURE + timedelta(days=1))

    assert again.id != ride.id
    assert ctx.changed.calls == [again.id]
    assert ctx.seen == [(3, True)]


async def test_importing_tells_the_listener_only_when_it_creates_the_ride(ctx: Context) -> None:
    assert await ctx.imported() is True
    assert len(ctx.changed.calls) == 1
    assert ctx.seen == [(2, True)]

    assert await ctx.imported() is False
    assert len(ctx.changed.calls) == 1


async def test_a_failing_listener_never_fails_the_write(caplog: pytest.LogCaptureFixture) -> None:
    ctx = Context(FailingRideChanged())

    with caplog.at_level(logging.ERROR):
        ride = await ctx.published()
        await ctx.change_seats(ANA.id, ride.id, 0)
        created = await ctx.imported()

    assert created is True
    saved = await ctx.rides.get(ride.id)
    assert saved is not None
    assert saved.seats_available == 0
    failures = [r for r in caplog.records if r.exc_info and "listener" in r.getMessage()]
    assert len(failures) == 3
    assert str(ride.id) in failures[0].getMessage()
