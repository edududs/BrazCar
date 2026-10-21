"""Storage shape of a device subscription. No rule lives here: the domain validates, rows only hold."""

from django.conf import settings
from django.db import models

from brazcar.push.domain import ENDPOINT_LIMIT


class PushSubscriptionModel(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_subscriptions"
    )
    endpoint = models.CharField(max_length=ENDPOINT_LIMIT, unique=True)
    p256dh = models.CharField(max_length=128)
    auth = models.CharField(max_length=64)
    created_at = models.DateTimeField()
    last_used_at = models.DateTimeField()

    # What Django adds at runtime, declared for the type checker.
    owner_id: object

    class Meta:
        db_table = "push_subscription"

    def __str__(self) -> str:
        return f"{self.owner_id} {self.last_used_at:%Y-%m-%d %H:%M}"
