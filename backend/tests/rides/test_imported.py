"""Rides read from WhatsApp (ADR-0015): driver by phone, no car, no owner, the original words kept."""

from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError

from brazcar.rides.application import (
    BoardFilter,
    DriverAccount,
    DriverCar,
    ForgetRides,
    ImportRide,
    ListBoard,
    MyRides,
    RequestContact,
    RideRules,
    ShowRide,
)
from brazcar.rides.domain import (
    CatalogStop,
    ExternalDriver,
    FreeTextStop,
    PaymentMethod,
    PublishedOrigin,
    RegisteredDriver,
    RideOffer,
    RideStatus,
    UnknownPlaceError,
    allowed_actions,
)

from .fakes import (
    FixedClock,
    InMemoryDrivers,
    InMemoryRateLimiter,
    InMemoryRideRepository,
    RecordingContacts,
    catalog_places,
    indexed_search,
)
from .strategies import EPOCH, car, external, registered, whatsapp_origin

TOLERANCE = timedelta(minutes=10)
ROUTE = (CatalogStop(place_id="esplanada"), FreeTextStop(text="Vila"), CatalogStop(place_id="brazlandia"))
DEPARTURE = EPOCH + timedelta(hours=13)
ANA = DriverAccount(
    id=uuid4(),
    display_name="Ana",
    phone="+5561999990001",
    cars=(DriverCar(car_id=uuid4(), model="Gol", color="prata", plate="ABC1234"),),
)
RULES = RideRules()


def imported(driver: RegisteredDriver | ExternalDriver | None = None) -> RideOffer:
    return RideOffer.import_offer(
        driver=driver or external(),
        origin=whatsapp_origin(),
        route=ROUTE,
        departure_at=DEPARTURE,
        seats_available=3,
        price=Decimal("7.00"),
        payment_methods=frozenset({PaymentMethod.PIX}),
        now=EPOCH,
    ).ride


# --- domain ----------------------------------------------------------------------------------------


def test_an_imported_ride_has_no_owner_no_car_and_keeps_the_original_words() -> None:
    ride = imported()

    assert ride.driver_id is None
    assert ride.car is None
    assert ride.is_imported
    assert not ride.is_owned_by(None)
    assert not ride.is_owned_by(uuid4())
    assert ride.status(EPOCH, TOLERANCE) is RideStatus.OPEN
    assert ride.status(DEPARTURE + TOLERANCE + timedelta(seconds=1), TOLERANCE) is RideStatus.DEPARTED


def test_nobody_gets_owner_actions_on_an_external_ride_and_a_viewer_may_contact() -> None:
    ride = imported()

    anonymous = allowed_actions(ride, None, EPOCH, TOLERANCE)
    someone = allowed_actions(ride, uuid4(), EPOCH, TOLERANCE)

    assert not any(
        (anonymous.can_edit, anonymous.can_change_seats, anonymous.can_cancel, anonymous.can_repeat)
    )
    assert anonymous.can_contact is False
    assert someone.can_contact is True
    assert someone.can_edit is False


def test_a_ride_linked_to_an_account_belongs_to_it_even_without_a_car() -> None:
    ride = imported(RegisteredDriver(account_id=ANA.id, car=None))

    assert ride.driver_id == ANA.id
    assert ride.car is None
    assert ride.is_owned_by(ANA.id)
    assert allowed_actions(ride, ANA.id, EPOCH, TOLERANCE).can_change_seats is True


def test_only_an_imported_ride_may_come_without_a_car_or_an_account() -> None:
    with pytest.raises(ValidationError):
        imported().evolve(origin=PublishedOrigin())
    with pytest.raises(ValidationError):
        imported(RegisteredDriver(account_id=ANA.id, car=None)).evolve(origin=PublishedOrigin())
    imported(registered()).evolve(origin=PublishedOrigin(), driver=registered())  # a car makes it fine


def test_an_external_ride_cannot_be_repeated() -> None:
    with pytest.raises(TypeError, match="registered"):
        imported().repeat(departure_at=DEPARTURE + timedelta(days=1), car=car(), now=EPOCH)


def test_an_imported_ride_carries_fares_but_never_notes() -> None:
    """The message is priced per stop like the groups write it (D-131); the words are the origin's."""
    fared = (ROUTE[0], ROUTE[1].evolve(fare=Decimal("9.00")), ROUTE[2].evolve(fare=Decimal("7.00")))

    ride = RideOffer.import_offer(
        driver=external(),
        origin=whatsapp_origin(),
        route=fared,
        departure_at=DEPARTURE,
        seats_available=3,
        price=Decimal("20.00"),
        payment_methods=frozenset({PaymentMethod.PIX}),
        now=EPOCH,
    ).ride

    assert ride.price == Decimal("7.00")
    assert ride.has_fares is True
    assert ride.notes is None


# --- use cases -------------------------------------------------------------------------------------


