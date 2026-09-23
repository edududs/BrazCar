"""In-memory adapters for the use-case tests. The repository is held to the port contract."""

from datetime import datetime

from brazcar.importing.domain import SourceMessage


class InMemorySourceMessages:
    def __init__(self) -> None:
        self.rows: dict[tuple[str, str], SourceMessage] = {}

    async def save(self, message: SourceMessage) -> bool:
        if message.key in self.rows:
            return False
        self.rows[message.key] = message
        return True

    async def delete_older_than(self, cutoff: datetime) -> int:
        gone = [key for key, row in self.rows.items() if row.received_at < cutoff]
        for key in gone:
            del self.rows[key]
        return len(gone)


class FixedClock:
    def __init__(self, at: datetime) -> None:
        self.at = at

    def now(self) -> datetime:
        return self.at
