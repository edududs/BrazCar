from datetime import date, time, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest

from brazcar.rides.application import (
    BoardFilter,
    CancelRide,
    ChangeSeats,
    DriverAccount,
    DriverCar,
    EditRide,
    ListBoard,
    MyRides,
    PublishRide,
    RequestContact,
    RideRules,
    ShownOnBoard,
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
from brazcar.shared.domain.phone import PhoneNumber

from .fakes import (
    FixedClock,
    InMemoryDrivers,
    InMemoryRateLimiter,
    InMemoryRideRepository,
    RecordingContacts,
    catalog_places,
    indexed_search,
)
from .strategies import BRASILIA, EPOCH

ANA = DriverAccount(
    id=uuid4(),
    display_name="Ana",
    phone=PhoneNumber.parse("+5561999990001"),
    cars=(DriverCar(car_id=uuid4(), model="Gol", color="prata", plate="ABC1234"),),
)
BIA = DriverAccount(id=uuid4(), display_name="Bia", phone=PhoneNumber.parse("+5561999990002"), cars=())
ROUTE = (CatalogStop(place_id="esplanada"), FreeTextStop(text="Incra 8"), CatalogStop(place_id="brazlandia"))
RULES = RideRules(contact_limit=2, contact_window=timedelta(hours=1))


class Context:
    def __init__(self) -> None:
        self.rides = InMemoryRideRepository()
        self.drivers = InMemoryDrivers(ANA, BIA)
        self.places = catalog_places()
        self.search = indexed_search()
        self.contacts = RecordingContacts()
        self.clock = FixedClock()
        self.limiter = InMemoryRateLimiter(self.clock)
        self.publish = PublishRide(self.rides, self.drivers, self.places, self.search, self.clock)
        self.edit = EditRide(self.rides, self.places, self.search, self.clock)
        self.board = ListBoard(self.rides, self.drivers, self.places, self.search, self.clock, RULES)
        self.mine = MyRides(self.rides, self.drivers, self.places, self.clock, RULES)
        self.show = ShowRide(self.rides, self.drivers, self.places, self.clock, RULES)
        self.contact = RequestContact(
            self.rides, self.drivers, self.contacts, self.limiter, self.clock, RULES
        )

    async def published(self, driver: DriverAccount = ANA, hours: int = 13, seats: int = 3) -> RideOffer:
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

    assert ride.car is not None
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


async def test_a_new_route_is_found_by_its_new_stops(ctx: Context) -> None:
    ride = await ctx.published()

    await ctx.edit(
        ANA.id, ride.id, route=(FreeTextStop(text="Ceilândia Norte"), CatalogStop(place_id="esplanada"))
    )

    assert [r.id for r in await ctx.board(BoardFilter(text="ceilandia"), viewer=None)] == [ride.id]
    assert await ctx.board(BoardFilter(text="incra"), viewer=None) == ()


async def test_the_card_carries_the_notes_and_the_fare_of_each_stop(ctx: Context) -> None:
    fared = (
        CatalogStop(place_id="esplanada"),
        FreeTextStop(text="Incra 8", fare=Decimal("9.00")),
        CatalogStop(place_id="brazlandia", fare=Decimal("7.00")),
    )
    ride = await ctx.publish(
        ANA.id,
        car_id=ANA.cars[0].car_id,
        route=fared,
        departure_at=EPOCH + timedelta(hours=13),
        seats_available=3,
        price=Decimal("20.00"),
        payment_methods=frozenset({PaymentMethod.PIX}),
        notes="Levo mala pequena",
    )

    (shown,) = await ctx.board(BoardFilter(), viewer=BIA.id)
    plain = await ctx.edit(ANA.id, ride.id, route=ROUTE, price=Decimal("8.00"), notes="")
    (after,) = await ctx.board(BoardFilter(), viewer=BIA.id)

    assert shown.notes == "Levo mala pequena"
    assert [stop.fare for stop in shown.stops] == [None, Decimal("9.00"), Decimal("7.00")]
    assert shown.price == Decimal("7.00")  # the cheapest fare, not the typed price (D-131)
    assert shown.has_fares is True
    assert plain.price == Decimal("8.00")
    assert after.notes is None
    assert after.has_fares is False


async def test_the_board_hides_phone_and_plate_and_resolves_place_names(ctx: Context) -> None:
    await ctx.published()

    (shown,) = await ctx.board(BoardFilter(), viewer=BIA.id)

    assert shown.driver_name == "Ana"
    assert [s.label for s in shown.stops] == ["Esplanada", "Incra 8", "Brazlândia"]
    assert shown.status is RideStatus.OPEN
    assert "ABC1234" not in shown.model_dump_json()
    assert "+55" not in shown.model_dump_json()
    assert shown.actions.can_contact


async def test_board_filters_by_day_text_of_any_stop_seats_and_price(ctx: Context) -> None:
    ride = await ctx.published(seats=0)
    tomorrow = await ctx.published(hours=13 + 24)

    by_place = await ctx.board(BoardFilter(text="plano piloto"), viewer=None)  # above Esplanada
    by_alias = await ctx.board(BoardFilter(text="braz"), viewer=None)
    by_other_stop = await ctx.board(BoardFilter(text="INCRA"), viewer=None)  # free text, any case
    by_other_place = await ctx.board(BoardFilter(text="unb"), viewer=None)
    with_seats = await ctx.board(BoardFilter(with_seats=True), viewer=None)
    today = await ctx.board(BoardFilter(day=date(2026, 9, 22)), viewer=None)
    cheap = await ctx.board(BoardFilter(max_price=Decimal(5)), viewer=None)

    assert {r.id for r in by_place} == {ride.id, tomorrow.id}
    assert {r.id for r in by_alias} == {r.id for r in by_other_stop} == {ride.id, tomorrow.id}
    assert by_other_place == ()
    assert [r.id for r in with_seats] == [tomorrow.id]
    assert [r.id for r in today] == [ride.id]
    assert cheap == ()


async def test_from_time_keeps_each_days_rides_from_that_local_hour_on(ctx: Context) -> None:
    """Without `day`, the same clock applies to every day of the list (D-141)."""
    early_today = await ctx.published(hours=11)  # 17:00 local
    late_today = await ctx.published(hours=12)  # 18:00 local
    early_tomorrow = await ctx.published(hours=11 + 24)  # 17:00 local, tomorrow
    late_tomorrow = await ctx.published(hours=13 + 24)  # 19:00 local, tomorrow

    from_18 = await ctx.board(BoardFilter(from_time=time(18, 0)), viewer=None)
    with_day = await ctx.board(BoardFilter(day=date(2026, 9, 22), from_time=time(18, 0)), viewer=None)

    assert {r.id for r in from_18} == {late_today.id, late_tomorrow.id}
    assert {r.id for r in with_day} == {late_today.id}
    assert early_today.id not in {r.id for r in from_18}
    assert early_tomorrow.id not in {r.id for r in from_18}


async def test_until_time_keeps_each_days_rides_up_to_that_local_hour(ctx: Context) -> None:
    """The mirror of `from_time`: inclusive, and judged day by day without `day` (D-176)."""
    early_today = await ctx.published(hours=11)  # 17:00 local
    late_today = await ctx.published(hours=12)  # 18:00 local
    early_tomorrow = await ctx.published(hours=11 + 24)  # 17:00 local, tomorrow
    late_tomorrow = await ctx.published(hours=13 + 24)  # 19:00 local, tomorrow

    until_17 = await ctx.board(BoardFilter(until_time=time(17, 0)), viewer=None)
    with_day = await ctx.board(BoardFilter(day=date(2026, 9, 22), until_time=time(18, 0)), viewer=None)
    window = await ctx.board(BoardFilter(from_time=time(17, 30), until_time=time(18, 30)), viewer=None)
    inverted = await ctx.board(BoardFilter(from_time=time(18, 0), until_time=time(17, 0)), viewer=None)

    assert {r.id for r in until_17} == {early_today.id, early_tomorrow.id}
    assert {r.id for r in with_day} == {early_today.id, late_today.id}
    assert {r.id for r in window} == {late_today.id}
    assert late_tomorrow.id not in {r.id for r in until_17}
    assert inverted == ()


async def test_shown_on_board_says_yes_for_a_listed_ride_and_no_for_each_reason_to_be_out(
    ctx: Context,
) -> None:
    ride = await ctx.published(hours=13)  # 19:00 local, 2026-09-22
    full = await ctx.published(hours=13, seats=0)
    cancelled = await ctx.published(hours=14)
    await CancelRide(ctx.rides, ctx.clock)(ANA.id, cancelled.id)
    departing = await ctx.published(hours=1)
    shown = ShownOnBoard(ctx.rides, ctx.search, ctx.clock, RULES)
    everything = BoardFilter(with_seats=True)

    assert await shown(ride.id, BoardFilter()) is True
    assert await shown(ride.id, BoardFilter(day=date(2026, 9, 22), text="incra", with_seats=True)) is True
    assert await shown(ride.id, BoardFilter(day=date(2026, 9, 23))) is False  # another day
    assert await shown(ride.id, BoardFilter(text="ceilandia")) is False  # the text does not match
    assert await shown(full.id, everything) is False  # no seats
    assert await shown(full.id, BoardFilter()) is True  # unless seats were not asked for
    assert await shown(ride.id, BoardFilter(from_time=time(19, 1))) is False  # before the window
    assert await shown(ride.id, BoardFilter(until_time=time(18, 59))) is False  # after the window
    assert await shown(ride.id, BoardFilter(from_time=time(19, 0), until_time=time(19, 0))) is True
    assert await shown(cancelled.id, BoardFilter()) is False
    assert await shown(uuid4(), BoardFilter()) is False  # no such ride
    assert await shown(departing.id, BoardFilter()) is True

    ctx.clock.at = EPOCH + timedelta(hours=1, minutes=11)  # past the tolerance (D-017)
    assert await shown(departing.id, BoardFilter()) is False
    assert await shown(ride.id, BoardFilter()) is True


async def test_shown_on_board_agrees_with_the_board_for_every_ride_and_filter(ctx: Context) -> None:
    """The single source of matching: asking about one ride is the board's own answer (D-176)."""
    other_route = (CatalogStop(place_id="esplanada"), FreeTextStop(text="Ceilândia Norte"))
    rides = [
        await ctx.published(hours=hours, seats=seats)
        for hours in (7, 11, 12, 13, 31, 35, 37)
        for seats in (0, 2)
    ]
    rides.append(
        await ctx.publish(
            ANA.id,
            car_id=ANA.cars[0].car_id,
            route=other_route,
            departure_at=EPOCH + timedelta(hours=12, minutes=30),
            seats_available=1,
            payment_methods=frozenset({PaymentMethod.PIX}),
        )
    )
    cancelled = await ctx.published(hours=12)
    await CancelRide(ctx.rides, ctx.clock)(ANA.id, cancelled.id)
    rides.append(cancelled)
    shown = ShownOnBoard(ctx.rides, ctx.search, ctx.clock, RULES)
    today, tomorrow = date(2026, 9, 22), date(2026, 9, 23)
    filters = [
        BoardFilter(),
        BoardFilter(day=today),
        BoardFilter(day=tomorrow),
        BoardFilter(text="ceilandia"),
        BoardFilter(text="  "),
        BoardFilter(text="braz"),
        BoardFilter(with_seats=True),
        BoardFilter(max_price=Decimal(5)),
        BoardFilter(from_time=time(18, 0)),
        BoardFilter(until_time=time(18, 0)),
        BoardFilter(from_time=time(17, 0), until_time=time(19, 0)),
        BoardFilter(from_time=time(19, 0), until_time=time(17, 0)),
        BoardFilter(day=today, text="ceilandia", with_seats=True, until_time=time(18, 30)),
        BoardFilter(day=tomorrow, text="incra", with_seats=True, from_time=time(18, 0)),
    ]

    nonempty = 0
    for chosen in filters:
        listed = {r.id for r in await ctx.board(chosen, viewer=None)}
        nonempty += bool(listed)
        for ride in rides:
            assert await shown(ride.id, chosen) == (ride.id in listed), (chosen, ride.id)
    assert nonempty > len(filters) // 2  # the comparison is not between empty answers


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
