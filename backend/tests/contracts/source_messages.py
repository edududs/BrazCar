from datetime import UTC, datetime, timedelta
from uuid import uuid4

from brazcar.importing.application import SourceMessages
from brazcar.importing.domain import Sender, SourceMessage

RECEIVED = datetime(2026, 9, 23, 20, 0, tzinfo=UTC)
GROUP = "120363000000000001@g.us"


def fresh(
    *, account: str = "5561900000001", received_at: datetime = RECEIVED, text: str = "3 vagas 19:30"
) -> SourceMessage:
    """A message nobody else stored: examples do not get a clean table."""
    return SourceMessage(
        account=account,
        message_id=uuid4().hex,
        chat_jid=GROUP,
        sender=Sender(phone="5561900000002", display_name="Motorista"),
        sent_at=received_at - timedelta(seconds=5),
        text=text,
        received_at=received_at,
    )


class SourceMessagesContract:
    """Subclass as `TestMyMessages` and implement `make_messages`."""

    def make_messages(self) -> SourceMessages:
        raise NotImplementedError

    async def test_the_same_message_is_stored_once_and_never_replaced(self) -> None:
        messages = self.make_messages()
        message = fresh()

        assert await messages.save(message) is True
        assert await messages.save(message.evolve(text="edited")) is False
        assert await messages.delete_older_than(RECEIVED + timedelta(seconds=1)) == 1

    async def test_two_accounts_may_hold_the_same_message_id(self) -> None:
        messages = self.make_messages()
        message = fresh(account="5561900000001")
        twin = message.evolve(account="5561900000009")

        assert await messages.save(message) is True
        assert await messages.save(twin) is True
        assert await messages.delete_older_than(RECEIVED + timedelta(seconds=1)) == 2

    async def test_purge_forgets_only_what_was_received_before_the_cutoff(self) -> None:
        messages = self.make_messages()
        old = fresh(received_at=RECEIVED - timedelta(hours=25))
        recent = fresh(received_at=RECEIVED - timedelta(hours=1))
        await messages.save(old)
        await messages.save(recent)

        assert await messages.delete_older_than(RECEIVED - timedelta(hours=24)) == 1
        assert await messages.delete_older_than(RECEIVED - timedelta(hours=24)) == 0
        assert await messages.save(recent) is False  # still there
        assert await messages.delete_older_than(RECEIVED) == 1
