"""Storage shape of rides. No rule lives here: the domain validates, these rows only hold."""

from django.conf import settings
from django.db import models


class RideModel(models.Model):
    id = models.UUIDField(primary_key=True, editable=False)
    # The driver is one of two shapes (ADR-0015): an account, erased in place and never deleted
    # (D-090), with the car as it was when published (D-023); or a WhatsApp phone and name.
    driver = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="rides", null=True, blank=True
    )
    driver_phone = models.CharField(max_length=15, blank=True)  # never in a list payload (D-031)
    driver_name = models.CharField(max_length=60, blank=True)
    car_id = models.UUIDField(null=True, blank=True)
    car_model = models.CharField(max_length=60, blank=True)
    car_color = models.CharField(max_length=60, blank=True)
    car_plate = models.CharField(max_length=7, blank=True)  # never in a list payload (D-031)
    # Where the ride came from (D-117): the original words stay with it and go with it (D-119).
    origin_kind = models.CharField(max_length=12, default="published")
    origin_text = models.TextField(blank=True)
    origin_group_label = models.CharField(max_length=60, blank=True)
    origin_sent_at = models.DateTimeField(null=True, blank=True)
    departure_at = models.DateTimeField()
    original_departure_at = models.DateTimeField()
    seats_available = models.PositiveSmallIntegerField()
    price = models.DecimalField(max_digits=6, decimal_places=2)
    payment_methods: models.JSONField[list[str]] = models.JSONField()  # the `PaymentMethod` values
    # Plain words of the driver, never written by an import; blank is none, as everywhere here (D-129).
    notes = models.TextField(blank=True)
    published_at = models.DateTimeField()
    reopened_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    # What Django adds at runtime, declared for the type checker.
    driver_id: object
    stops: models.Manager[StopModel]

    class Meta:
        db_table = "rides_ride"
        indexes = (
            models.Index(fields=("cancelled_at", "departure_at"), name="rides_board"),
            models.Index(fields=("driver_phone", "departure_at"), name="rides_external_departure"),
        )

    def __str__(self) -> str:
        return f"{self.id} @ {self.departure_at.isoformat()}"


class StopModel(models.Model):
    """One stop of a ride's route, in order. A catalog stop keeps the place identifier only (D-024)."""

    ride = models.ForeignKey(RideModel, on_delete=models.CASCADE, related_name="stops")
    position = models.PositiveSmallIntegerField()
    kind = models.CharField(max_length=8)
    place_id = models.CharField(max_length=64, blank=True)
    text = models.CharField(max_length=60, blank=True)
    # What it costs to come this far from the origin; null when the driver named one price (D-131).
    fare = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = "rides_stop"
        ordering = ("ride_id", "position")
        constraints = (models.UniqueConstraint(fields=("ride", "position"), name="one_stop_per_position"),)

    def __str__(self) -> str:
        return self.place_id or self.text


class RideEventModel(models.Model):
    """Append-only (ADR-0005). `payload` is the event as the domain serializes it."""

    ride = models.ForeignKey(RideModel, on_delete=models.CASCADE, related_name="events")
    position = models.PositiveIntegerField()
    kind = models.CharField(max_length=16)
    at = models.DateTimeField()
    payload: models.JSONField[dict[str, object]] = models.JSONField()

    class Meta:
        db_table = "rides_event"
        ordering = ("ride_id", "position")
        constraints = (models.UniqueConstraint(fields=("ride", "position"), name="one_event_per_position"),)

    def __str__(self) -> str:
        return f"{self.kind} @ {self.at.isoformat()}"


class ContactRequestModel(models.Model):
    """Who asked for whose contact, when (D-022). The only metric of conversion there is (ADR-0006).

    Survives the ride (D-140): an imported ride is deleted once it departs (D-119), and the record
    of who saw its number would otherwise go with it. `ride` is nullable and `SET_NULL` on purpose.
    """

    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="contact_requests"
    )
    ride = models.ForeignKey(
        RideModel, on_delete=models.SET_NULL, null=True, blank=True, related_name="contact_requests"
    )
    phone_revealed = models.CharField(max_length=20, blank=True)  # E.164, as `accounts` stores it (D-089)
    driver_kind = models.CharField(max_length=12, blank=True)  # "registered" or "external" (ADR-0015)
    driver_account_id = models.UUIDField(null=True, blank=True)  # the driver's own account, when it has one
    at = models.DateTimeField()

    # What Django adds at runtime, declared for the type checker.
    requester_id: object
    ride_id: object

    class Meta:
        db_table = "rides_contact_request"

    def __str__(self) -> str:
        return f"contact @ {self.at.isoformat()}"
