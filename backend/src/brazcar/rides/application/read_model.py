"""What the board shows. Never the phone, never the plate (ADR-0006); status and actions ready (ADR-0011)."""

from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Literal

from brazcar.rides.domain import (
    AccountId,
    Actions,
    CatalogStop,
    PaymentMethod,
    RideId,
    RideOffer,
    RideStatus,
    WhatsAppOrigin,
    allowed_actions,
)
from brazcar.shared.domain.model import FrozenModel

type OriginKind = Literal["published", "whatsapp"]


class StopView(FrozenModel):
    place_id: str | None
    label: str
    fare: Decimal | None  # what it costs to come this far from the origin, when the driver said (D-131)


class CarView(FrozenModel):
    """Model and color only: enough to spot the car, never enough to find it (D-031)."""

    model: str
    color: str


class OriginMessageView(FrozenModel):
    """The original words, for the passenger's own judgement (D-117)."""

    text: str
    group_label: str
    sent_at: datetime


class BoardRide(FrozenModel):
    id: RideId
    driver_name: str
    car: CarView | None  # none for a ride read from WhatsApp (ADR-0015)
    origin: OriginKind
    origin_message: OriginMessageView | None
    stops: tuple[StopView, ...]
    notes: str | None  # what the driver wanted said, in plain words (D-129)
    departure_at: datetime
    seats_available: int
    price: Decimal
    has_fares: bool  # the price is the cheapest fare, so the screen says "a partir de" (D-131)
    payment_methods: tuple[PaymentMethod, ...]
    status: RideStatus
    actions: Actions
    is_mine: bool


class BoardFilter(FrozenModel):
    """What the passenger asks for. Everything optional; the URL of the board carries it."""

    day: date | None = None
    text: str | None = None  # "passa por": any stop, catalog place or "other" (D-101)
    with_seats: bool = False
    max_price: Decimal | None = None
    # The departure's local hour of the day, at or after it (D-141). Without `day`, judges every
    # day of the list by its own local hour; with `day`, only that day passes at all.
    from_time: time | None = None


def to_board_ride(  # noqa: PLR0913 - a projection joins several sources by design
    ride: RideOffer,
    *,
    driver_name: str,
    labels: dict[str, str],
    viewer: AccountId | None,
    now: datetime,
    tolerance: timedelta,
) -> BoardRide:
    car = ride.car
    origin = ride.origin
    return BoardRide(
        id=ride.id,
        driver_name=driver_name,
        car=None if car is None else CarView(model=car.model, color=car.color),
        origin=origin.kind,
        origin_message=(
            OriginMessageView(
                text=origin.message_text, group_label=origin.group_label, sent_at=origin.sent_at
            )
            if isinstance(origin, WhatsAppOrigin)
            else None
        ),
        stops=tuple(
            StopView(
                place_id=stop.place_id,
                label=labels.get(stop.place_id, stop.place_id),
                fare=stop.fare,
            )
            if isinstance(stop, CatalogStop)
            else StopView(place_id=None, label=stop.text, fare=stop.fare)
            for stop in ride.route
        ),
        notes=ride.notes,
        departure_at=ride.departure_at,
        seats_available=ride.seats_available,
        price=ride.price,
        has_fares=ride.has_fares,
        payment_methods=tuple(sorted(ride.payment_methods)),
        status=ride.status(now, tolerance),
        actions=allowed_actions(ride, viewer, now, tolerance),
        is_mine=ride.is_owned_by(viewer),
    )
