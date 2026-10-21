"""`RidesBoard` over the real use cases of `rides`, on their in-memory adapters."""

from datetime import date, time, timedelta
from uuid import uuid4

import pytest

from brazcar.alerts.adapters.rides import RidesBoard
from brazcar.alerts.domain import RideAlert
from brazcar.rides.application import (
    DriverAccount,
    DriverCar,
    PublishRide,
    RideRules,
    ShownOnBoard,
    ShowRide,
)
from brazcar.rides.domain import CatalogStop, FreeTextStop, PaymentMethod, RideOffer
from brazcar.shared.domain.phone import PhoneNumber
from tests.rides.fakes import (
    FixedClock,
    InMemoryDrivers,
    InMemoryRideRepository,
    catalog_places,
    indexed_search,
)
from tests.rides.strategies import EPOCH
from tests.shared.fakes import RecordingRideChanged

ANA = DriverAccount(
    id=uuid4(),
    display_name="Ana",
    phone=PhoneNumber.parse("+5561999990001"),
    cars=(DriverCar(car_id=uuid4(), model="Gol", color="prata", plate="ABC1234"),),
)
ROUTE = (CatalogStop(place_id="esplanada"), FreeTextStop(text="Incra 8"), CatalogStop(place_id="brazlandia"))
DEPARTURE = EPOCH + timedelta(hours=13)  # 19:00 on the day of EPOCH, in Brasília
DAY = DEPARTURE.date()


class Context:
    def __init__(self) -> None:
        rides = InMemoryRideRepository()
        drivers = InMemoryDrivers(ANA)
        places = catalog_places()
        search = indexed_search()
        clock = FixedClock()
        rules = RideRules()
        self.publish = PublishRide(rides, drivers, places, search, clock, RecordingRideChanged())
        self.board = RidesBoard(
            ShowRide(rides, drivers, places, clock, rules), ShownOnBoard(rides, search, clock, rules)
        )

    async def published(self, *, seats: int = 3) -> RideOffer:
        return await self.publish(
            ANA.id,
            car_id=ANA.cars[0].car_id,
            route=ROUTE,
            departure_at=DEPARTURE,
            seats_available=seats,
            payment_methods=frozenset({PaymentMethod.PIX}),
        )


def alert(
    *, day: date = DAY, text: str | None = None, from_time: time | None = None, until_time: time | None = None
) -> RideAlert:
    return RideAlert(
        id=uuid4(),
        owner_id=uuid4(),
        text=text,
        day=day,
        from_time=from_time,
        until_time=until_time,
        created_at=EPOCH,
    )


@pytest.fixture
def ctx() -> Context:
    return Context()


async def test_the_summary_has_the_labels_of_the_stops_in_order_and_the_departure(ctx: Context) -> None:
    ride = await ctx.published()

    summary = await ctx.board.summary(ride.id)

    assert summary is not None
    assert summary.ride_id == ride.id
    assert summary.stops == ("Esplanada", "Incra 8", "Brazlândia")
    assert summary.departure_at == DEPARTURE


async def test_an_unknown_ride_has_no_summary(ctx: Context) -> None:
    assert await ctx.board.summary(uuid4()) is None


@pytest.mark.parametrize(
    "matching",
    [
        alert(),
        alert(text="Incra"),
        alert(text="Brazlândia"),
        alert(from_time=time(19, 0)),
        alert(until_time=time(19, 0)),
        alert(text="Esplanada", from_time=time(18, 0), until_time=time(20, 0)),
    ],
)
async def test_the_board_shows_the_ride_the_alert_asks_for(ctx: Context, matching: RideAlert) -> None:
    ride = await ctx.published()

    assert await ctx.board.shows(ride.id, matching) is True


@pytest.mark.parametrize(
    "other",
    [
        alert(day=DAY + timedelta(days=1)),
        alert(from_time=time(19, 1)),
        alert(until_time=time(18, 59)),
        alert(text="Taguatinga"),
    ],
)
async def test_the_board_does_not_show_a_ride_outside_the_day_the_window_or_the_text(
    ctx: Context, other: RideAlert
) -> None:
    ride = await ctx.published()

    assert await ctx.board.shows(ride.id, other) is False


async def test_a_ride_without_seats_is_not_shown(ctx: Context) -> None:
    ride = await ctx.published(seats=0)

    assert await ctx.board.shows(ride.id, alert()) is False
