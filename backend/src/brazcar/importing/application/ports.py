from datetime import datetime
from typing import Protocol

from brazcar.importing.domain import SourceMessage
from brazcar.shared.application.ports import Clock

__all__ = ["Clock", "SourceMessages"]


class SourceMessages(Protocol):
    async def save(self, message: SourceMessage) -> bool:
        """Store the message unless its (account, message id) is already there. True when stored.

        Never replaces: the extractor may hand the same message again after a restart (D-111).
        """
        ...

    async def delete_older_than(self, cutoff: datetime) -> int:
        """Forget every message received before `cutoff`. Returns how many went (D-119)."""
        ...
