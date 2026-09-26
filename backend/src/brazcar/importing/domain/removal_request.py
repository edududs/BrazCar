"""A driver whose ride came from a group asks to be left out, from the public page (D-162, D-172).

The page is open to anyone, so a request removes nothing by itself: it waits until it is approved
by command, and only the approval blocks the phone. A decision, once taken, is final: approving
what was approved, or refusing what was refused, changes nothing; the opposite decision is refused.
"""

from datetime import datetime
from typing import Annotated, Literal, Self
from uuid import UUID, uuid4

from pydantic import AfterValidator, Field, StringConstraints, model_validator

from brazcar.shared.domain.model import FrozenModel
from brazcar.shared.domain.phone import PhoneNumber

from .candidate import Pending

NOTE_LIMIT = 500  # characters of plain text, after the ends are trimmed

type RemovalRequestId = UUID


def _no_nul(text: str) -> str:
    """A NUL character cannot be stored in a Postgres text column: refused here, not by the database."""
    if "\x00" in text:
        message = "the note carries a NUL character"
        raise ValueError(message)
    return text


type Note = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=NOTE_LIMIT),
    AfterValidator(_no_nul),
]


class RemovalAlreadyDecidedError(ValueError):
    """Approving a refused request, or refusing an approved one: the first decision stands."""

    def __init__(self, decision: str) -> None:
        super().__init__(f"the request was already {decision}")
        self.decision = decision


class TooManyAttemptsError(Exception):
    """The same client sent as many removal requests as its window allows."""


class Approved(FrozenModel):
    """The phone is blocked, and what was imported from it is gone (D-119)."""

    kind: Literal["approved"] = "approved"
    at: datetime


class Refused(FrozenModel):
    """Nothing was removed; the request stays on record."""

    kind: Literal["refused"] = "refused"
    at: datetime


type RemovalDecision = Annotated[Pending | Approved | Refused, Field(discriminator="kind")]


class RemovalRequest(FrozenModel):
    id: RemovalRequestId
    phone: PhoneNumber  # any valid number, as the importing takes (D-137)
    requested_at: datetime
    note: Note | None = None  # read only by the command, never sent back over HTTP
    decision: RemovalDecision = Pending()

    @model_validator(mode="after")
    def _decided_after_it_was_asked(self) -> Self:
        if not isinstance(self.decision, Pending) and self.decision.at < self.requested_at:
            message = "a decision precedes the request it decides"
            raise ValueError(message)
        return self

    @classmethod
    def open(cls, *, phone: PhoneNumber, note: str | None, at: datetime) -> Self:
        """A blank note is no note."""
        return cls(id=uuid4(), phone=phone, requested_at=at, note=note if note and note.strip() else None)

    def approve(self, now: datetime) -> Self:
        """Raises `RemovalAlreadyDecidedError` when it was refused."""
        match self.decision:
            case Approved():
                return self
            case Refused():
                raise RemovalAlreadyDecidedError(self.decision.kind)
            case Pending():
                return self.evolve(decision=Approved(at=now))

    def refuse(self, now: datetime) -> Self:
        """Raises `RemovalAlreadyDecidedError` when it was approved."""
        match self.decision:
            case Refused():
                return self
            case Approved():
                raise RemovalAlreadyDecidedError(self.decision.kind)
            case Pending():
                return self.evolve(decision=Refused(at=now))

    @property
    def is_pending(self) -> bool:
        return isinstance(self.decision, Pending)
