"""Who offers the ride: an account with a car, or someone the platform only knows by phone (ADR-0015).

A sum type, so a ride is never half of each: the registered form carries the account and the car
snapshot (D-023); the external form carries the WhatsApp phone and name and nothing else.
"""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, StringConstraints

from brazcar.shared.domain.model import FrozenModel

type AccountId = UUID
type ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
type Phone = Annotated[str, StringConstraints(pattern=r"^[0-9]{8,15}$")]
"""Digits as WhatsApp addresses them, country code first and no `+`: what `wa.me` takes."""


class CarSnapshot(FrozenModel):
    """The car as it was when the ride was published (D-023). The plate never leaves by a list."""

    car_id: UUID
    model: ShortText
    color: ShortText
    plate: ShortText


class RegisteredDriver(FrozenModel):
    """An account of the platform. Publishing needs the car (D-029); a ride read from a group and
    linked to the account by phone comes without one, because nobody knows which car it was (D-127)."""

    kind: Literal["registered"] = "registered"
    account_id: AccountId
    car: CarSnapshot | None


class ExternalDriver(FrozenModel):
    """A driver who posted in a group and has no account here. The phone is the identity (D-114)."""

    kind: Literal["external"] = "external"
    phone: Phone
    display_name: ShortText


type Driver = Annotated[RegisteredDriver | ExternalDriver, Field(discriminator="kind")]
