from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4
from zoneinfo import ZoneInfo

from hypothesis import strategies as st

from brazcar.rides.domain import (
    CarSnapshot,
    CatalogStop,
    FreeTextStop,
    PaymentMethod,
    RideOffer,
    Stop,
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


@st.composite
def rides(draw: st.DrawFn) -> RideOffer:
    departure = draw(moments)
    published = departure - timedelta(minutes=draw(st.integers(1, 24 * 60)))
    delay = draw(st.none() | st.integers(0, 120).map(lambda m: timedelta(minutes=m)))
    reopened = draw(st.none() | st.integers(1, 600).map(lambda m: published + timedelta(minutes=m)))
    cancelled = draw(st.none() | st.integers(1, 600).map(lambda m: published + timedelta(minutes=m)))
    return RideOffer(
        id=uuid4(),
        driver_id=uuid4(),
        car=car(),
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


def utc(moment: datetime) -> datetime:
    return moment.astimezone(UTC)
