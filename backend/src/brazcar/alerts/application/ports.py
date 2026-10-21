from datetime import date, datetime
from typing import Protocol

from brazcar.alerts.domain import AccountId, AlertId, Notice, RideAlert, RideId
from brazcar.shared.domain.model import FrozenModel


class RideSummary(FrozenModel):
    """What alerts needs to know of a ride, by identifier (D-006)."""

    ride_id: RideId
    stops: tuple[str, ...]  # labels, origin first
    departure_at: datetime  # aware


class BoardRides(Protocol):
    """What alerts asks of `rides`."""

    async def summary(self, ride_id: RideId) -> RideSummary | None:
        """The ride as the anonymous view shows it (D-171); `None` when it does not exist."""
        ...

    async def shows(self, ride_id: RideId, alert: RideAlert) -> bool:
        """Whether the board, filtered as the alert asks and only with seats, shows this ride now.

        The one source of matching (D-176).
        """
        ...


class AlertRepository(Protocol):
    async def add(self, alert: RideAlert) -> None: ...

    async def get(self, alert_id: AlertId) -> RideAlert | None: ...

    async def remove(self, alert_id: AlertId) -> None:
        """Takes its notices along; a missing alert is fine."""
        ...

    async def of_owner(self, owner_id: AccountId, *, since: date) -> tuple[RideAlert, ...]:
        """The owner's alerts with `day >= since`, ordered by `(day, created_at)`."""
        ...

    async def on_day(self, day: date) -> tuple[RideAlert, ...]:
        """Every alert of that day, any owner, ordered by `created_at`."""
        ...

    async def purge(self, *, before: date) -> int:
        """Delete alerts with `day < before` and their notices; returns how many alerts went (D-179)."""
        ...


class NoticeLog(Protocol):
    async def claim(self, alert_id: AlertId, ride_id: RideId, *, at: datetime) -> bool:
        """Record that this alert was told about this ride: True the first time, False ever after.

        Whatever changed in the ride, it is one notice per (alert, ride). Claimed before sending:
        at most once, never repeated (D-178).
        """
        ...


class PushSender(Protocol):
    async def send(self, owner_id: AccountId, notice: Notice) -> None:
        """Deliver to every device of the account; with no device, nothing happens.

        May raise on a failed delivery: the use case logs it and goes on (D-178).
        """
        ...
