from collections.abc import AsyncIterator
from datetime import datetime, timedelta
from typing import Protocol


class Clock(Protocol):
    def now(self) -> datetime:
        """Timezone-aware current time. Injected so rules about time are testable."""
        ...


class Mailer(Protocol):
    async def send(self, *, to: str, subject: str, body: str) -> None:
        """Deliver one plain-text message. The provider is an adapter and an environment variable (D-032)."""
        ...


class RateLimiter(Protocol):
    """Request limits live in the application, behind this port (D-064).

    A key names what is being limited ("contact:<account>", "login:<phone>"); the use case
    decides the key, the limit and the window. Where the hits are counted is the adapter's business.
    """

    async def acquire(self, key: str, *, limit: int, window: timedelta) -> bool:
        """Count one hit for `key` now. False, and nothing counted, once the window holds `limit` hits."""
        ...


class BoardRevision(Protocol):
    """The one number that says "the board changed" (ADR-0010): `rides` bumps it, the signal reads it."""

    async def current(self) -> int:
        """Bumped by every write that changes the board; the signal reads it once a second."""
        ...


class BoardSignal(Protocol):
    """ "The board changed, revision N": the outgoing port of ADR-0010, one adapter per transport."""

    async def publish(self, revision: int) -> None:
        """Announce a new revision. The polling adapter needs nothing here: the row is the channel."""
        ...

    def subscribe(self) -> AsyncIterator[int]:
        """Every revision from now on, in order, each once. Never the payload: the client fetches."""
        ...
