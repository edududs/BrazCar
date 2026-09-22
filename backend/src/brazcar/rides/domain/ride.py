from datetime import datetime, timedelta
from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Self
from uuid import UUID, uuid4

from pydantic import Field, StringConstraints, model_validator

from brazcar.shared.domain.model import FrozenModel

from .errors import DepartureChangeError, RideCancelledError, RideLockedError
from .events import RideCancelled, RideEdited, RideEvent, RidePublished, RideReopened, SeatsChanged
from .route import Route

DEFAULT_PRICE = Decimal("7.00")
DELAY_LIMIT = timedelta(hours=2)  # counted from the original departure, always (ADR-0004)

type RideId = UUID
type AccountId = UUID
type ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
type Seats = Annotated[int, Field(ge=0, le=8)]
type Price = Annotated[Decimal, Field(gt=0, max_digits=6, decimal_places=2)]


class PaymentMethod(StrEnum):
    CASH = "cash"
    PIX = "pix"


class RideStatus(StrEnum):
    OPEN = "open"
    REOPENED = "reopened"
    FULL = "full"
    DEPARTED = "departed"
    CANCELLED = "cancelled"


class CarSnapshot(FrozenModel):
    """The car as it was when the ride was published (D-023). The plate never leaves by a list."""

    car_id: UUID
    model: ShortText
    color: ShortText
    plate: ShortText


class RideOffer(FrozenModel):
    id: RideId
    driver_id: AccountId
    car: CarSnapshot
    route: Route
    departure_at: datetime
    original_departure_at: datetime  # written once, never changed (ADR-0004)
    seats_available: Seats
    price: Price = DEFAULT_PRICE
    payment_methods: frozenset[PaymentMethod] = Field(min_length=1)
    published_at: datetime
    reopened_at: datetime | None = None
    cancelled_at: datetime | None = None

    @model_validator(mode="after")
    def _check(self) -> Self:
        for name in ("departure_at", "original_departure_at", "published_at"):
            if getattr(self, name).tzinfo is None:
                message = f"{name} must be timezone-aware"
                raise ValueError(message)
        return self

    # --- publishing -------------------------------------------------------------------------

    @classmethod
    def publish(  # noqa: PLR0913 - every field of a new ride is a decision of the driver
        cls,
        *,
        driver_id: AccountId,
        car: CarSnapshot,
        route: Route,
        departure_at: datetime,
        seats_available: int,
        price: Decimal = DEFAULT_PRICE,
        payment_methods: frozenset[PaymentMethod],
        now: datetime,
    ) -> Change:
        ride = cls(
            id=uuid4(),
            driver_id=driver_id,
            car=car,
            route=route,
            departure_at=departure_at,
            original_departure_at=departure_at,
            seats_available=seats_available,
            price=price,
            payment_methods=payment_methods,
            published_at=now,
        )
        return Change(ride=ride, events=(RidePublished(ride_id=ride.id, at=now),))

    def repeat(self, *, departure_at: datetime, car: CarSnapshot, now: datetime) -> Change:
        """A new ride with this one's route, seats, price and payment; the car as it is today."""
        return RideOffer.publish(
            driver_id=self.driver_id,
            car=car,
            route=self.route,
            departure_at=departure_at,
            seats_available=max(self.seats_available, 1),
            price=self.price,
            payment_methods=self.payment_methods,
            now=now,
        )

    # --- state -------------------------------------------------------------------------------

    def status(self, now: datetime, tolerance: timedelta) -> RideStatus:
        """Pure function of four facts, read in this order (ADR-0003)."""
        if self.cancelled_at is not None:
            return RideStatus.CANCELLED
        if now > self.departure_at + tolerance:
            return RideStatus.DEPARTED
        if self.seats_available == 0:
            return RideStatus.FULL
        return RideStatus.REOPENED if self.reopened_at is not None else RideStatus.OPEN

    @property
    def locked_at(self) -> datetime:
        """Past this moment only cancelling is left (ADR-0004)."""
        return self.original_departure_at + DELAY_LIMIT

    def is_locked(self, now: datetime) -> bool:
        return now > self.locked_at

    # --- changes -----------------------------------------------------------------------------

    def change_seats(self, seats: int, now: datetime) -> Change:
        """Zero closes; going up from zero reopens (ADR-0003). Either way, the same gesture."""
        self._require_changeable(now)
        if seats == self.seats_available:
            return Change(ride=self, events=())
        events: list[RideEvent] = [
            SeatsChanged(ride_id=self.id, at=now, seats_before=self.seats_available, seats_after=seats)
        ]
        changes: dict[str, object] = {"seats_available": seats}
        if self.seats_available == 0 and seats > 0:
            changes["reopened_at"] = now
            events.append(RideReopened(ride_id=self.id, at=now))
        return Change(ride=self.evolve(**changes), events=tuple(events))

    def edit(
        self,
        *,
        route: Route | None = None,
        departure_at: datetime | None = None,
        price: Decimal | None = None,
        payment_methods: frozenset[PaymentMethod] | None = None,
        now: datetime,
    ) -> Change:
        self._require_changeable(now)
        changes: dict[str, object] = {}
        if route is not None:
            changes["route"] = route
        if price is not None:
            changes["price"] = price
        if payment_methods is not None:
            changes["payment_methods"] = payment_methods
        if departure_at is not None and departure_at != self.departure_at:
            self._check_departure_change(departure_at, now)
            changes["departure_at"] = departure_at
        if not changes:
            return Change(ride=self, events=())
        edited = RideEdited(
            ride_id=self.id,
            at=now,
            departure_before=self.departure_at,
            departure_after=departure_at or self.departure_at,
        )
        return Change(ride=self.evolve(**changes), events=(edited,))

    def cancel(self, now: datetime) -> Change:
        if self.cancelled_at is not None:
            raise RideCancelledError
        cancelled = self.evolve(cancelled_at=now)
        return Change(ride=cancelled, events=(RideCancelled(ride_id=self.id, at=now),))

    def _require_changeable(self, now: datetime) -> None:
        if self.cancelled_at is not None:
            raise RideCancelledError
        if self.is_locked(now):
            raise RideLockedError

    def _check_departure_change(self, new_departure: datetime, now: datetime) -> None:
        """Before departure: same day only. After: only later, and never past the delay limit."""
        if now <= self.departure_at:
            tz = self.original_departure_at.tzinfo
            if new_departure.astimezone(tz).date() != self.original_departure_at.astimezone(tz).date():
                raise DepartureChangeError(DepartureChangeError.SAME_DAY)
            return
        if new_departure <= self.departure_at:
            raise DepartureChangeError(DepartureChangeError.ONLY_LATER)
        if new_departure > self.locked_at:
            raise DepartureChangeError(DepartureChangeError.TOO_LATE)


class Change(FrozenModel):
    """A ride after a change, with what the change was. The repository stores both (ADR-0005)."""

    ride: RideOffer
    events: tuple[RideEvent, ...]
