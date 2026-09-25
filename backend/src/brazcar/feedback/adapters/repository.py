from datetime import datetime
from uuid import UUID

from asgiref.sync import sync_to_async

from brazcar.feedback.domain import Feedback, FeedbackKind
from brazcar.shared.domain.phone import PhoneNumber

from .models import FeedbackModel


class DjangoFeedbackBox:
    """`FeedbackBox` over the ORM: one row per opinion, written once."""

    async def keep(self, feedback: Feedback) -> None:
        await FeedbackModel.objects.acreate(
            id=feedback.id,
            author_id=feedback.author_id,
            kind=feedback.kind.value,
            message=feedback.message,
            about_phone="" if feedback.about_phone is None else feedback.about_phone.e164(),
            web_version=feedback.web_version,
            at=feedback.at,
        )

    async def since(self, at: datetime) -> tuple[Feedback, ...]:
        return await sync_to_async(_since)(at)


def _since(at: datetime) -> tuple[Feedback, ...]:
    return tuple(_to_entity(row) for row in FeedbackModel.objects.filter(at__gte=at).order_by("at"))


def _to_entity(row: FeedbackModel) -> Feedback:
    return Feedback(
        id=row.id,
        author_id=UUID(str(row.author_id)),
        kind=FeedbackKind(row.kind),
        message=row.message,
        about_phone=PhoneNumber.parse(row.about_phone) if row.about_phone else None,
        web_version=row.web_version,
        at=row.at,
    )
