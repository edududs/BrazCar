"""In-memory adapters of the shared ports, for use-case tests of any context."""

from collections import defaultdict, deque
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta
from uuid import UUID

from brazcar.shared.application.ports import Clock


class InMemoryRateLimiter:
    """Sliding window over a clock the test controls."""

    def __init__(self, clock: Clock) -> None:
        self.clock = clock
        self.hits: dict[str, deque[datetime]] = defaultdict(deque)

    async def acquire(self, key: str, *, limit: int, window: timedelta) -> bool:
        now = self.clock.now()
        hits = self.hits[key]
        while hits and hits[0] <= now - window:
            hits.popleft()
        if len(hits) >= limit:
            return False
        hits.append(now)
        return True


class RecordingRideChanged:
    """Keeps the ids it was told about; `during` runs at the moment of each call, to check the state then."""

    def __init__(self, during: Callable[[UUID], Awaitable[None]] | None = None) -> None:
        self.calls: list[UUID] = []
        self.during = during

    async def __call__(self, ride_id: UUID) -> None:
        self.calls.append(ride_id)
        if self.during is not None:
            await self.during(ride_id)


class FailingRideChanged:
    async def __call__(self, ride_id: UUID) -> None:
        message = f"listener down for {ride_id}"
        raise RuntimeError(message)
