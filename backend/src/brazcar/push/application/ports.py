from datetime import datetime
from enum import StrEnum
from typing import Protocol
from uuid import UUID

from brazcar.push.domain import PushMessage, PushSubscription


class Clock(Protocol):
    def now(self) -> datetime: ...


class Delivery(StrEnum):
    SENT = "sent"
    GONE = "gone"


class SubscriptionRepository(Protocol):
    async def get(self, endpoint: str) -> PushSubscription | None: ...

    async def save(self, subscription: PushSubscription) -> None:
        """Upsert by endpoint: the row passes to the new owner."""
        ...

    async def remove(self, endpoint: str) -> None:
        """Unknown endpoints are ignored."""
        ...

    async def of_owner(self, owner_id: UUID) -> tuple[PushSubscription, ...]:
        """From the most recently used to the oldest (`last_used_at` descending)."""
        ...

    async def touch(self, endpoint: str, *, at: datetime) -> None: ...

    async def forget_owner(self, owner_id: UUID) -> None: ...


class PushTransport(Protocol):
    async def deliver(self, subscription: PushSubscription, message: PushMessage) -> Delivery:
        """`SENT` when the service accepted; `GONE` when it says the subscription no longer exists
        (404/410). Any other failure raises."""
        ...
