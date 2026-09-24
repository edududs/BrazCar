"""The ports of `importing` over Django tables. Writes go through `sync_to_async` (ADR-0008)."""

from collections.abc import Collection
from datetime import datetime
from uuid import UUID

from asgiref.sync import sync_to_async
from django.db import transaction
from django.db.models import Q, QuerySet
from django.utils import timezone

from brazcar.importing.domain import (
    Accepted,
    Candidate,
    CandidateId,
    Failed,
    Pending,
    Rejected,
    RejectReason,
    Sender,
    SourceMessage,
    Verdict,
)
from brazcar.shared.domain.phone import PhoneNumber

from .models import BlockedSenderModel, CandidateModel, SourceMessageModel


class DjangoSourceMessages:
    async def save(self, message: SourceMessage) -> bool:
        return await sync_to_async(_save_message)(message)

    async def unattached(self, limit: int) -> tuple[SourceMessage, ...]:
        rows = SourceMessageModel.objects.filter(candidate=None).order_by("sent_at", "id")[:limit]
        return tuple([message_from_row(row) async for row in rows])

    async def delete_older_than(self, cutoff: datetime) -> int:
        deleted, _ = await SourceMessageModel.objects.filter(candidate=None, received_at__lt=cutoff).adelete()
        return deleted

    async def delete_from(self, phone: PhoneNumber) -> int:
        deleted, _ = await SourceMessageModel.objects.filter(sender_phone=phone.jid_user()).adelete()
        return deleted


class DjangoCandidates:
    async def get(self, candidate_id: CandidateId) -> Candidate | None:
        row = await CandidateModel.objects.filter(id=candidate_id).afirst()
        return None if row is None else candidate_from_row(row)

    async def open_for(self, phone: PhoneNumber, text_key: str, *, since: datetime) -> Candidate | None:
        row = (
            await CandidateModel.objects.filter(
                sender_phone=phone.jid_user(), text_key=text_key, verdict="pending", first_seen_at__gte=since
            )
            .order_by("first_seen_at")
            .afirst()
        )
        return None if row is None else candidate_from_row(row)

    async def save(self, candidate: Candidate, *, attaching: SourceMessage | None = None) -> None:
        await sync_to_async(_save_candidate)(candidate, attaching)

    async def pending(self, limit: int, *, max_attempts: int) -> tuple[Candidate, ...]:
        rows = CandidateModel.objects.filter(
            Q(verdict="pending") | Q(verdict="failed", attempts__lt=max_attempts)
        ).order_by("first_seen_at")[:limit]
        return tuple([candidate_from_row(row) async for row in rows])

    async def judged_since(self, since: datetime) -> tuple[Candidate, ...]:
        rows = CandidateModel.objects.filter(first_seen_at__gte=since).exclude(verdict="pending")
        return tuple([candidate_from_row(row) async for row in rows.order_by("first_seen_at")])

    async def forget_by_ride(self, ride_ids: Collection[UUID]) -> int:
        if not ride_ids:
            return 0
        return await sync_to_async(_forget)(CandidateModel.objects.filter(ride_id__in=list(ride_ids)))

    async def forget_judged_before(self, cutoff: datetime) -> int:
        stale = CandidateModel.objects.filter(judged_at__lt=cutoff).exclude(verdict="accepted")
        return await sync_to_async(_forget)(stale)

    async def forget_from(self, phone: PhoneNumber) -> int:
        return await sync_to_async(_forget)(CandidateModel.objects.filter(sender_phone=phone.jid_user()))


class DjangoBlockedSenders:
    async def is_blocked(self, phone: PhoneNumber) -> bool:
        return await BlockedSenderModel.objects.filter(phone=phone.jid_user()).aexists()

    async def block(self, phone: PhoneNumber) -> None:
        await BlockedSenderModel.objects.aget_or_create(
            phone=phone.jid_user(), defaults={"blocked_at": timezone.now()}
        )


