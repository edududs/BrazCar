from datetime import datetime
from uuid import UUID

from asgiref.sync import sync_to_async

from brazcar.push.domain import PushSubscription

from .models import PushSubscriptionModel


class DjangoSubscriptionRepository:
    """`SubscriptionRepository` over the ORM: one row per endpoint, the endpoint being unique.

    An erased account keeps its row (D-090), so its devices are never listed for delivery.
    """

    async def get(self, endpoint: str) -> PushSubscription | None:
        row = await PushSubscriptionModel.objects.filter(endpoint=endpoint).afirst()
        return None if row is None else _to_entity(row)

    async def save(self, subscription: PushSubscription) -> None:
        """Upsert by endpoint, owner included: an endpoint that changes account passes to the new one."""
        await PushSubscriptionModel.objects.aupdate_or_create(
            endpoint=subscription.endpoint,
            defaults={
                "owner_id": subscription.owner_id,
                "p256dh": subscription.p256dh,
                "auth": subscription.auth,
                "created_at": subscription.created_at,
                "last_used_at": subscription.last_used_at,
            },
        )

    async def remove(self, endpoint: str) -> None:
        await PushSubscriptionModel.objects.filter(endpoint=endpoint).adelete()

    async def of_owner(self, owner_id: UUID) -> tuple[PushSubscription, ...]:
        return await sync_to_async(_of_owner)(owner_id)

    async def touch(self, endpoint: str, *, at: datetime) -> None:
        await PushSubscriptionModel.objects.filter(endpoint=endpoint).aupdate(last_used_at=at)

    async def forget_owner(self, owner_id: UUID) -> None:
        await PushSubscriptionModel.objects.filter(owner_id=owner_id).adelete()


def _of_owner(owner_id: UUID) -> tuple[PushSubscription, ...]:
    rows = PushSubscriptionModel.objects.filter(owner_id=owner_id, owner__erased_at=None)
    return tuple(_to_entity(row) for row in rows.order_by("-last_used_at"))


def _to_entity(row: PushSubscriptionModel) -> PushSubscription:
    return PushSubscription(
        endpoint=row.endpoint,
        p256dh=row.p256dh,
        auth=row.auth,
        owner_id=UUID(str(row.owner_id)),
        created_at=row.created_at,
        last_used_at=row.last_used_at,
    )
