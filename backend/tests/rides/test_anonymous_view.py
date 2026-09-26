"""The anonymous view (D-171): a viewer without a session sees the ride, never a person."""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Literal
from uuid import UUID, uuid4

import pytest
from hypothesis import given
from hypothesis import strategies as st

from brazcar.rides.application import (
    BoardFilter,
    BoardRide,
    DriverAccount,
    DriverCar,
    ImportRide,
    ListBoard,
    PublishRide,
    RideRules,
    ShowRide,
    to_board_ride,
)
from brazcar.rides.domain import Actions, CatalogStop, FreeTextStop, PaymentMethod, RideOffer
from brazcar.shared.domain.phone import PhoneNumber

from .fakes import FixedClock, InMemoryDrivers, InMemoryRideRepository, catalog_places, indexed_search
from .strategies import EPOCH, EXTERNAL_PHONE, imported_rides, moments, rides, whatsapp_origin

TOLERANCE = timedelta(minutes=10)
LABELS = {"brazlandia": "Brazlândia", "esplanada": "Esplanada", "unb": "UnB"}
PERSONAL = frozenset({"driver_name", "car", "origin_message", "notes", "actions", "is_mine"})
KEPT = frozenset(
    {
        "id",
        "origin",
        "stops",
        "departure_at",
        "seats_available",
        "price",
        "has_fares",
        "payment_methods",
        "status",
    }
)
ANA = DriverAccount(
    id=uuid4(),
    display_name="Ana Paula",
    phone=PhoneNumber.parse("+5561999990001"),
    cars=(DriverCar(car_id=uuid4(), model="Gol", color="prata", plate="ABC1234"),),
)
BIA = DriverAccount(id=uuid4(), display_name="Bia", phone=PhoneNumber.parse("+5561999990002"), cars=())
ROUTE = (CatalogStop(place_id="brazlandia"), FreeTextStop(text="Incra 8"), CatalogStop(place_id="esplanada"))
DEPARTURE = EPOCH + timedelta(hours=13)


def test_every_field_of_the_card_is_either_kept_or_hidden() -> None:
    """A new field has to be sorted into one of the two, or the anonymous view could leak it."""
    assert set(BoardRide.model_fields) == KEPT | PERSONAL
    assert not KEPT & PERSONAL


@given(
    ride=st.one_of(rides(), imported_rides()),
    name=st.text(min_size=1, max_size=30),
    seen_by=st.sampled_from(["nobody", "owner", "stranger"]),
    now=moments,
)
def test_the_anonymous_view_drops_every_person_and_keeps_the_ride(
    ride: RideOffer, name: str, seen_by: Literal["nobody", "owner", "stranger"], now: datetime
) -> None:
    viewer = {"nobody": None, "owner": ride.driver_id, "stranger": uuid4()}[seen_by]
    card = to_board_ride(ride, driver_name=name, labels=LABELS, viewer=viewer, now=now, tolerance=TOLERANCE)

    anonymous = card.anonymized()

    assert anonymous.driver_name is None
    assert anonymous.car is None
    assert anonymous.origin_message is None
    assert anonymous.notes is None
    assert anonymous.actions == Actions()
    assert not any(anonymous.actions.model_dump().values())  # every action false, no delay either
    assert anonymous.is_mine is False
    assert anonymous.model_dump(include=set(KEPT)) == card.model_dump(include=set(KEPT))


# --- use cases -------------------------------------------------------------------------------------


class Context:
    def __init__(self) -> None:
        rides = InMemoryRideRepository()
        drivers = InMemoryDrivers(ANA, BIA)
        places = catalog_places()
        search = indexed_search()
        clock = FixedClock()
        self.publish = PublishRide(rides, drivers, places, search, clock)
        self.import_ride = ImportRide(rides, drivers, places, search, clock)
        self.board = ListBoard(rides, drivers, places, search, clock, RideRules())
        self.show = ShowRide(rides, drivers, places, clock, RideRules())

    async def published(self) -> RideOffer:
        return await self.publish(
            ANA.id,
            car_id=ANA.cars[0].car_id,
            route=ROUTE,
            departure_at=DEPARTURE,
            seats_available=3,
            payment_methods=frozenset({PaymentMethod.PIX}),
            notes="Levo mala pequena",
        )

    async def imported(self) -> RideOffer:
        result = await self.import_ride(
            sender_phone=EXTERNAL_PHONE,
            sender_name="Zé do grupo",
            origin=whatsapp_origin(),
            route=ROUTE,
            departure_at=DEPARTURE + timedelta(hours=1),
            seats_available=2,
            price=Decimal("7.00"),
            payment_methods=frozenset({PaymentMethod.CASH}),
        )
        return result.ride


@pytest.fixture
def ctx() -> Context:
    return Context()


async def test_without_a_session_board_and_detail_show_no_person(ctx: Context) -> None:
    published = await ctx.published()
    imported = await ctx.imported()

    board = await ctx.board(BoardFilter(), viewer=None)
    signed_in = await ctx.board(BoardFilter(), viewer=BIA.id)
    details = [await ctx.show(ride.id, viewer=None) for ride in (published, imported)]

    assert [card.id for card in board] == [published.id, imported.id]
    assert board == tuple(card.anonymized() for card in signed_in)
    assert tuple(details) == board
    assert [card.origin for card in board] == ["published", "whatsapp"]
    assert all(card.driver_name is None and card.car is None for card in board)
    assert all(card.notes is None and card.origin_message is None for card in board)
    assert all(card.actions == Actions() for card in board)


async def test_with_a_session_board_and_detail_are_what_they_were(ctx: Context) -> None:
    published = await ctx.published()
    imported = await ctx.imported()

    mine, theirs = await ctx.board(BoardFilter(), viewer=BIA.id)
    detail = await ctx.show(published.id, viewer=ANA.id)

    assert mine.driver_name == "Ana Paula"
    assert mine.car is not None
    assert mine.notes == "Levo mala pequena"
    assert mine.actions.can_contact is True
    assert theirs.id == imported.id
    assert theirs.driver_name == "Zé do grupo"
    assert theirs.origin_message is not None
    assert detail.is_mine is True
    assert detail.actions.can_edit is True


@pytest.mark.parametrize("viewer", [None, BIA.id], ids=["anonymous", "signed-in"])
async def test_the_search_never_finds_a_ride_by_its_drivers_name(ctx: Context, viewer: UUID | None) -> None:
    """`q` reads only the stops (D-101), so the filter is no oracle of who drives (D-171)."""
    await ctx.published()
    await ctx.imported()

    by_name = await ctx.board(BoardFilter(text="Paula"), viewer=viewer)
    by_sender = await ctx.board(BoardFilter(text="Zé do grupo"), viewer=viewer)
    by_stop = await ctx.board(BoardFilter(text="Incra"), viewer=viewer)

    assert by_name == ()
    assert by_sender == ()
    assert len(by_stop) == 2
