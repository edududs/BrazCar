from dataclasses import dataclass
from datetime import datetime, timedelta

from brazcar.feedback.domain import AccountId, Feedback, FeedbackKind, FeedbackLimitError
from brazcar.shared.application.ports import Clock, RateLimiter
from brazcar.shared.domain.phone import PhoneNumber

from .ports import FeedbackBox


@dataclass(frozen=True, slots=True)
class FeedbackRules:
    limit: int  # opinions per account in each window
    window: timedelta


@dataclass(frozen=True, slots=True)
class SendFeedback:
    box: FeedbackBox
    limiter: RateLimiter
    clock: Clock
    rules: FeedbackRules

    async def __call__(
        self,
        author_id: AccountId,
        *,
        kind: FeedbackKind,
        message: str,
        about_phone: str | None,
        web_version: str,
    ) -> Feedback:
        """Raises `InvalidPhoneNumberError`, a validation error, or `FeedbackLimitError`, in that order:
        a form with a mistake does not spend the window."""
        feedback = Feedback.send(
            author_id=author_id,
            kind=kind,
            message=message,
            about_phone=None if about_phone is None else PhoneNumber.parse(about_phone),
            web_version=web_version,
            at=self.clock.now(),
        )
        allowed = await self.limiter.acquire(
            f"feedback:{author_id}", limit=self.rules.limit, window=self.rules.window
        )
        if not allowed:
            raise FeedbackLimitError
        await self.box.keep(feedback)
        return feedback


@dataclass(frozen=True, slots=True)
class ReadFeedback:
    box: FeedbackBox

    async def __call__(self, since: datetime) -> tuple[Feedback, ...]:
        return await self.box.since(since)
