from datetime import datetime
from typing import Protocol

from brazcar.feedback.domain import Feedback


class FeedbackBox(Protocol):
    async def keep(self, feedback: Feedback) -> None:
        """Store one opinion as sent. Nothing ever edits it."""
        ...

    async def since(self, at: datetime) -> tuple[Feedback, ...]:
        """Every opinion sent at `at` or later, oldest first."""
        ...
