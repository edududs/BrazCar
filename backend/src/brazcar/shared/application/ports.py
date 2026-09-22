from datetime import datetime
from typing import Protocol


class Clock(Protocol):
    def now(self) -> datetime:
        """Timezone-aware current time. Injected so rules about time are testable."""
        ...


class Mailer(Protocol):
    async def send(self, *, to: str, subject: str, body: str) -> None:
        """Deliver one plain-text message. The provider is an adapter and an environment variable (D-032)."""
        ...
