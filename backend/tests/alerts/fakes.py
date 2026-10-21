"""In-memory adapters of the alerts ports, for use-case tests."""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from brazcar.alerts.application import RideSummary
from brazcar.alerts.domain import AccountId, AlertId, Notice, RideAlert, RideId

NOW = datetime(2026, 10, 21, 15, 0, tzinfo=UTC)  # 12:00 in Brasília
ZONE = ZoneInfo("America/Sao_Paulo")


class FixedClock:
    def __init__(self, at: datetime = NOW) -> None:
        self.at = at

    def now(self) -> datetime:
        return self.at


class InMemoryAlertRepository:
    def __init__(self) -> None:
        self.alerts: dict[AlertId, RideAlert] = {}

    async def add(self, alert: RideAlert) -> None:
        self.alerts[alert.id] = alert

    async def get(self, alert_id: AlertId) -> RideAlert | None:
        return self.alerts.get(alert_id)

    async def remove(self, alert_id: AlertId) -> None:
        self.alerts.pop(alert_id, None)

    async def of_owner(self, owner_id: AccountId, *, since: date) -> tuple[RideAlert, ...]:
        mine = (a for a in self.alerts.values() if a.owner_id == owner_id and a.day >= since)
        return tuple(sorted(mine, key=lambda a: (a.day, a.created_at)))

    async def on_day(self, day: date) -> tuple[RideAlert, ...]:
        return tuple(sorted((a for a in self.alerts.values() if a.day == day), key=lambda a: a.created_at))

    async def purge(self, *, before: date) -> int:
        gone = [a.id for a in self.alerts.values() if a.day < before]
        for alert_id in gone:
            del self.alerts[alert_id]
        return len(gone)


class InMemoryNoticeLog:
    def __init__(self) -> None:
        self.claimed: set[tuple[AlertId, RideId]] = set()

    async def claim(self, alert_id: AlertId, ride_id: RideId, *, at: datetime) -> bool:  # noqa: ARG002
        pair = (alert_id, ride_id)
        if pair in self.claimed:
            return False
        self.claimed.add(pair)
        return True


class RecordingPushSender:
    def __init__(self) -> None:
        self.sent: list[tuple[AccountId, Notice]] = []
        self.failing_for: set[AccountId] = set()

    async def send(self, owner_id: AccountId, notice: Notice) -> None:
        if owner_id in self.failing_for:
            message = "push service unavailable"
            raise RuntimeError(message)
        self.sent.append((owner_id, notice))


class StubBoardRides:
    def __init__(self) -> None:
        self.summaries: dict[RideId, RideSummary] = {}
        self.shown: set[tuple[RideId, AlertId]] = set()
        self.asked: list[tuple[RideId, AlertId]] = []

    async def summary(self, ride_id: RideId) -> RideSummary | None:
        return self.summaries.get(ride_id)

    async def shows(self, ride_id: RideId, alert: RideAlert) -> bool:
        self.asked.append((ride_id, alert.id))
        return (ride_id, alert.id) in self.shown
