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
)

BRASILIA = ZoneInfo("America/Sao_Paulo")
EPOCH = datetime(2026, 9, 22, 6, 0, tzinfo=BRASILIA)

place_ids = st.sampled_from(["brazlandia", "estrutural", "eixo-monumental", "esplanada", "unb"])
stops: st.SearchStrategy[Stop] = st.one_of(
    place_ids.map(lambda place_id: CatalogStop(place_id=place_id)),
    st.text("abcdefghij ", min_size=1, max_size=12).filter(str.strip).map(lambda t: FreeTextStop(text=t)),
)
routes = st.lists(stops, min_size=2, max_size=5).map(tuple)
moments = st.integers(-3 * 24 * 60, 3 * 24 * 60).map(lambda minutes: EPOCH + timedelta(minutes=minutes))
seats = st.integers(0, 8)
prices = st.integers(1, 5000).map(lambda cents: Decimal(cents) / 100)
payment_sets = st.frozensets(st.sampled_from(PaymentMethod), min_size=1)


def car() -> CarSnapshot:
    return CarSnapshot(car_id=uuid4(), model="Gol", color="prata", plate="ABC1234")


def registered(account_id: UUID | None = None) -> RegisteredDriver:
    return RegisteredDriver(account_id=account_id or uuid4(), car=car())


def external(phone: str = "5561999990009") -> ExternalDriver:
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
    return RideOffer(
        id=uuid4(),
        driver=registered(),
        route=draw(routes),
        departure_at=departure + (delay or timedelta()),
        original_departure_at=departure,
        seats_available=draw(seats),
        price=draw(prices),
        payment_methods=draw(payment_sets),
        published_at=published,
        reopened_at=reopened,
        cancelled_at=cancelled,
    )


@st.composite
def imported_rides(draw: st.DrawFn) -> RideOffer:
    """A ride read from a group: external driver, WhatsApp origin, never cancelled by anyone."""
    ride = draw(rides())
    digits = draw(st.integers(10**9, 10**10 - 1))
    return ride.evolve(
        driver=external(f"5561{digits}"),
        origin=whatsapp_origin(ride.published_at),
        departure_at=ride.departure_at.replace(second=0, microsecond=0),
        original_departure_at=ride.original_departure_at.replace(second=0, microsecond=0),
        cancelled_at=None,
    )


def utc(moment: datetime) -> datetime:
    return moment.astimezone(UTC)


def published(ride: RideOffer) -> RidePublished:
    """The event a stored ride would have been born with."""
    return RidePublished(ride_id=ride.id, at=ride.published_at)
