"""The extractor's `MessageWriter`, kept by this repo (D-042): decides what is worth a row (D-111).

The extractor already filters by watchlist; this is the second gate, the one that knows the
platform's rules: only text, only from a watched group, only from someone else, only with a phone
to contact. Everything else is dropped in silence, at debug level.
"""

import logging
from collections.abc import Iterable
from datetime import datetime

from whatsapp_extractor.domain import ChatKind, Message, MessageKind

from brazcar.importing.application import Clock, SourceMessages
from brazcar.importing.domain import Sender, SourceMessage, WatchedGroup
from brazcar.shared.domain.phone import InvalidPhoneNumberError, PhoneNumber

log = logging.getLogger(__name__)


class DjangoStore:
    def __init__(
        self, messages: SourceMessages, *, account: str, groups: Iterable[WatchedGroup], clock: Clock
    ) -> None:
        self._messages = messages
        self._account = PhoneNumber.from_jid_user(account)
        self._watched = frozenset(group.jid for group in groups)
        self._clock = clock

    async def save(self, message: Message) -> None:
        source = to_source_message(
            message, account=self._account, watched=self._watched, received_at=self._clock.now()
        )
        if source is None:
            log.debug("dropped message %s from %s", message.id, message.chat.jid.value)
            return
        if await self._messages.save(source):
            log.info("stored message %s from %s", source.message_id, source.chat_jid)


def to_source_message(
    message: Message, *, account: PhoneNumber, watched: frozenset[str], received_at: datetime
) -> SourceMessage | None:
    """The platform's view of an extracted message, or None when it is not worth keeping."""
    if message.chat.kind is not ChatKind.GROUP or message.chat.jid.value not in watched:
        return None
    if message.kind is not MessageKind.TEXT or message.from_me or message.is_edit:
        return None
    if not message.content.text.strip() or message.sender.phone is None:
        return None
    try:  # always through `from_jid_user`: the same person, with or without the ninth digit (D-138)
        phone = PhoneNumber.from_jid_user(message.sender.phone)
    except InvalidPhoneNumberError:
        return None
    return SourceMessage(
        account=account,
        message_id=message.id,
        chat_jid=message.chat.jid.value,
        sender=Sender(phone=phone, display_name=message.sender.pushname),
        sent_at=message.timestamp,
        text=message.content.text,
        received_at=received_at,
    )
