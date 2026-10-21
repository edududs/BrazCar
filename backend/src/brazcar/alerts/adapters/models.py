"""Storage shape of an alert and its notices. No rule lives here: the domain validates, rows only hold."""

from django.conf import settings
from django.db import models


class RideAlertModel(models.Model):
    id = models.UUIDField(primary_key=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ride_alerts")
    text = models.CharField(max_length=80, blank=True)  # "" stands for no text
    day = models.DateField(db_index=True)
    from_time = models.TimeField(null=True)
    until_time = models.TimeField(null=True)
    created_at = models.DateTimeField()

    # What Django adds at runtime, declared for the type checker.
    owner_id: object

    class Meta:
        db_table = "alerts_ride_alert"

    def __str__(self) -> str:
        return f"{self.day:%Y-%m-%d} {self.text}"


class NoticeModel(models.Model):
    alert = models.ForeignKey(RideAlertModel, on_delete=models.CASCADE, related_name="notices")
    # By identifier, no foreign key: an imported ride is deleted when it departs (D-119).
    ride_id = models.UUIDField()
    at = models.DateTimeField()

    # What Django adds at runtime, declared for the type checker.
    alert_id: object

    class Meta:
        db_table = "alerts_notice"
        constraints = (
            models.UniqueConstraint(fields=("alert", "ride_id"), name="one_notice_per_alert_and_ride"),
        )

    def __str__(self) -> str:
        return f"{self.alert_id} {self.ride_id}"
