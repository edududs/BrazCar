import asyncio
import logging
from dataclasses import dataclass
from uuid import UUID

from brazcar.push.domain import DEVICE_LIMIT, PushMessage, PushSubscription, service_host

from .ports import Clock, Delivery, PushTransport, SubscriptionRepository

log = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class SubscribeDevice:
    subscriptions: SubscriptionRepository
    clock: Clock

    async def __call__(self, owner_id: UUID, *, endpoint: str, p256dh: str, auth: str) -> PushSubscription:
        now = self.clock.now()
        existing = await self.subscriptions.get(endpoint)
        created_at = existing.created_at if existing is not None and existing.owner_id == owner_id else now
        subscription = PushSubscription(
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
            owner_id=owner_id,
            created_at=created_at,
            last_used_at=now,
        )
        await self.subscriptions.save(subscription)
        kept = {endpoint}
        for device in await self.subscriptions.of_owner(owner_id):
            if device.endpoint in kept:
                continue
            if len(kept) < DEVICE_LIMIT:
                kept.add(device.endpoint)
            else:
                await self.subscriptions.remove(device.endpoint)
        return subscription


@dataclass(frozen=True, slots=True)
class UnsubscribeDevice:
    subscriptions: SubscriptionRepository

    async def __call__(self, owner_id: UUID, endpoint: str) -> None:
        existing = await self.subscriptions.get(endpoint)
        if existing is not None and existing.owner_id == owner_id:
            await self.subscriptions.remove(endpoint)


@dataclass(frozen=True, slots=True)
class PushToAccount:
    subscriptions: SubscriptionRepository
    transport: PushTransport
    clock: Clock

    async def __call__(self, owner_id: UUID, message: PushMessage) -> None:
        devices = await self.subscriptions.of_owner(owner_id)
        await asyncio.gather(*(self._deliver(owner_id, device, message) for device in devices))

    async def _deliver(self, owner_id: UUID, device: PushSubscription, message: PushMessage) -> None:
        try:
            result = await self.transport.deliver(device, message)
            if result is Delivery.GONE:
                await self.subscriptions.remove(device.endpoint)
            else:
                await self.subscriptions.touch(device.endpoint, at=self.clock.now())
        except Exception:  # one device failing must not stop the others
            log.exception("push failed: account=%s service=%s", owner_id, service_host(device.endpoint))


@dataclass(frozen=True, slots=True)
class ForgetDevices:
    subscriptions: SubscriptionRepository

    async def __call__(self, owner_id: UUID) -> None:
        await self.subscriptions.forget_owner(owner_id)
