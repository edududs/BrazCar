from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from hypothesis import strategies as st

from brazcar.rides.domain import (
    CarSnapshot,
    CatalogStop,
    ExternalDriver,
    FreeTextStop,
    PaymentMethod,
    RegisteredDriver,
    RideOffer,
    RidePublished,
    Stop,
    WhatsAppOrigin,
    price_from,
)
from brazcar.shared.domain.phone import PhoneNumber
from tests.shared.phone_strategies import brazilian_mobiles

BRASILIA = ZoneInfo("America/Sao_Paulo")
EPOCH = datetime(2026, 9, 22, 6, 0, tzinfo=BRASILIA)

place_ids = st.sampled_from(["brazlandia", "estrutural", "eixo-monumental", "esplanada", "unb"])
prices = st.integers(1, 5000).map(lambda cents: Decimal(cents) / 100)
fares: st.SearchStrategy[Decimal | None] = st.none() | prices


def _stops(fare: st.SearchStrategy[Decimal | None]) -> st.SearchStrategy[Stop]:
    return st.one_of(
        st.tuples(place_ids, fare).map(lambda pair: CatalogStop(place_id=pair[0], fare=pair[1])),
        st.tuples(st.text("abcdefghij ", min_size=1, max_size=12).filter(str.strip), fare).map(
            lambda pair: FreeTextStop(text=pair[0], fare=pair[1])
        ),
    )


stops = _stops(st.none())  # where the ride leaves from never has a fare (D-131)
fared_stops = _stops(fares)
routes = st.tuples(stops, st.lists(fared_stops, min_size=1, max_size=4)).map(lambda pair: (pair[0], *pair[1]))
moments = st.integers(-3 * 24 * 60, 3 * 24 * 60).map(lambda minutes: EPOCH + timedelta(minutes=minutes))
seats = st.integers(0, 8)
notes = st.none() | st.text("abcdefg .,", min_size=1, max_size=40).filter(str.strip)
payment_sets = st.frozensets(st.sampled_from(PaymentMethod), min_size=1)


def car() -> CarSnapshot:
    return CarSnapshot(car_id=uuid4(), model="Gol", color="prata", plate="ABC1234")


EXTERNAL_PHONE = PhoneNumber.from_jid_user("5561999990009")


def registered(account_id: UUID | None = None) -> RegisteredDriver:
    return RegisteredDriver(account_id=account_id or uuid4(), car=car())


def external(phone: PhoneNumber = EXTERNAL_PHONE) -> ExternalDriver:
    return ExternalDriver(phone=phone, display_name="Motorista do grupo")


def whatsapp_origin(sent_at: datetime = EPOCH) -> WhatsAppOrigin:
    return WhatsAppOrigin(
        message_text="03 VAGAS\nSaindo às 19:30\nEsplanada\nBrazlândia", group_label="Rota", sent_at=sent_at
    )


@st.composite
def rides(draw: st.DrawFn) -> RideOffer:
    departure = draw(moments)
    published = departure - timedelta(minutes=draw(st.integers(1, 24 * 60)))
    delay = draw(st.none() | st.integers(0, 120).map(lambda m: timedelta(minutes=m)))
    reopened = draw(st.none() | st.integers(1, 600).map(lambda m: published + timedelta(minutes=m)))
    cancelled = draw(st.none() | st.integers(1, 600).map(lambda m: published + timedelta(minutes=m)))
    route = draw(routes)
    return RideOffer(
        id=uuid4(),
        driver=registered(),
        route=route,
        departure_at=departure + (delay or timedelta()),
        original_departure_at=departure,
        seats_available=draw(seats),
        price=price_from(route, draw(prices)),  # with fares, the cheapest of them (D-131)
        payment_methods=draw(payment_sets),
        notes=draw(notes),
        published_at=published,
        reopened_at=reopened,
        cancelled_at=cancelled,
    )


@st.composite
def imported_rides(draw: st.DrawFn) -> RideOffer:
    """A ride read from a group: external driver, WhatsApp origin, never cancelled by anyone."""
    ride = draw(rides())
    return ride.evolve(
        driver=external(draw(brazilian_mobiles)),
        origin=whatsapp_origin(ride.published_at),
        notes=None,  # an import never writes notes: the original words already say it (D-129)
        departure_at=ride.departure_at.replace(second=0, microsecond=0),
        original_departure_at=ride.original_departure_at.replace(second=0, microsecond=0),
        cancelled_at=None,
    )


def utc(moment: datetime) -> datetime:
    return moment.astimezone(UTC)


def published(ride: RideOffer) -> RidePublished:
    """The event a stored ride would have been born with."""
    return RidePublished(ride_id=ride.id, at=ride.published_at)
