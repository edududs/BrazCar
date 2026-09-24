from collections.abc import Collection
from datetime import datetime
from typing import Protocol
from uuid import UUID

from brazcar.importing.domain import (
    Candidate,
    CandidateId,
    Phone,
    ResolvedStop,
    RideDraft,
    Sender,
    SourceMessage,
)
from brazcar.shared.application.ports import Clock
from brazcar.shared.domain.model import FrozenModel

from .parser_output import ParserOutput

__all__ = [
    "BlockedSenders",
    "Candidates",
    "Clock",
    "ImportedRide",
    "ImportedRides",
    "RideParser",
    "SourceMessages",
    "StopResolver",
]


class SourceMessages(Protocol):
    async def save(self, message: SourceMessage) -> bool:
        """Store the message unless its (account, message id) is already there. True when stored.

        Never replaces: the extractor may hand the same message again after a restart (D-111).
        """
        ...

    async def unattached(self, limit: int) -> tuple[SourceMessage, ...]:
        """Messages no candidate has taken yet, oldest sent first."""
        ...

    async def delete_older_than(self, cutoff: datetime) -> int:
        """Forget every unattached message received before `cutoff`; attached ones go with their
        candidate. Returns how many went (D-119)."""
        ...

    async def delete_from(self, phone: Phone) -> int:
        """Forget every message of one sender, attached or not (D-119)."""
        ...


class Candidates(Protocol):
    async def get(self, candidate_id: CandidateId) -> Candidate | None: ...

    async def open_for(self, phone: Phone, text_key: str, *, since: datetime) -> Candidate | None:
        """The pending candidate of this sender with these words first seen at or after `since`."""
        ...

    async def save(self, candidate: Candidate, *, attaching: SourceMessage | None = None) -> None:
        """Insert or replace the candidate and, in the same transaction, mark the message as its."""
        ...

    async def pending(self, limit: int, *, max_attempts: int) -> tuple[Candidate, ...]:
        """Never judged, or failed fewer than `max_attempts` times; oldest first (D-112)."""
        ...

    async def forget_by_ride(self, ride_ids: Collection[UUID]) -> int:
        """Delete the candidates of these rides, and their messages with them (D-119)."""
        ...

    async def forget_judged_before(self, cutoff: datetime) -> int:
        """Delete the candidates judged before `cutoff` that made no ride, with their messages."""
        ...

    async def forget_from(self, phone: Phone) -> int:
        """Delete every candidate of one sender, with their messages (D-119)."""
        ...


class RideParser(Protocol):
    """The interpreter (D-115): the message and its context in, a flat typed reading out.

    Errors propagate: a candidate whose reading failed is tried again later (D-112).
    """

    async def parse(self, text: str, *, sent_at: datetime, group_label: str) -> ParserOutput: ...


class StopResolver(Protocol):
    async def resolve(self, texts: tuple[str, ...]) -> tuple[ResolvedStop, ...]:
        """Each stop as the catalog knows it, or as written; in the same order (D-115)."""
        ...


class ImportedRide(FrozenModel):
    ride_id: UUID
    created: bool  # false when the driver already had a ride at that departure (D-113)


class ImportedRides(Protocol):
    """What `importing` asks of `rides`, by identifier only (D-006)."""

    async def create(
        self, *, sender: Sender, message_text: str, group_label: str, sent_at: datetime, draft: RideDraft
    ) -> ImportedRide: ...

    async def forget_departed(self, before: datetime) -> tuple[UUID, ...]:
        """Delete the external rides that left before `before`; the ids that went (D-119)."""
        ...

    async def forget_from(self, phone: Phone) -> tuple[UUID, ...]:
        """Delete the external rides of one sender; the ids that went (D-119)."""
        ...


class BlockedSenders(Protocol):
    async def is_blocked(self, phone: Phone) -> bool: ...

    async def block(self, phone: Phone) -> None: ...
