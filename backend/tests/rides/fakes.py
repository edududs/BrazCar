"""In-memory adapters for the use-case tests. The repository is held to the port contract."""

from datetime import datetime

from brazcar.places.domain import Catalog, Place
from brazcar.rides.adapters.directories import CatalogPlaceDirectory
from brazcar.rides.adapters.search import IndexedRideSearch
from brazcar.rides.application import Driver
from brazcar.rides.domain import AccountId, RideEvent, RideId, RideOffer
from tests.places.fakes import InMemoryCatalogRepository
from tests.search.fakes import InMemorySearchIndex
from tests.shared.fakes import InMemoryRateLimiter

from .strategies import EPOCH

__all__ = [
    "CATALOG",
    "FixedClock",
    "InMemoryDrivers",
    "InMemoryRateLimiter",
    "InMemoryRideRepository",
    "RecordingContacts",
    "catalog_places",
    "indexed_search",
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


CATALOG = Catalog(
    places=(
        Place(id="plano-piloto", name="Plano Piloto"),
        Place(id="esplanada", name="Esplanada", parent_id="plano-piloto"),
        Place(id="brazlandia", name="Brazlândia", aliases=("Braz",)),
    )
)


def catalog_places() -> CatalogPlaceDirectory:
    return CatalogPlaceDirectory(InMemoryCatalogRepository(CATALOG))


def indexed_search() -> IndexedRideSearch:
    return IndexedRideSearch(InMemorySearchIndex(), InMemoryCatalogRepository(CATALOG))


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
