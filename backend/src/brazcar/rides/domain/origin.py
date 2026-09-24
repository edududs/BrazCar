"""Where a ride came from: published here, or read from a WhatsApp group (ADR-0015, D-117).

The WhatsApp form keeps what the detail page shows so the passenger can judge the record by the
original words: the text (with personal data redacted by `importing` before it gets here), the
label of the group and when it was sent. It is deleted with the ride (D-119).
"""

from datetime import datetime
from typing import Annotated, Literal, Self

from pydantic import Field, StringConstraints, model_validator

from brazcar.shared.domain.model import FrozenModel

type Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
type MessageText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]


class PublishedOrigin(FrozenModel):
    kind: Literal["published"] = "published"


class WhatsAppOrigin(FrozenModel):
    kind: Literal["whatsapp"] = "whatsapp"
    message_text: MessageText
    group_label: Label
    sent_at: datetime

    @model_validator(mode="after")
    def _aware(self) -> Self:
        if self.sent_at.tzinfo is None:
            message = "sent_at must be timezone-aware"
            raise ValueError(message)
        return self


type RideOrigin = Annotated[PublishedOrigin | WhatsAppOrigin, Field(discriminator="kind")]