class Context:
    def __init__(self) -> None:
        self.rides = InMemoryRideRepository()
        self.drivers = InMemoryDrivers(ANA)
        self.places = catalog_places()
        self.search = indexed_search()
        self.clock = FixedClock()
        self.import_ride = ImportRide(self.rides, self.drivers, self.places, self.search, self.clock)
        self.forget = ForgetRides(self.rides, self.search)
        self.board = ListBoard(self.rides, self.drivers, self.places, self.search, self.clock, RULES)
        self.mine = MyRides(self.rides, self.drivers, self.places, self.clock, RULES)
        self.show = ShowRide(self.rides, self.drivers, self.places, self.clock, RULES)
        self.contacts = RecordingContacts()
        self.contact = RequestContact(
            self.rides, self.drivers, self.contacts, InMemoryRateLimiter(self.clock), self.clock, RULES
        )

    async def imported(self, phone: str = "5561999990009", name: str = "Zé do grupo") -> RideOffer:
        result = await self.import_ride(
            sender_phone=phone,
            sender_name=name,
            origin=whatsapp_origin(),
            route=ROUTE,
            departure_at=DEPARTURE,
            seats_available=2,
            price=Decimal("7.00"),
            payment_methods=frozenset({PaymentMethod.CASH, PaymentMethod.PIX}),
        )
        return result.ride


@pytest.fixture
def ctx() -> Context:
    return Context()


async def test_an_unknown_phone_makes_an_external_driver_and_a_known_one_links_the_account(
    ctx: Context,
) -> None:
    stranger = await ctx.imported()
    ana = await ctx.imported(phone="5561999990001", name="Ana no grupo")

    assert stranger.driver == ExternalDriver(phone="5561999990009", display_name="Zé do grupo")
    assert ana.driver == RegisteredDriver(account_id=ANA.id, car=None)
    assert ctx.rides.revision == 2
    assert [r.id for r in await ctx.mine(ANA.id)] == [ana.id]


async def test_a_second_post_for_the_same_departure_joins_the_first_ride(ctx: Context) -> None:
    first = await ctx.imported()
    again = await ctx.import_ride(
        sender_phone="5561999990009",
        sender_name="Zé do grupo",
        origin=whatsapp_origin(EPOCH + timedelta(minutes=5)),
        route=ROUTE[:2],
        departure_at=DEPARTURE,
        seats_available=1,
        price=Decimal("7.00"),
        payment_methods=frozenset({PaymentMethod.PIX}),
    )
    other_time = await ctx.import_ride(
        sender_phone="5561999990009",
        sender_name="Zé do grupo",
        origin=whatsapp_origin(),
        route=ROUTE,
        departure_at=DEPARTURE + timedelta(hours=1),
        seats_available=1,
        price=Decimal("7.00"),
        payment_methods=frozenset({PaymentMethod.PIX}),
    )

    assert again.created is False
    assert again.ride == first
    assert other_time.created is True
    assert len(ctx.rides.rides) == 2


async def test_the_catalog_still_guards_the_stops_of_an_imported_ride(ctx: Context) -> None:
    with pytest.raises(UnknownPlaceError):
        await ctx.import_ride(
            sender_phone="5561999990009",
            sender_name="Zé",
            origin=whatsapp_origin(),
            route=(CatalogStop(place_id="nowhere"), FreeTextStop(text="Vila")),
            departure_at=DEPARTURE,
            seats_available=1,
            price=Decimal("7.00"),
            payment_methods=frozenset({PaymentMethod.PIX}),
        )


async def test_the_board_shows_the_sender_name_the_origin_and_no_car(ctx: Context) -> None:
    ride = await ctx.imported()

    (card,) = await ctx.board(BoardFilter(), viewer=None)
    detail = await ctx.show(ride.id, viewer=ANA.id)

    assert card.driver_name == "Zé do grupo"
    assert card.car is None
    assert card.origin == "whatsapp"
    assert card.origin_message is not None
    assert card.origin_message.group_label == "Rota"
    assert card.is_mine is False
    assert detail.actions.can_contact is True
    assert detail.actions.can_edit is False


async def test_contact_goes_to_the_sender_without_a_plate(ctx: Context) -> None:
    ride = await ctx.imported()

    contact = await ctx.contact(ANA.id, ride.id)

    assert contact.whatsapp_url.startswith("https://wa.me/5561999990009?text=")
    assert contact.plate is None
    assert len(ctx.contacts.recorded) == 1


async def test_forgetting_removes_external_rides_only_and_bumps_the_board(ctx: Context) -> None:
    stranger = await ctx.imported()
    ana = await ctx.imported(phone="5561999990001")
    before = ctx.rides.revision

    forgotten = await ctx.forget([stranger.id, ana.id, uuid4()])

    assert forgotten == 1
    assert set(ctx.rides.rides) == {ana.id}
    assert ctx.rides.revision == before + 1
    assert await ctx.search.matching("esplanada", [stranger.id]) == frozenset()
