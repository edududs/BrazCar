"""`RateLimiter` over a table of hits (D-064): exact, durable, and the same on every process and database."""

from datetime import timedelta

from asgiref.sync import sync_to_async
from django.db import transaction
from django.utils import timezone

from .models import RateLimitHitModel


class DjangoRateLimiter:
    async def acquire(self, key: str, *, limit: int, window: timedelta) -> bool:
        return await sync_to_async(_acquire)(key, limit, window)


@transaction.atomic
def _acquire(key: str, limit: int, window: timedelta) -> bool:
    now = timezone.now()
    hits = RateLimitHitModel.objects.filter(key=key)
    hits.filter(at__lte=now - window).delete()  # a key's history never outlives its window
    # Locking the key's rows makes two concurrent hits count each other on Postgres (`FOR UPDATE`
    # refuses aggregates, hence the list); SQLite serializes writers on its own.
    if len(hits.select_for_update().values_list("id", flat=True)) >= limit:
        return False
    RateLimitHitModel.objects.create(key=key, at=now)
    return True