# --- rows and entities -----------------------------------------------------------------------------


@transaction.atomic
def _save_message(message: SourceMessage) -> bool:
    _, created = SourceMessageModel.objects.get_or_create(
        account=message.account.jid_user(),
        message_id=message.message_id,
        defaults={
            "chat_jid": message.chat_jid,
            "sender_phone": message.sender.phone.jid_user(),
            "sender_name": message.sender.display_name,
            "sent_at": message.sent_at,
            "text": message.text,
            "received_at": message.received_at,
        },
    )
    return created


@transaction.atomic
def _save_candidate(candidate: Candidate, attaching: SourceMessage | None) -> None:
    CandidateModel.objects.update_or_create(id=candidate.id, defaults=_candidate_fields(candidate))
    if attaching is not None:
        SourceMessageModel.objects.filter(
            account=attaching.account.jid_user(), message_id=attaching.message_id
        ).update(candidate_id=candidate.id)


@transaction.atomic
def _forget(rows: QuerySet[CandidateModel]) -> int:
    """Delete the candidates; their messages cascade. Returns the candidates, not the rows in total."""
    _, by_table = rows.delete()
    return int(by_table.get(CandidateModel._meta.label, 0))  # noqa: SLF001 - Django's own label of the model


def _candidate_fields(candidate: Candidate) -> dict[str, object]:
    verdict = candidate.verdict
    fields: dict[str, object] = {
        "sender_phone": candidate.sender.phone.jid_user(),
        "sender_name": candidate.sender.display_name,
        "text_key": candidate.text_key[:2000],
        "text": candidate.text,
        "group_label": candidate.group_label,
        "first_seen_at": candidate.first_seen_at,
        "last_seen_at": candidate.last_seen_at,
        "sources": candidate.sources,
        "verdict": verdict.kind,
        "ride_id": None,
        "joined": False,
        "reason": "",
        "confidence": None,
        "error": "",
        "attempts": 0,
        "judged_at": candidate.judged_at,
    }
    match verdict:
        case Accepted():
            fields.update(ride_id=verdict.ride_id, joined=verdict.joined)
        case Rejected():
            fields.update(reason=verdict.reason.value, confidence=verdict.confidence)
        case Failed():
            fields.update(error=verdict.error, attempts=verdict.attempts)
        case Pending():
            pass
    return fields


def _verdict_from_row(row: CandidateModel) -> Verdict:
    match row.verdict:
        case "accepted":
            assert row.ride_id is not None  # noqa: S101 - written together with the verdict
            return Accepted(ride_id=row.ride_id, joined=row.joined)
        case "rejected":
            return Rejected(reason=RejectReason(row.reason), confidence=row.confidence)
        case "failed":
            return Failed(error=row.error, attempts=row.attempts)
        case _:
            return Pending()


def candidate_from_row(row: CandidateModel) -> Candidate:
    return Candidate(
        id=row.id,
        sender=Sender(phone=PhoneNumber.from_jid_user(row.sender_phone), display_name=row.sender_name),
        text_key=row.text_key,
        text=row.text,
        group_label=row.group_label,
        first_seen_at=_local(row.first_seen_at),
        last_seen_at=_local(row.last_seen_at),
        sources=row.sources,
        verdict=_verdict_from_row(row),
        judged_at=None if row.judged_at is None else _local(row.judged_at),
    )


def message_from_row(row: SourceMessageModel) -> SourceMessage:
    return SourceMessage(
        account=PhoneNumber.from_jid_user(row.account),
        message_id=row.message_id,
        chat_jid=row.chat_jid,
        sender=Sender(phone=PhoneNumber.from_jid_user(row.sender_phone), display_name=row.sender_name),
        sent_at=_local(row.sent_at),
        text=row.text,
        received_at=_local(row.received_at),
    )


def _local(moment: datetime) -> datetime:
    """The database keeps UTC; the day rules of the schedule read the board's zone (D-094)."""
    return timezone.localtime(moment)
