"""A message of a watched group, as the extractor handed it over (D-111). Text only, never media."""

from datetime import datetime
from typing import Annotated, Self

from pydantic import Field, StringConstraints, model_validator

from brazcar.shared.domain.model import FrozenModel

type Phone = Annotated[str, StringConstraints(pattern=r"^[0-9]{8,15}$")]
"""Digits as WhatsApp addresses them, country code first and no `+`: `5561999999999`."""
type GroupJid = Annotated[str, StringConstraints(pattern=r"^[0-9-]+@g\.us$")]
type Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
type Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class Sender(FrozenModel):
    """Who posted. The phone is the identity of the external driver; the name is only shown."""

    phone: Phone
    display_name: str = ""


class WatchedGroup(FrozenModel):
    """A group the worker reads, by JID, with the label the interface shows instead (D-109)."""

    jid: GroupJid
    label: Label


class SourceMessage(FrozenModel):
    """Unique per (paired account, message id): two accounts in one group receive the same id."""

    account: Phone
    message_id: Annotated[str, Field(min_length=1, max_length=120)]
    chat_jid: GroupJid
    sender: Sender
    sent_at: datetime
    text: Text
    received_at: datetime

    @model_validator(mode="after")
    def _aware(self) -> Self:
        for name in ("sent_at", "received_at"):
            if getattr(self, name).tzinfo is None:
                message = f"{name} must be timezone-aware"
                raise ValueError(message)
        return self

    @property
    def key(self) -> tuple[str, str]:
        return (self.account, self.message_id)
