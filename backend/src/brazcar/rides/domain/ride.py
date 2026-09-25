from datetime import datetime, timedelta
from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Self
from uuid import UUID, uuid4

from pydantic import Field, StringConstraints, model_validator

from brazcar.shared.domain.model import FrozenModel
from brazcar.shared.domain.personal_data import has_personal_data

from .driver import AccountId, CarSnapshot, Driver, RegisteredDriver
from .errors import (
    DepartureChangeError,
    FareOnOriginError,
    PersonalDataError,
    RideCancelledError,
    RideLockedError,
)
from .events import RideCancelled, RideEdited, RideEvent, RidePublished, RideReopened, SeatsChanged
from .origin import PublishedOrigin, RideOrigin, WhatsAppOrigin
from .route import Route, fares_of, price_from

DEFAULT_PRICE = Decimal("7.00")
DELAY_LIMIT = timedelta(hours=2)  # counted from the original departure, always (ADR-0004)
NOTES_LIMIT = 500  # characters of plain text, no formatting (D-129)
MAX_SEATS = 4  # what fits in a passenger car; the design of the seat bars assumes it too (D-142)

type RideId = UUID
type Seats = Annotated[int, Field(ge=0, le=MAX_SEATS)]
type Price = Annotated[Decimal, Field(gt=0, max_digits=6, decimal_places=2)]
type Notes = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=NOTES_LIMIT)]


class PaymentMethod(StrEnum):
    CASH = "cash"
    PIX = "pix"


class RideStatus(StrEnum):
    OPEN = "open"
    REOPENED = "reopened"
    FULL = "full"
    DEPARTED = "departed"
    CANCELLED = "cancelled"


class RideOffer(FrozenModel):
    id: RideId
    driver: Driver  # an account with a car, or a WhatsApp phone (ADR-0015)
    origin: RideOrigin = PublishedOrigin()
    route: Route
    departure_at: datetime
    original_departure_at: datetime  # written once, never changed (ADR-0004)
    seats_available: Seats
    price: Price = DEFAULT_PRICE  # with fares on the route, the cheapest of them (D-131)
    payment_methods: frozenset[PaymentMethod] = Field(min_length=1)
    notes: Notes | None = None  # what the driver wants said, free of personal data (D-129)
    published_at: datetime
    reopened_at: datetime | None = None
    cancelled_at: datetime | None = None

    @model_validator(mode="after")
    def _check(self) -> Self:
        for name in ("departure_at", "original_departure_at", "published_at"):
            if getattr(self, name).tzinfo is None:
                message = f"{name} must be timezone-aware"
                raise ValueError(message)
        if isinstance(self.origin, PublishedOrigin) and self.car is None:
            message = "a ride published here always has an account and a car; only an imported one may not"
            raise ValueError(message)
        if self.route[0].fare is not None:
            raise FareOnOriginError
        fares = fares_of(self.route)
        if fares and self.price != min(fares):
            message = "with fares, the price is the cheapest of them; build it with `price_from` (D-131)"
            raise ValueError(message)
        return self

    @property
    def has_fares(self) -> bool:
        """Whether the price is a "from" price: some stop says what it costs to reach it (D-131)."""
        return bool(fares_of(self.route))

    @property
    def driver_id(self) -> AccountId | None:
        """The owning account; none for an external driver, who owns nothing here."""
        return self.driver.account_id if isinstance(self.driver, RegisteredDriver) else None

    @property
    def car(self) -> CarSnapshot | None:
        return self.driver.car if isinstance(self.driver, RegisteredDriver) else None

    @property
    def is_imported(self) -> bool:
        return isinstance(self.origin, WhatsAppOrigin)

    def is_owned_by(self, viewer: AccountId | None) -> bool:
        return viewer is not None and viewer == self.driver_id

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
        notes: str | None = None,
        now: datetime,
    ) -> Change:
        ride = cls(
            id=uuid4(),
            driver=RegisteredDriver(account_id=driver_id, car=car),
            route=route,
            departure_at=departure_at,
            original_departure_at=departure_at,
            seats_available=seats_available,
            price=price_from(route, price),
            payment_methods=payment_methods,
            notes=checked_notes(notes),
            published_at=now,
        )
        return Change(ride=ride, events=(RidePublished(ride_id=ride.id, at=now),))

    @classmethod
    def import_offer(  # noqa: PLR0913 - every field of a new ride comes from the message at once
        cls,
        *,
        driver: Driver,
        origin: WhatsAppOrigin,
        route: Route,
        departure_at: datetime,
        seats_available: int,
        price: Decimal,
        payment_methods: frozenset[PaymentMethod],
        now: datetime,
    ) -> Change:
        """A ride read from a group (ADR-0015): the account with that phone if there is one, else
        an external driver; no car either way; the original words kept. Never any notes: the words
        of the message already say what the driver said (D-129)."""
        ride = cls(
            id=uuid4(),
            driver=driver,
            origin=origin,
            route=route,
            departure_at=departure_at,
            original_departure_at=departure_at,
            seats_available=seats_available,
            price=price_from(route, price),
            payment_methods=payment_methods,
            published_at=now,
        )
        return Change(ride=ride, events=(RidePublished(ride_id=ride.id, at=now),))

    def repeat(self, *, departure_at: datetime, car: CarSnapshot, now: datetime) -> Change:
        """A new ride with this one's route, fares, seats, price, payment and notes; today's car."""
        if not isinstance(self.driver, RegisteredDriver):
            message = "only a registered driver repeats a ride"
            raise TypeError(message)
        return RideOffer.publish(
            driver_id=self.driver.account_id,
            car=car,
            route=self.route,
            departure_at=departure_at,
            seats_available=max(self.seats_available, 1),
            price=self.price,
            payment_methods=self.payment_methods,
            notes=self.notes,
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

    def edit(  # noqa: PLR0913 - one call edits every editable field at once
        self,
        *,
        route: Route | None = None,
        departure_at: datetime | None = None,
        price: Decimal | None = None,
        payment_methods: frozenset[PaymentMethod] | None = None,
        notes: str | None = None,
        now: datetime,
    ) -> Change:
        """Absent means unchanged; for the notes, empty text is how they are erased (D-129)."""
        self._require_changeable(now)
        changes: dict[str, object] = {}
        if route is not None:
            changes["route"] = route
        priced = price_from(route if route is not None else self.route, price or self.price)
        if priced != self.price:
            changes["price"] = priced
        if payment_methods is not None:
            changes["payment_methods"] = payment_methods
        if notes is not None and (edited := checked_notes(notes)) != self.notes:
            changes["notes"] = edited
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


def checked_notes(text: str | None) -> str | None:
    """Blank is no notes; a phone, an e-mail or a plate is refused, never redacted (D-129).

    Whoever publishes owns the words and can fix them, so the answer is a refusal; the importing
    redacts instead, because nobody there can be asked (D-128). The pattern is the same one.
    """
    if text is None:
        return None
    trimmed = text.strip()
    if not trimmed:
        return None
    if has_personal_data(trimmed):
        raise PersonalDataError
    return trimmed
