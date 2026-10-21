from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID, uuid4

import pytest

from brazcar.alerts.application import AlertRepository, NoticeLog
from brazcar.alerts.domain import AccountId, RideAlert

DAY = date(2030, 6, 10)
BEFORE = datetime(2030, 6, 1, 12, 0, tzinfo=UTC)


def make_alert(  # noqa: PLR0913 - every fact of the alert, by name
    owner_id: AccountId,
    *,
    day: date = DAY,
    text: str | None = "Rodoviária",
    from_time: time | None = None,
    until_time: time | None = None,
    minutes: int = 0,
) -> RideAlert:
    return RideAlert(
        id=uuid4(),
        owner_id=owner_id,
        text=text,
        day=day,
        from_time=from_time,
        until_time=until_time,
        created_at=BEFORE + timedelta(minutes=minutes),
    )


class AlertRepositoryContract:
    """Subclass as `TestMyAlertRepository`; implement `make_alerts` and, for a real store, `owner`."""

    def make_alerts(self) -> AlertRepository:
        raise NotImplementedError

    async def owner(self) -> AccountId:
        """An account that may own alerts. The fake takes any identifier; the adapter needs a row."""
        return uuid4()

    @pytest.mark.parametrize("text", [None, "Rodoviária do Plano"])
    @pytest.mark.parametrize("from_time", [None, time(6, 30)])
    @pytest.mark.parametrize("until_time", [None, time(9, 0)])
    async def test_a_kept_alert_comes_back_whole(
        self, text: str | None, from_time: time | None, until_time: time | None
    ) -> None:
        alerts = self.make_alerts()
        alert = make_alert(await self.owner(), text=text, from_time=from_time, until_time=until_time)

        await alerts.add(alert)

        assert await alerts.get(alert.id) == alert

    async def test_an_unknown_alert_is_none(self) -> None:
        assert await self.make_alerts().get(uuid4()) is None

    async def test_remove_deletes_the_alert_and_a_missing_one_is_fine(self) -> None:
        alerts = self.make_alerts()
        alert = make_alert(await self.owner())
        await alerts.add(alert)

        await alerts.remove(alert.id)
        await alerts.remove(alert.id)

        assert await alerts.get(alert.id) is None

    async def test_of_owner_lists_only_the_account_from_since_on_by_day_then_creation(self) -> None:
        alerts = self.make_alerts()
        mine, other = await self.owner(), await self.owner()
        later_day = make_alert(mine, day=DAY + timedelta(days=2), minutes=0)
        second = make_alert(mine, minutes=5)
        first = make_alert(mine, minutes=1)
        past = make_alert(mine, day=DAY - timedelta(days=1))
        theirs = make_alert(other)
        for alert in (later_day, second, first, past, theirs):
            await alerts.add(alert)

        found = await alerts.of_owner(mine, since=DAY)

        assert found == (first, second, later_day)

    async def test_on_day_lists_that_day_of_any_account_by_creation(self) -> None:
        alerts = self.make_alerts()
        one, two = await self.owner(), await self.owner()
        day = DAY + timedelta(days=40)
        second = make_alert(one, day=day, minutes=9)
        first = make_alert(two, day=day, minutes=2)
        elsewhere = make_alert(one, day=day + timedelta(days=1))
        for alert in (second, first, elsewhere):
            await alerts.add(alert)

        assert await alerts.on_day(day) == (first, second)

    async def test_purge_deletes_only_the_days_before_and_counts_them(self) -> None:
        alerts = self.make_alerts()
        owner = await self.owner()
        old, older = (
            make_alert(owner, day=DAY - timedelta(days=3)),
            make_alert(owner, day=DAY - timedelta(days=1)),
        )
        kept = make_alert(owner, day=DAY)
        for alert in (old, older, kept):
            await alerts.add(alert)

        gone = await alerts.purge(before=DAY)

        assert gone == 2
        assert [await alerts.get(a.id) for a in (old, older, kept)] == [None, None, kept]


class NoticeLogContract:
    """Subclass as `TestMyNoticeLog`; the alert of a pair must exist first, as in the database."""

    def make_alerts(self) -> AlertRepository:
        raise NotImplementedError

    def make_notices(self) -> NoticeLog:
        raise NotImplementedError

    async def owner(self) -> AccountId:
        return uuid4()

    async def stored(self, alerts: AlertRepository) -> UUID:
        alert = make_alert(await self.owner())
        await alerts.add(alert)
        return alert.id

    async def test_a_pair_is_claimed_once_and_never_again(self) -> None:
        alerts, notices = self.make_alerts(), self.make_notices()
        alert_id, ride_id = await self.stored(alerts), uuid4()

        first = await notices.claim(alert_id, ride_id, at=BEFORE)
        again = await notices.claim(alert_id, ride_id, at=BEFORE + timedelta(hours=1))

        assert (first, again) == (True, False)

    async def test_pairs_are_independent(self) -> None:
        alerts, notices = self.make_alerts(), self.make_notices()
        alert_id, other_alert, ride_id = await self.stored(alerts), await self.stored(alerts), uuid4()

        assert await notices.claim(alert_id, ride_id, at=BEFORE)
        assert await notices.claim(alert_id, uuid4(), at=BEFORE)
        assert await notices.claim(other_alert, ride_id, at=BEFORE)
