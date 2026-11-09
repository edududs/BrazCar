"""Is the importing working? Reads two ports and applies the pure rule (D-193)."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import timedelta

from brazcar.importing.domain import DEFAULT_STALE_AFTER, ImportingHealth, assess_importing

from .ports import Candidates, Clock, SourceMessages


@dataclass(frozen=True, slots=True)
class CheckImportingHealth:
    candidates: Candidates
    messages: SourceMessages
    clock: Clock
    configured: Callable[[], bool]
    """Asked per request: whether this process has watched groups; without them the answer is `off`."""
    stale_after: timedelta = DEFAULT_STALE_AFTER

    async def __call__(self) -> ImportingHealth:
        if not self.configured():
            return assess_importing(
                configured=False, last_verdict=None, last_received_at=None, now=self.clock.now()
            )
        return assess_importing(
            configured=True,
            last_verdict=await self.candidates.last_judged_verdict(),
            last_received_at=await self.messages.last_received_at(),
            now=self.clock.now(),
            stale_after=self.stale_after,
        )
