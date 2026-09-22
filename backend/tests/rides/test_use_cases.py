from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest

from brazcar.rides.application import (
    BoardFilter,
    CancelRide,
    ChangeSeats,
    Driver,
    DriverCar,
    EditRide,
    ListBoard,
    MyRides,
    PublishRide,
    RequestContact,
    RideRules,
    ShowRide,
)
from brazcar.rides.domain import (
    CatalogStop,
    ContactLimitError,
    FreeTextStop,
    NoCarError,
    PaymentMethod,
    RideNotFoundError,
    RideNotOpenError,
    RideOffer,
    RideStatus,
    UnknownPlaceError,
)

from .fakes import (
    FixedClock,
    InMemoryDrivers,
    InMemoryPlaces,
    InMemoryRateLimiter,
    InMemoryRideRepository,
    RecordingContacts,
)
from .strategies import BRASILIA, EPOCH

ANA = Driver(
    id=uuid4(),
    display_name="Ana",
    phone="+5561999990001",
    cars=(DriverCar(car_id=uuid4(), model="Gol", color="prata", plate="ABC1234"),),
)
BIA = Driver(id=uuid4(), display_name="Bia", phone="+5561999990002", cars=())
ROUTE = (CatalogStop(place_id="esplanada"), FreeTextStop(text="Incra 8"), CatalogStop(place_id="brazlandia"))
RULES = RideRules(contact_limit=2, contact_window=timedelta(hours=1))


class Context:
    def __init__(self) -> None:
        self.rides = InMemoryRideRepository()
        self.drivers = InMemoryDrivers(ANA, BIA)
        self.places = InMemoryPlaces()
        self.contacts = RecordingContacts()
        self.clock = FixedClock()
        self.limiter = InMemoryRateLimiter(self.clock)
        self.publish = PublishRide(self.rides, self.drivers, self.places, self.clock)
        self.edit = EditRide(self.rides, self.places, self.clock)
        self.board = ListBoard(self.rides, self.drivers, self.places, self.clock, RULES)
        self.mine = MyRides(self.rides, self.drivers, self.places, self.clock, RULES)
        self.show = ShowRide(self.rides, self.drivers, self.places, self.clock, RULES)
        self.contact = RequestContact(
            self.rides, self.drivers, self.contacts, self.limiter, self.clock, RULES
        )

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


async def test_a_stop_must_point_at_a_place_the_catalog_knows(ctx: Context) -> None:
    ride = await ctx.published()
    elsewhere = (CatalogStop(place_id="nowhere"), FreeTextStop(text="Incra 8"))

    with pytest.raises(UnknownPlaceError, match="nowhere"):
        await ctx.publish(
            ANA.id,
            car_id=ANA.cars[0].car_id,
            route=elsewhere,
            departure_at=EPOCH + timedelta(hours=13),
            seats_available=3,
            payment_methods=frozenset({PaymentMethod.PIX}),
        )
    with pytest.raises(UnknownPlaceError):
        await ctx.edit(ANA.id, ride.id, route=elsewhere)
    assert ctx.rides.revision == 1


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


async def test_departed_and_cancelled_rides_leave_the_board_but_not_my_rides(ctx: Context) -> None:
    ride = await ctx.published(hours=1)
    cancelled = await ctx.published(hours=5)
    await CancelRide(ctx.rides, ctx.clock)(ANA.id, cancelled.id)

    ctx.clock.at = EPOCH + timedelta(hours=1, minutes=30)

    assert await ctx.board(BoardFilter(), viewer=None) == ()
    assert [r.id for r in await ctx.mine(ANA.id)] == [cancelled.id, ride.id]
    assert (await ctx.show(ride.id, viewer=ANA.id)).status is RideStatus.DEPARTED
    with pytest.raises(RideNotFoundError):
        await ctx.show(uuid4(), viewer=None)


async def test_contact_needs_an_open_ride_records_and_is_limited_per_window(ctx: Context) -> None:
    ride = await ctx.published()
    passenger = uuid4()

    contact = await ctx.contact(passenger, ride.id)
    await ctx.contact(passenger, ride.id)

    assert contact.plate == "ABC1234"
    assert contact.whatsapp_url.startswith("https://wa.me/5561999990001?text=")
    assert len(ctx.contacts.recorded) == 2
    with pytest.raises(ContactLimitError):
        await ctx.contact(passenger, ride.id)
    assert len(ctx.contacts.recorded) == 2

    ctx.clock.at = EPOCH + timedelta(hours=1, seconds=1)
    await ctx.contact(passenger, ride.id)
    assert len(ctx.contacts.recorded) == 3


async def test_contact_is_refused_for_a_full_ride_without_spending_the_limit(ctx: Context) -> None:
    ride = await ctx.published()
    await ChangeSeats(ctx.rides, ctx.clock)(ANA.id, ride.id, 0)

    with pytest.raises(RideNotOpenError):
        await ctx.contact(uuid4(), ride.id)
    assert ctx.contacts.recorded == []
    assert ctx.limiter.hits == {}


def test_fixtures_are_in_brasilia_time() -> None:
    assert EPOCH.tzinfo is BRASILIA
    assert isinstance(ANA.id, UUID)
