"""One opinion about the app, as sent from the account screen (D-155).

The subject is the app, not a ride. A complaint may name the person it is about by phone, never
by name: the name on an account can change, the number is what identifies it.
"""

from datetime import datetime
from enum import StrEnum
from typing import Annotated, Self
from uuid import UUID, uuid4

from pydantic import StringConstraints, model_validator

from brazcar.shared.domain.model import FrozenModel
from brazcar.shared.domain.phone import PhoneNumber

from .errors import AboutSomeoneOutsideComplaintError

MESSAGE_LIMIT = 1000  # characters of plain text, the counter the form shows
VERSION_LIMIT = 32  # "0.20.1", with room for a pre-release suffix

type FeedbackId = UUID
type AccountId = UUID
type Message = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MESSAGE_LIMIT)
]
type WebVersion = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=VERSION_LIMIT)
]


class FeedbackKind(StrEnum):
    SUGGESTION = "suggestion"
    COMPLAINT = "complaint"
    PRAISE = "praise"


class Feedback(FrozenModel):
    id: FeedbackId
    author_id: AccountId  # only a signed-in person sends one; the account row outlives its erasure (D-090)
    kind: FeedbackKind
    message: Message
    # The number typed, as typed: never resolved to an account, so no link to anyone is kept.
    about_phone: PhoneNumber | None = None
    web_version: WebVersion  # which build the person was using, for telling a bug from an old front
    at: datetime

    @model_validator(mode="after")
    def _only_a_complaint_names_someone(self) -> Self:
        if self.about_phone is not None and self.kind is not FeedbackKind.COMPLAINT:
            raise AboutSomeoneOutsideComplaintError(self.kind)
        return self

    @classmethod
    def send(  # noqa: PLR0913 - every fact of the opinion at once, by name
        cls,
        *,
        author_id: AccountId,
        kind: FeedbackKind,
        message: str,
        about_phone: PhoneNumber | None,
        web_version: str,
        at: datetime,
    ) -> Self:
        """Raises `AboutSomeoneOutsideComplaintError` by name, not wrapped in a validation error."""
        if about_phone is not None and kind is not FeedbackKind.COMPLAINT:
            raise AboutSomeoneOutsideComplaintError(kind)
        return cls(
            id=uuid4(),
            author_id=author_id,
            kind=kind,
            message=message,
            about_phone=about_phone,
            web_version=web_version,
            at=at,
        )
