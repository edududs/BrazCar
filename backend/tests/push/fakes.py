"""In-memory adapters of the push ports, for use-case tests."""

import base64
import os
from datetime import UTC, datetime
from uuid import UUID

from brazcar.push.application import Delivery
from brazcar.push.domain import PushMessage, PushSubscription

NOW = datetime(2026, 10, 21, 15, 0, tzinfo=UTC)
FCM = "https://fcm.googleapis.com/fcm/send/"


def b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def new_auth() -> str:
    return b64url(os.urandom(16))


def new_p256dh() -> str:
    return b64url(b"\x04" + os.urandom(64))


def make_subscription(
    endpoint: str,
    owner_id: UUID,
    *,
    created_at: datetime = NOW,
    last_used_at: datetime = NOW,
) -> PushSubscription:
    return PushSubscription(
        endpoint=endpoint,
        p256dh=new_p256dh(),
        auth=new_auth(),
        owner_id=owner_id,
        created_at=created_at,
        last_used_at=last_used_at,
    )


class FixedClock:
    def __init__(self, at: datetime = NOW) -> None:
        self.at = at

    def now(self) -> datetime:
        return self.at


class InMemorySubscriptionRepository:
    def __init__(self) -> None:
        self.rows: dict[str, PushSubscription] = {}

    async def get(self, endpoint: str) -> PushSubscription | None:
        return self.rows.get(endpoint)

    async def save(self, subscription: PushSubscription) -> None:
        self.rows[subscription.endpoint] = subscription

    async def remove(self, endpoint: str) -> None:
        self.rows.pop(endpoint, None)

    async def of_owner(self, owner_id: UUID) -> tuple[PushSubscription, ...]:
        mine = (s for s in self.rows.values() if s.owner_id == owner_id)
        return tuple(sorted(mine, key=lambda s: s.last_used_at, reverse=True))

    async def touch(self, endpoint: str, *, at: datetime) -> None:
        if endpoint in self.rows:
            self.rows[endpoint] = self.rows[endpoint].model_copy(update={"last_used_at": at})

    async def forget_owner(self, owner_id: UUID) -> None:
        self.rows = {e: s for e, s in self.rows.items() if s.owner_id != owner_id}


class ScriptedTransport:
    """Answers per endpoint: a `Delivery`, or an exception to raise. Unlisted endpoints are `SENT`."""

    def __init__(self, script: dict[str, Delivery | Exception] | None = None) -> None:
        self.script = script or {}
        self.delivered: list[tuple[str, PushMessage]] = []

    async def deliver(self, subscription: PushSubscription, message: PushMessage) -> Delivery:
        self.delivered.append((subscription.endpoint, message))
        outcome = self.script.get(subscription.endpoint, Delivery.SENT)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome
