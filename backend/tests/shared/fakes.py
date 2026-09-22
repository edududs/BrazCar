"""In-memory adapters of the shared ports, for use-case tests of any context."""

from collections import defaultdict, deque
from datetime import datetime, timedelta

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
