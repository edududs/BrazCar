from datetime import datetime
from typing import Protocol
from uuid import UUID

from brazcar.rides.domain import AccountId, PlaceId, RideEvent, RideId, RideOffer
from brazcar.shared.domain.model import FrozenModel


class RideRepository(Protocol):
    async def get(self, ride_id: RideId) -> RideOffer | None: ...

    async def save(self, ride: RideOffer, events: tuple[RideEvent, ...]) -> None:
        """Insert or replace the ride, append its events and bump the board revision: one transaction."""
        ...

    async def upcoming(self, since: datetime) -> tuple[RideOffer, ...]:
        """Not cancelled, departing at or after `since`, earliest first. The board's raw material."""
        ...

    async def by_driver(self, driver_id: AccountId) -> tuple[RideOffer, ...]:
        """Every ride of one driver, latest departure first."""
        ...

    async def history(self, ride_id: RideId) -> tuple[RideEvent, ...]:
        """What happened, in order. For charts and "edited" badges, never for a rule (ADR-0005)."""
        ...


class BoardRevision(Protocol):
    async def current(self) -> int:
        """Bumped by every `RideRepository.save`; the SSE signal reads it (ADR-0010)."""
        ...


class DriverCar(FrozenModel):
    car_id: UUID
    model: str
    color: str
    plate: str


class Driver(FrozenModel):
    """What `rides` needs to know about an account, by identifier only (D-006)."""

    id: AccountId
    display_name: str
    phone: str
    cars: tuple[DriverCar, ...]


class DriverDirectory(Protocol):
    async def get(self, account_id: AccountId) -> Driver | None: ...


class PlaceDirectory(Protocol):
    async def with_descendants(self, place_id: PlaceId) -> frozenset[PlaceId]:
        """The place and everything beneath it; empty when unknown. "Plano Piloto" finds "Esplanada"."""
        ...

    async def labels(self) -> dict[PlaceId, str]:
        """Canonical name by identifier, for the read model."""
        ...


class ContactRequests(Protocol):
    async def count_since(self, requester_id: AccountId, since: datetime) -> int: ...

    async def record(self, *, requester_id: AccountId, ride_id: RideId, at: datetime) -> None: ...
