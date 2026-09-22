from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest

from brazcar.rides.application import (
    BoardFilter,
    CancelRide,
    ChangeSeats,
    Driver,
    DriverCar,
    ListBoard,
    PublishRide,
    RequestContact,
    RideRules,
)
from brazcar.rides.domain import (
    AccountId,
    CatalogStop,
    ContactLimitError,
    FreeTextStop,
    NoCarError,
    PaymentMethod,
    RideEvent,
    RideId,
    RideOffer,
    RideStatus,
)

from .strategies import BRASILIA, EPOCH


class InMemoryRides:
    def __init__(self) -> None:
        self.rides: dict[RideId, RideOffer] = {}
        self.events: dict[RideId, list[RideEvent]] = {}
        self.revision = 0

    async def get(self, ride_id: RideId) -> RideOffer | None:
        return self.rides.get(ride_id)

    async def save(self, ride: RideOffer, events: tuple[RideEvent, ...]) -> None:
        self.rides[ride.id] = ride
        self.events.setdefault(ride.id, []).extend(events)
        self.revision += 1

    async def upcoming(self, since: datetime) -> tuple[RideOffer, ...]:
        rides = [r for r in self.rides.values() if r.cancelled_at is None and r.departure_at >= since]
        return tuple(sorted(rides, key=lambda r: r.departure_at))

    async def by_driver(self, driver_id: AccountId) -> tuple[RideOffer, ...]:
        return tuple(r for r in self.rides.values() if r.driver_id == driver_id)

    async def history(self, ride_id: RideId) -> tuple[RideEvent, ...]:
        return tuple(self.events.get(ride_id, []))


class Drivers:
    def __init__(self, *drivers: Driver) -> None:
        self.by_id = {d.id: d for d in drivers}

    async def get(self, account_id: AccountId) -> Driver | None:
        return self.by_id.get(account_id)


class Places:
    async def with_descendants(self, place_id: str) -> frozenset[str]:
        return (
            frozenset({"plano-piloto", "esplanada"}) if place_id == "plano-piloto" else frozenset({place_id})
        )

    async def labels(self) -> dict[str, str]:
        return {"esplanada": "Esplanada", "brazlandia": "Brazlândia"}


class Contacts:
    def __init__(self) -> None:
        self.recorded: list[tuple[AccountId, RideId]] = []

    async def count_since(self, requester_id: AccountId, since: datetime) -> int:  # noqa: ARG002 - no clock here
        return sum(1 for r, _ in self.recorded if r == requester_id)

    async def record(self, *, requester_id: AccountId, ride_id: RideId, at: datetime) -> None:  # noqa: ARG002
        self.recorded.append((requester_id, ride_id))


class Clock:
    def __init__(self) -> None:
        self.at = EPOCH

    def now(self) -> datetime:
        return self.at


ANA = Driver(
    id=uuid4(),
    display_name="Ana",
    phone="+5561999990001",
    cars=(DriverCar(car_id=uuid4(), model="Gol", color="prata", plate="ABC1234"),),
)
BIA = Driver(id=uuid4(), display_name="Bia", phone="+5561999990002", cars=())
ROUTE = (CatalogStop(place_id="esplanada"), FreeTextStop(text="Incra 8"), CatalogStop(place_id="brazlandia"))
RULES = RideRules(contact_limit=2)


class Context:
    def __init__(self) -> None:
        self.rides = InMemoryRides()
        self.drivers = Drivers(ANA, BIA)
        self.places = Places()
        self.contacts = Contacts()
        self.clock = Clock()
        self.publish = PublishRide(self.rides, self.drivers, self.clock)
        self.board = ListBoard(self.rides, self.drivers, self.places, self.clock, RULES)
        self.contact = RequestContact(self.rides, self.drivers, self.contacts, self.clock, RULES)

    async def published(self, driver: Driver = ANA, hours: int = 13, seats: int = 3) -> RideOffer:
        return await self.publish(
            driver.id,
            car_id=driver.cars[0].car_id if driver.cars else uuid4(),
            route=ROUTE,
            departure_at=EPOCH + timedelta(hours=hours),
            seats_available=seats,
            payment_methods=frozenset({PaymentMethod.PIX}),
        )


@pytest.fixture
def ctx() -> Context:
    return Context()


async def test_publishing_needs_a_car_and_bumps_the_board(ctx: Context) -> None:
    ride = await ctx.published()

    assert ride.car.plate == "ABC1234"
    assert ctx.rides.revision == 1
    assert [type(e).__name__ for e in await ctx.rides.history(ride.id)] == ["RidePublished"]
    with pytest.raises(NoCarError):
        await ctx.published(driver=BIA)


async def test_the_board_hides_phone_and_plate_and_resolves_place_names(ctx: Context) -> None:
    await ctx.published()

    (shown,) = await ctx.board(BoardFilter(), viewer=None)

    assert shown.driver_name == "Ana"
    assert [s.label for s in shown.stops] == ["Esplanada", "Incra 8", "Brazlândia"]
    assert shown.status is RideStatus.OPEN
    assert "ABC1234" not in shown.model_dump_json()
    assert "+55" not in shown.model_dump_json()
    assert not shown.actions.can_contact  # anonymous


async def test_board_filters_by_day_place_with_descendants_seats_and_price(ctx: Context) -> None:
    ride = await ctx.published(seats=0)
    tomorrow = await ctx.published(hours=13 + 24)

    by_place = await ctx.board(BoardFilter(place_id="plano-piloto"), viewer=None)
    by_other_place = await ctx.board(BoardFilter(place_id="unb"), viewer=None)
    with_seats = await ctx.board(BoardFilter(with_seats=True), viewer=None)
    today = await ctx.board(BoardFilter(day=date(2026, 9, 22)), viewer=None)
    cheap = await ctx.board(BoardFilter(max_price=Decimal(5)), viewer=None)

    assert {r.id for r in by_place} == {ride.id, tomorrow.id}
    assert by_other_place == ()
    assert [r.id for r in with_seats] == [tomorrow.id]
    assert [r.id for r in today] == [ride.id]
    assert cheap == ()


async def test_departed_and_cancelled_rides_leave_the_board(ctx: Context) -> None:
    ride = await ctx.published(hours=1)
    cancelled = await ctx.published(hours=5)
    await CancelRide(ctx.rides, ctx.clock)(ANA.id, cancelled.id)

    ctx.clock.at = EPOCH + timedelta(hours=1, minutes=30)

    assert await ctx.board(BoardFilter(), viewer=None) == ()
    assert ride.id in ctx.rides.rides


async def test_contact_needs_an_open_ride_records_and_is_limited(ctx: Context) -> None:
    ride = await ctx.published()
    passenger = uuid4()

    contact = await ctx.contact(passenger, ride.id)
    await ctx.contact(passenger, ride.id)

    assert contact.plate == "ABC1234"
    assert contact.whatsapp_url.startswith("https://wa.me/5561999990001?text=")
    assert len(ctx.contacts.recorded) == 2
    with pytest.raises(ContactLimitError):
        await ctx.contact(passenger, ride.id)


async def test_contact_is_refused_for_a_full_ride(ctx: Context) -> None:
    ride = await ctx.published()
    await ChangeSeats(ctx.rides, ctx.clock)(ANA.id, ride.id, 0)

    with pytest.raises(LookupError):
        await ctx.contact(uuid4(), ride.id)


def test_fixtures_are_in_brasilia_time() -> None:
    assert EPOCH.tzinfo is BRASILIA
    assert isinstance(ANA.id, UUID)
