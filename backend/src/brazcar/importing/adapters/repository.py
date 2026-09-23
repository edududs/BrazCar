"""`SourceMessages` over the Django table. Reads and writes go through `sync_to_async` (ADR-0008)."""

from datetime import datetime

from asgiref.sync import sync_to_async
from django.db import transaction

from brazcar.importing.domain import Sender, SourceMessage

from .models import SourceMessageModel


class DjangoSourceMessages:
    async def save(self, message: SourceMessage) -> bool:
        return await sync_to_async(_save)(message)

    async def delete_older_than(self, cutoff: datetime) -> int:
        deleted, _ = await SourceMessageModel.objects.filter(received_at__lt=cutoff).adelete()
        return deleted


@transaction.atomic
def _save(message: SourceMessage) -> bool:
    _, created = SourceMessageModel.objects.get_or_create(
        account=message.account,
        message_id=message.message_id,
        defaults={
            "chat_jid": message.chat_jid,
            "sender_phone": message.sender.phone,
            "sender_name": message.sender.display_name,
            "sent_at": message.sent_at,
            "text": message.text,
            "received_at": message.received_at,
        },
    )
    return created


def from_row(row: SourceMessageModel) -> SourceMessage:
    return SourceMessage(
        account=row.account,
        message_id=row.message_id,
        chat_jid=row.chat_jid,
        sender=Sender(phone=row.sender_phone, display_name=row.sender_name),
        sent_at=row.sent_at,
        text=row.text,
        received_at=row.received_at,
    )
