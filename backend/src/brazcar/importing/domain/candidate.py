"""One posting, gathered from every group it was sent to, and what became of it (D-113)."""

from datetime import datetime, timedelta
from enum import StrEnum
from typing import Annotated, Literal, Self
from uuid import UUID, uuid4

from pydantic import Field, model_validator

from brazcar.shared.domain.model import FrozenModel

from .source_message import Label, Sender, SourceMessage
from .text_key import text_key

DEDUP_WINDOW = timedelta(hours=6)
"""The same sender, the same words, within this: one posting. Beyond it, another ride (D-113)."""

type CandidateId = UUID


class RejectReason(StrEnum):
    NOT_AN_OFFER = "not_an_offer"  # a request, an update or noise
    NO_TIME = "no_time"  # an offer nobody can place on the board (D-116)
    NO_SEATS = "no_seats"  # "0 vagas" is an update, not an offer
    FEW_STOPS = "few_stops"  # a route needs where it leaves from and where it goes (D-013)
    LOW_CONFIDENCE = "low_confidence"  # the words do not back what was extracted (D-115)
    UNKNOWN_PLACE = "unknown_place"  # a resolved stop the catalog no longer knows


class Pending(FrozenModel):
    kind: Literal["pending"] = "pending"


class Accepted(FrozenModel):
    kind: Literal["accepted"] = "accepted"
    ride_id: UUID
    joined: bool = False  # true when an earlier candidate had already made this ride


class Rejected(FrozenModel):
    kind: Literal["rejected"] = "rejected"
    reason: RejectReason
    confidence: float | None = None


class Failed(FrozenModel):
    """The interpreter could not answer. The sweep tries again, up to a ceiling (D-112)."""

    kind: Literal["failed"] = "failed"
    error: Annotated[str, Field(max_length=200)]
    attempts: Annotated[int, Field(ge=1)]


type Verdict = Annotated[Pending | Accepted | Rejected | Failed, Field(discriminator="kind")]


class Candidate(FrozenModel):
    id: CandidateId
    sender: Sender
    text_key: str
    text: str  # the first message's words, as sent; redacted only when they reach a ride (D-128)
    group_label: Label  # of the first group it was seen in
    first_seen_at: datetime
    last_seen_at: datetime
    sources: Annotated[int, Field(ge=1)] = 1
    verdict: Verdict = Pending()
    judged_at: datetime | None = None

    @model_validator(mode="after")
    def _consistent(self) -> Self:
        if self.last_seen_at < self.first_seen_at:
            message = "last_seen_at precedes first_seen_at"
            raise ValueError(message)
        if (self.judged_at is None) != isinstance(self.verdict, Pending):
            message = "a judged candidate has a verdict and a time; a pending one has neither"
            raise ValueError(message)
        return self

    @classmethod
    def open(cls, message: SourceMessage, *, group_label: str) -> Self:
        return cls(
            id=uuid4(),
            sender=message.sender,
            text_key=text_key(message.text),
            text=message.text,
            group_label=group_label,
            first_seen_at=message.sent_at,
            last_seen_at=message.sent_at,
        )

    def accepts(self, message: SourceMessage) -> bool:
        """The same posting: same sender, same words, sent within the window of the first (D-113)."""
        return (
            isinstance(self.verdict, Pending)
            and message.sender.phone == self.sender.phone
            and text_key(message.text) == self.text_key
            and self.first_seen_at <= message.sent_at <= self.first_seen_at + DEDUP_WINDOW
        )

    def absorb(self, message: SourceMessage) -> Self:
        return self.evolve(sources=self.sources + 1, last_seen_at=max(self.last_seen_at, message.sent_at))

    def judge(self, verdict: Accepted | Rejected | Failed, *, at: datetime) -> Self:
        return self.evolve(verdict=verdict, judged_at=at)

    def fail(self, error: str, *, at: datetime) -> Self:
        """One more failed attempt; a failed candidate is pending again for the next sweep."""
        attempts = self.verdict.attempts + 1 if isinstance(self.verdict, Failed) else 1
        return self.judge(Failed(error=error[:200], attempts=attempts), at=at)

    def reopen(self) -> Self:
        """Back to pending, for a manual rejudge; the messages and the counts stay (D-130)."""
        return self.evolve(verdict=Pending(), judged_at=None)

    @property
    def is_pending(self) -> bool:
        return isinstance(self.verdict, Pending)
