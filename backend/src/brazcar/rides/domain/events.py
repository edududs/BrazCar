"""What happened to a ride. Stored append-only by the repository; never read by a rule (ADR-0005)."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field

from brazcar.shared.domain.model import FrozenModel


class RidePublished(FrozenModel):
    kind: Literal["published"] = "published"
    ride_id: UUID
    at: datetime


class SeatsChanged(FrozenModel):
    kind: Literal["seats_changed"] = "seats_changed"
    ride_id: UUID
    at: datetime
    seats_before: int
    seats_after: int


class RideEdited(FrozenModel):
    kind: Literal["edited"] = "edited"
    ride_id: UUID
    at: datetime
    departure_before: datetime
    departure_after: datetime


class RideReopened(FrozenModel):
    kind: Literal["reopened"] = "reopened"
    ride_id: UUID
    at: datetime


class RideCancelled(FrozenModel):
    kind: Literal["cancelled"] = "cancelled"
    ride_id: UUID
    at: datetime


# Discriminated by `kind`, so a stored event validates back into the right class.
type RideEvent = Annotated[
    RidePublished | SeatsChanged | RideEdited | RideReopened | RideCancelled, Field(discriminator="kind")
]
