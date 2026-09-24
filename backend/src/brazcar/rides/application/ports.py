from collections.abc import Collection
from datetime import datetime
from typing import Protocol
from uuid import UUID

from brazcar.rides.domain import AccountId, Phone, PlaceId, RideEvent, RideId, RideOffer
from brazcar.shared.application.ports import BoardRevision, BoardSignal
from brazcar.shared.domain.model import FrozenModel

__all__ = [
    "BoardRevision",
    "BoardSignal",
    "ContactRequests",
    "DriverAccount",
    "DriverCar",
    "DriverDirectory",
    "PlaceDirectory",
    "RideRepository",
    "RideSearch",
]


class RideRepository(Protocol):
    async def get(self, ride_id: RideId) -> RideOffer | None: ...

    async def save(self, ride: RideOffer, events: tuple[RideEvent, ...]) -> None:
        """Insert or replace the ride, append its events and bump the board revision: one transaction.

        No events means nothing changed: the ride is written as is and the revision stays.
        """
        ...

    async def delete(self, ride_id: RideId) -> None:
        """Forget the ride with its stops, history and contact requests, and bump the revision (D-119).

        Missing is fine: nothing happens, nothing is bumped.
        """
        ...

    async def upcoming(self, since: datetime) -> tuple[RideOffer, ...]:
        """Not cancelled, departing at or after `since`, earliest first. The board's raw material."""
        ...

    async def by_driver(self, driver_id: AccountId) -> tuple[RideOffer, ...]:
        """Every ride of one registered driver, latest departure first."""
        ...

    async def find_imported(self, driver: AccountId | Phone, departure_at: datetime) -> RideOffer | None:
        """The not cancelled imported ride of this account or phone leaving exactly then (D-113)."""
        ...

    async def external_rides(
        self, *, departed_before: datetime | None = None, phone: Phone | None = None
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
    phone: str
    cars: tuple[DriverCar, ...]


class DriverDirectory(Protocol):
    async def get(self, account_id: AccountId) -> DriverAccount | None: ...

    async def by_phone(self, phone: Phone) -> DriverAccount | None:
        """The account with this WhatsApp phone (digits, no `+`), if someone registered it (D-127)."""
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


class ContactRequests(Protocol):
    async def record(self, *, requester_id: AccountId, ride_id: RideId, at: datetime) -> None:
        """One row per request, in a table of its own (D-022). The limit is the `RateLimiter`'s."""
        ...
