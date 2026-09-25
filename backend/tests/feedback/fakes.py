"""In-memory adapters of the feedback ports, for use-case tests."""

from datetime import UTC, datetime

from brazcar.feedback.domain import Feedback

NOW = datetime(2026, 9, 25, 12, 0, tzinfo=UTC)


class InMemoryFeedbackBox:
    def __init__(self) -> None:
        self.kept: list[Feedback] = []

    async def keep(self, feedback: Feedback) -> None:
        self.kept.append(feedback)

    async def since(self, at: datetime) -> tuple[Feedback, ...]:
        return tuple(sorted((f for f in self.kept if f.at >= at), key=lambda f: f.at))


class FixedClock:
    def __init__(self, at: datetime = NOW) -> None:
        self.at = at

    def now(self) -> datetime:
        return self.at
