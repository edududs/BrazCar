import logging
from dataclasses import dataclass, field
from datetime import date, time, tzinfo
from uuid import UUID
from zoneinfo import ZoneInfo

from brazcar.alerts.domain import (
    AccountId,
    AlertId,
    AlertLimitError,
    AlertNotFoundError,
    RideAlert,
    local_day,
    ride_found,
)
from brazcar.shared.application.ports import Clock

from .ports import AlertRepository, BoardRides, NoticeLog, PushSender

log = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class AlertRules:
    limit: int = 5  # active alerts per account (D-175)
    zone: tzinfo = field(default_factory=lambda: ZoneInfo("America/Sao_Paulo"))  # the board's (D-094)


@dataclass(frozen=True, slots=True)
class CreateAlert:
    alerts: AlertRepository
    clock: Clock
    rules: AlertRules

    async def __call__(
        self,
        owner_id: AccountId,
        *,
        text: str | None,
        day: date,
        from_time: time | None,
        until_time: time | None,
    ) -> RideAlert:
        """Raises `AlertWindowError`, `AlertDayPastError` or `AlertLimitError`, in that order.

        Only active alerts count toward the limit: an expired one never blocks (D-175).
        """
        now = self.clock.now()
        alert = RideAlert.create(
            owner_id=owner_id,
            text=text,
            day=day,
            from_time=from_time,
            until_time=until_time,
            now=now,
            zone=self.rules.zone,
        )
        active = await self.alerts.of_owner(owner_id, since=local_day(now, self.rules.zone))
        if len(active) >= self.rules.limit:
            raise AlertLimitError(self.rules.limit)
        await self.alerts.add(alert)
        return alert


@dataclass(frozen=True, slots=True)
class ActiveAlerts:
    """An account's active alerts with the cap it lives under, so callers never restate the cap."""

    alerts: tuple[RideAlert, ...]
    limit: int


@dataclass(frozen=True, slots=True)
class ListAlerts:
    alerts: AlertRepository
    clock: Clock
    rules: AlertRules

    async def __call__(self, owner_id: AccountId) -> ActiveAlerts:
        """The account's active alerts, by day and then by creation, with the limit (D-175)."""
        active = await self.alerts.of_owner(owner_id, since=local_day(self.clock.now(), self.rules.zone))
        return ActiveAlerts(alerts=active, limit=self.rules.limit)


@dataclass(frozen=True, slots=True)
class DeleteAlert:
    alerts: AlertRepository

    async def __call__(self, owner_id: AccountId, alert_id: AlertId) -> None:
        """A missing alert and another account's look the same: nobody learns it exists (D-175)."""
        alert = await self.alerts.get(alert_id)
        if alert is None or alert.owner_id != owner_id:
            raise AlertNotFoundError(alert_id)
        await self.alerts.remove(alert_id)


@dataclass(frozen=True, slots=True)
class NotifyMatchingAlerts:
    """Listener of `RideChanged`: tells each alert the board would match, once per ride (D-177, D-178)."""

    alerts: AlertRepository
    rides: BoardRides
    notices: NoticeLog
    sender: PushSender
    clock: Clock
    rules: AlertRules

    async def __call__(self, ride_id: UUID) -> None:
        zone = self.rules.zone
        now = self.clock.now()
        ride = await self.rides.summary(ride_id)
        if ride is None:
            return
        for alert in await self.alerts.on_day(local_day(ride.departure_at, zone)):
            if not alert.is_active(now, zone):
                continue
            if not await self.rides.shows(ride_id, alert):
                continue
            if not await self.notices.claim(alert.id, ride_id, at=now):
                continue
            notice = ride_found(
                alert.id,
                ride_id=ride_id,
                stops=ride.stops,
                departure_at=ride.departure_at,
                now=now,
                zone=zone,
            )
            try:
                await self.sender.send(alert.owner_id, notice)
            except Exception:
                log.exception("push for alert %s about ride %s failed", alert.id, ride_id)


@dataclass(frozen=True, slots=True)
class PurgeAlerts:
    alerts: AlertRepository
    clock: Clock
    rules: AlertRules

    async def __call__(self) -> int:
        """Remove the alerts of days before today (D-179); returns how many went."""
        return await self.alerts.purge(before=local_day(self.clock.now(), self.rules.zone))
