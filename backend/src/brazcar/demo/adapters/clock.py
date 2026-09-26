"""A clock that never moves (D-133, D-134): the screens catalogue's `expired` invite is born
already past its deadline, whatever time the seed happens to run. Nothing outside the demo
seed ever sees this clock; the API is served by `shared.adapters.clock.SystemClock`.
"""

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True, slots=True)
class FixedClock:
    at: datetime

    def now(self) -> datetime:
        return self.at
