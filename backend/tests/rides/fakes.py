"""In-memory adapters for the use-case tests. The repository is held to the port contract."""

from datetime import datetime

from brazcar.rides.application import Driver
from brazcar.rides.domain import AccountId, RideEvent, RideId, RideOffer
from tests.shared.fakes import InMemoryRateLimiter

from .strategies import EPOCH

__all__ = [
    "FixedClock",
    "InMemoryDrivers",
    "InMemoryPlaces",
    "InMemoryRateLimiter",
    "InMemoryRideRepository",
    "RecordingContacts",
]


class InMemoryRideRepository:
    def __init__(self) -> None:
        self.rides: dict[RideId, RideOffer] = {}
        self.events: dict[RideId, list[RideEvent]] = {}
        self.revision = 0

    async def get(self, ride_id: RideId) -> RideOffer | None:
        return self.rides.get(ride_id)

    async def save(self, ride: RideOffer, events: tuple[RideEvent, ...]) -> None:
        self.rides[ride.id] = ride
        self.events.setdefault(ride.id, []).extend(events)
        if events:
            self.revision += 1

    async def upcoming(self, since: datetime) -> tuple[RideOffer, ...]:
        rides = [r for r in self.rides.values() if r.cancelled_at is None and r.departure_at >= since]
        return tuple(sorted(rides, key=lambda r: (r.departure_at, r.published_at)))

    async def by_driver(self, driver_id: AccountId) -> tuple[RideOffer, ...]:
        mine = [r for r in self.rides.values() if r.driver_id == driver_id]
        return tuple(sorted(mine, key=lambda r: r.departure_at, reverse=True))

    async def history(self, ride_id: RideId) -> tuple[RideEvent, ...]:
        return tuple(self.events.get(ride_id, []))

    async def current(self) -> int:
        """The fake is its own `BoardRevision`."""
        return self.revision


class InMemoryDrivers:
    def __init__(self, *drivers: Driver) -> None:
        self.by_id = {d.id: d for d in drivers}

    async def get(self, account_id: AccountId) -> Driver | None:
        return self.by_id.get(account_id)


class InMemoryPlaces:
    """A three-place catalog: Plano Piloto above Esplanada, and Brazlândia on its own."""

    async def with_descendants(self, place_id: str) -> frozenset[str]:
        if place_id == "plano-piloto":
            return frozenset({"plano-piloto", "esplanada"})
        return frozenset({place_id}) if place_id in await self.labels() else frozenset()

    async def labels(self) -> dict[str, str]:
        return {"plano-piloto": "Plano Piloto", "esplanada": "Esplanada", "brazlandia": "Brazlândia"}


class RecordingContacts:
    def __init__(self) -> None:
        self.recorded: list[tuple[AccountId, RideId, datetime]] = []

    async def record(self, *, requester_id: AccountId, ride_id: RideId, at: datetime) -> None:
        self.recorded.append((requester_id, ride_id, at))


class FixedClock:
    def __init__(self, at: datetime = EPOCH) -> None:
        self.at = at

    def now(self) -> datetime:
        return self.at
