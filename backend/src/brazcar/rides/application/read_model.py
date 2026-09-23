"""What the board shows. Never the phone, never the plate (ADR-0006); status and actions ready (ADR-0011)."""

from datetime import date, datetime, timedelta
from decimal import Decimal

from brazcar.rides.domain import (
    AccountId,
    Actions,
    CatalogStop,
    PaymentMethod,
    RideId,
    RideOffer,
    RideStatus,
    allowed_actions,
)
from brazcar.shared.domain.model import FrozenModel


class StopView(FrozenModel):
    place_id: str | None
    label: str


class BoardRide(FrozenModel):
    id: RideId
    driver_name: str
    car_model: str
    car_color: str
    stops: tuple[StopView, ...]
    departure_at: datetime
    seats_available: int
    price: Decimal
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


def to_board_ride(  # noqa: PLR0913 - a projection joins several sources by design
    ride: RideOffer,
    *,
    driver_name: str,
    labels: dict[str, str],
    viewer: AccountId | None,
    now: datetime,
    tolerance: timedelta,
) -> BoardRide:
    return BoardRide(
        id=ride.id,
        driver_name=driver_name,
        car_model=ride.car.model,
        car_color=ride.car.color,
        stops=tuple(
            StopView(place_id=stop.place_id, label=labels.get(stop.place_id, stop.place_id))
            if isinstance(stop, CatalogStop)
            else StopView(place_id=None, label=stop.text)
            for stop in ride.route
        ),
        departure_at=ride.departure_at,
        seats_available=ride.seats_available,
        price=ride.price,
        payment_methods=tuple(sorted(ride.payment_methods)),
        status=ride.status(now, tolerance),
        actions=allowed_actions(ride, viewer, now, tolerance),
        is_mine=viewer == ride.driver_id,
    )
