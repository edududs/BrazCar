from datetime import UTC, datetime, timedelta

from brazcar.importing.application import PurgeSourceMessages
from tests.contracts.source_messages import fresh

from .fakes import FixedClock, InMemorySourceMessages

NOW = datetime(2026, 9, 24, 12, 0, tzinfo=UTC)


async def test_messages_older_than_the_retention_go_and_the_rest_stay() -> None:
    messages = InMemorySourceMessages()
    await messages.save(fresh(received_at=NOW - timedelta(hours=25)))
    await messages.save(fresh(received_at=NOW - timedelta(hours=23)))
    purge = PurgeSourceMessages(messages, FixedClock(NOW), retention=timedelta(hours=24))

    assert await purge() == 1
    assert await purge() == 0
    assert len(messages.rows) == 1
