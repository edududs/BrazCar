from collections.abc import Collection
from datetime import datetime
from typing import Literal, Protocol
from uuid import UUID

from brazcar.rides.domain import AccountId, PlaceId, RideEvent, RideId, RideOffer
from brazcar.shared.application.ports import BoardRevision, BoardSignal
from brazcar.shared.domain.model import FrozenModel
from brazcar.shared.domain.phone import PhoneNumber

__all__ = [
    "BoardRevision",
    "BoardSignal",
    "ContactRequestRecord",
    "ContactRequests",
    "DriverAccount",
    "DriverCar",
    "DriverDirectory",
    "DriverKind",
    "PlaceDirectory",
    "RideRepository",
    "RideSearch",
]

type DriverKind = Literal["registered", "external"]  # the shape of `Driver.kind` (ADR-0015)


class RideRepository(Protocol):
    async def get(self, ride_id: RideId) -> RideOffer | None: ...

    async def save(self, ride: RideOffer, events: tuple[RideEvent, ...]) -> None:
        """Insert or replace the ride, append its events and bump the board revision: one transaction.

        No events means nothing changed: the ride is written as is and the revision stays.
        """
        ...

    async def delete(self, ride_id: RideId) -> None:
        """Forget the ride with its stops and history, and bump the revision (D-119).

        Its contact requests survive, `ride_id` turned null (D-140). Missing is fine: nothing
        happens, nothing is bumped.
        """
        ...

    async def upcoming(self, since: datetime) -> tuple[RideOffer, ...]:
        """Not cancelled, departing at or after `since`, earliest first. The board's raw material."""
        ...

    async def by_driver(self, driver_id: AccountId) -> tuple[RideOffer, ...]:
        """Every ride of one registered driver, latest departure first."""
        ...

    async def find_imported(
        self, driver: AccountId | PhoneNumber, departure_at: datetime
    ) -> RideOffer | None:
        """The not cancelled imported ride of this account or phone leaving exactly then (D-113)."""
        ...

    async def external_rides(
        self, *, departed_before: datetime | None = None, phone: PhoneNumber | None = None
    ) -> tuple[RideId, ...]:
        """Rides of external drivers: those that left before a moment, or those of one phone (D-119)."""
        ...

    async def history(self, ride_id: RideId) -> tuple[RideEvent, ...]:
        """What happened, in order. For charts and "edited" badges, never for a rule (ADR-0005)."""
        ...


class DriverCar(FrozenModel):
    car_id: UUID
    model: str
    color: str
    plate: str


class DriverAccount(FrozenModel):
    """What `rides` needs to know about an account, by identifier only (D-006)."""

    id: AccountId
    display_name: str
    phone: PhoneNumber
    cars: tuple[DriverCar, ...]


class DriverDirectory(Protocol):
    async def get(self, account_id: AccountId) -> DriverAccount | None: ...

    async def by_phone(self, phone: PhoneNumber) -> DriverAccount | None:
        """The account registered with the phone of a group message, if there is one (D-127)."""
        ...


class PlaceDirectory(Protocol):
    async def labels(self) -> dict[PlaceId, str]:
        """Canonical name by identifier: the whole catalog, for the read model and for validating stops."""
        ...


class RideSearch(Protocol):
    """Finding rides by the text of their stops, catalog places and "other" alike (D-101).

    Filled by the use cases after each write that changes the route; the index behind it is the
    `search` context's (D-100), reached through the adapter.
    """

    async def index(self, ride: RideOffer) -> None: ...

    async def forget(self, ride_id: RideId) -> None:
        """Drop the ride from the index. Missing is fine."""
        ...

    async def matching(self, text: str, among: Collection[RideId]) -> frozenset[RideId]:
        """The rides of `among` whose stops match `text`. A blank text matches all of them."""
        ...


class ContactRequestRecord(FrozenModel):
    """One row of the history: who saw which number, of what kind of driver, and when (D-140).

    It survives the ride: an imported ride is deleted when it departs (D-119), and the record would
    otherwise go with it and lose which account saw which number. `ride_id` is then `None`.
    """

    requester_id: AccountId
    ride_id: RideId | None
    phone_revealed: PhoneNumber
    driver_kind: DriverKind
    driver_account_id: AccountId | None  # the driver's own account, when the driver has one
    at: datetime


class ContactRequests(Protocol):
    async def record(  # noqa: PLR0913 - one row, every fact of the request at once
        self,
        *,
        requester_id: AccountId,
        ride_id: RideId,
        phone_revealed: PhoneNumber,
        driver_kind: DriverKind,
        driver_account_id: AccountId | None,
        at: datetime,
    ) -> None:
        """One row per request, in a table of its own (D-022). The limit is the `RateLimiter`'s."""
        ...

    async def by_account(
        self, requester_id: AccountId, *, since: datetime
    ) -> tuple[ContactRequestRecord, ...]:
        """What one account asked for, latest first: the base of the conversion metric (D-140)."""
        ...

    async def by_phone(self, phone: PhoneNumber, *, since: datetime) -> tuple[ContactRequestRecord, ...]:
        """Who asked to see this number, latest first: traces a number back to its requesters."""
        ...

    async def count_by_account(self, requester_id: AccountId, *, since: datetime) -> int:
        """How many times one account asked, in the window: what a scraping alert would watch."""
        ...
