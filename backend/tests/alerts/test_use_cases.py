import logging
from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID, uuid4

import pytest

from brazcar.alerts.application import (
    AlertRules,
    CreateAlert,
    DeleteAlert,
    ListAlerts,
    NotifyMatchingAlerts,
    PurgeAlerts,
    RideSummary,
)
from brazcar.alerts.domain import (
    AlertDayPastError,
    AlertLimitError,
    AlertNotFoundError,
    AlertWindowError,
    RideAlert,
    ride_found,
)

from .fakes import (
    NOW,
    ZONE,
    FixedClock,
    InMemoryAlertRepository,
    InMemoryNoticeLog,
    RecordingPushSender,
    StubBoardRides,
)

RULES = AlertRules()
TODAY = date(2026, 10, 21)
STOPS = ("Rodoviária do Plano", "Brazlândia")


async def _alert(
    repo: InMemoryAlertRepository, owner: UUID, *, day: date = TODAY, created_at: datetime = NOW
) -> RideAlert:
    alert = RideAlert(
        id=uuid4(), owner_id=owner, text=None, day=day, from_time=None, until_time=None, created_at=created_at
    )
    await repo.add(alert)
    return alert


# CreateAlert


async def test_create_keeps_the_alert() -> None:
    repo = InMemoryAlertRepository()
    owner = uuid4()

    alert = await CreateAlert(repo, FixedClock(), RULES)(
        owner, text="  Plano ", day=TODAY, from_time=time(7, 0), until_time=time(9, 0)
    )

    assert repo.alerts == {alert.id: alert}
    assert (alert.owner_id, alert.text, alert.created_at) == (owner, "Plano", NOW)


async def test_create_refuses_a_past_day_and_keeps_nothing() -> None:
    repo = InMemoryAlertRepository()

    with pytest.raises(AlertDayPastError):
        await CreateAlert(repo, FixedClock(), RULES)(
            uuid4(), text=None, day=date(2026, 10, 20), from_time=None, until_time=None
        )

    assert repo.alerts == {}


async def test_create_refuses_an_inverted_window_and_keeps_nothing() -> None:
    repo = InMemoryAlertRepository()

    with pytest.raises(AlertWindowError):
        await CreateAlert(repo, FixedClock(), RULES)(
            uuid4(), text=None, day=TODAY, from_time=time(9, 0), until_time=time(7, 0)
        )

    assert repo.alerts == {}


async def _create(create: CreateAlert, owner: UUID) -> RideAlert:
    return await create(owner, text=None, day=TODAY, from_time=None, until_time=None)


async def test_the_sixth_alert_hits_the_limit() -> None:
    repo = InMemoryAlertRepository()
    create = CreateAlert(repo, FixedClock(), RULES)
    owner = uuid4()
    for _ in range(5):
        await _create(create, owner)

    with pytest.raises(AlertLimitError) as refused:
        await _create(create, owner)

    assert refused.value.limit == 5
    assert len(repo.alerts) == 5


async def test_an_expired_alert_does_not_count() -> None:
    repo = InMemoryAlertRepository()
    owner = uuid4()
    for _ in range(5):
        await _alert(repo, owner, day=date(2026, 10, 20))

    await _create(CreateAlert(repo, FixedClock(), RULES), owner)

    assert len(repo.alerts) == 6


async def test_another_accounts_alerts_do_not_count() -> None:
    repo = InMemoryAlertRepository()
    for _ in range(5):
        await _alert(repo, uuid4())

    await _create(CreateAlert(repo, FixedClock(), RULES), uuid4())

    assert len(repo.alerts) == 6


async def test_deleting_one_frees_the_limit() -> None:
    repo = InMemoryAlertRepository()
    create = CreateAlert(repo, FixedClock(), RULES)
    owner = uuid4()
    first = await _create(create, owner)
    for _ in range(4):
        await _create(create, owner)

    await DeleteAlert(repo)(owner, first.id)
    await _create(create, owner)

    assert len(repo.alerts) == 5


# ListAlerts


async def test_list_returns_only_the_accounts_active_alerts_by_day_then_creation() -> None:
    repo = InMemoryAlertRepository()
    owner = uuid4()
    later_day = await _alert(repo, owner, day=date(2026, 10, 23))
    second = await _alert(repo, owner, created_at=NOW + timedelta(minutes=1))
    first = await _alert(repo, owner)
    await _alert(repo, owner, day=date(2026, 10, 20))
    await _alert(repo, uuid4())

    listed = await ListAlerts(repo, FixedClock(), RULES)(owner)

    assert listed.alerts == (first, second, later_day)
    assert listed.limit == 5


async def test_list_carries_the_limit_of_the_rules() -> None:
    listed = await ListAlerts(InMemoryAlertRepository(), FixedClock(), AlertRules(limit=3))(uuid4())

    assert listed.alerts == ()
    assert listed.limit == 3


# DeleteAlert


async def test_delete_removes_the_accounts_own_alert() -> None:
    repo = InMemoryAlertRepository()
    owner = uuid4()
    alert = await _alert(repo, owner)

    await DeleteAlert(repo)(owner, alert.id)

    assert repo.alerts == {}


async def test_delete_of_another_accounts_alert_is_not_found_and_changes_nothing() -> None:
    repo = InMemoryAlertRepository()
    alert = await _alert(repo, uuid4())

    with pytest.raises(AlertNotFoundError) as refused:
        await DeleteAlert(repo)(uuid4(), alert.id)

    assert refused.value.alert_id == alert.id
    assert repo.alerts == {alert.id: alert}


async def test_delete_of_a_missing_alert_is_not_found() -> None:
    with pytest.raises(AlertNotFoundError):
        await DeleteAlert(InMemoryAlertRepository())(uuid4(), uuid4())


# NotifyMatchingAlerts


class World:
    def __init__(self, now: datetime = NOW) -> None:
        self.repo = InMemoryAlertRepository()
        self.rides = StubBoardRides()
        self.log = InMemoryNoticeLog()
        self.sender = RecordingPushSender()
        self.notify = NotifyMatchingAlerts(
            self.repo, self.rides, self.log, self.sender, FixedClock(now), RULES
        )

    def ride(self, departure_at: datetime) -> UUID:
        ride_id = uuid4()
        self.rides.summaries[ride_id] = RideSummary(ride_id=ride_id, stops=STOPS, departure_at=departure_at)
        return ride_id


DEPARTURE = datetime(2026, 10, 21, 17, 30, tzinfo=UTC)  # 14:30 local on TODAY


async def test_a_matching_alert_warns_its_owner_with_the_notice() -> None:
    world = World()
    owner = uuid4()
    alert = await _alert(world.repo, owner)
    ride_id = world.ride(DEPARTURE)
    world.rides.shown.add((ride_id, alert.id))

    await world.notify(ride_id)

    expected = ride_found(alert.id, ride_id=ride_id, stops=STOPS, departure_at=DEPARTURE, now=NOW, zone=ZONE)
    assert world.sender.sent == [(owner, expected)]
    assert expected.body == "Rodoviária do Plano → Brazlândia, hoje às 14:30"


async def test_an_alert_the_board_would_not_show_is_not_warned() -> None:
    world = World()
    await _alert(world.repo, uuid4())
    ride_id = world.ride(DEPARTURE)

    await world.notify(ride_id)

    assert world.sender.sent == []
    assert world.log.claimed == set()


async def test_a_ride_without_summary_does_nothing() -> None:
    world = World()
    await _alert(world.repo, uuid4())

    await world.notify(uuid4())

    assert world.sender.sent == []
    assert world.rides.asked == []


async def test_only_alerts_of_the_rides_local_day_are_asked() -> None:
    world = World()
    owner = uuid4()
    same_day = await _alert(world.repo, owner, day=TODAY)
    await _alert(world.repo, owner, day=date(2026, 10, 22))
    await _alert(world.repo, owner, day=date(2026, 10, 20))
    departure = datetime(2026, 10, 22, 2, 30, tzinfo=UTC)  # 21/10, 23:30 local; already 22/10 in UTC
    ride_id = world.ride(departure)

    await world.notify(ride_id)

    assert world.rides.asked == [(ride_id, same_day.id)]


async def test_the_same_ride_warns_an_alert_once() -> None:
    world = World()
    alert = await _alert(world.repo, uuid4())
    ride_id = world.ride(DEPARTURE)
    world.rides.shown.add((ride_id, alert.id))

    await world.notify(ride_id)
    await world.notify(ride_id)

    assert len(world.sender.sent) == 1


async def test_an_expired_alert_is_not_warned() -> None:
    after_the_day = datetime(2026, 10, 22, 3, 0, tzinfo=UTC)  # 22/10, 00:00 local
    world = World(after_the_day)
    alert = await _alert(world.repo, uuid4())
    ride_id = world.ride(DEPARTURE)
    world.rides.shown.add((ride_id, alert.id))

    await world.notify(ride_id)

    assert world.sender.sent == []


async def test_two_accounts_that_match_each_get_their_own() -> None:
    world = World()
    owners = (uuid4(), uuid4())
    ride_id = world.ride(DEPARTURE)
    alerts = [
        await _alert(world.repo, owner, created_at=NOW + timedelta(minutes=i))
        for i, owner in enumerate(owners)
    ]
    world.rides.shown.update((ride_id, alert.id) for alert in alerts)

    await world.notify(ride_id)

    assert [(owner, notice.tag) for owner, notice in world.sender.sent] == [
        (owners[0], str(alerts[0].id)),
        (owners[1], str(alerts[1].id)),
    ]


async def test_a_failing_delivery_neither_raises_nor_stops_the_others(
    caplog: pytest.LogCaptureFixture,
) -> None:
    world = World()
    broken, fine = uuid4(), uuid4()
    ride_id = world.ride(DEPARTURE)
    first = await _alert(world.repo, broken)
    second = await _alert(world.repo, fine, created_at=NOW + timedelta(minutes=1))
    world.rides.shown.update({(ride_id, first.id), (ride_id, second.id)})
    world.sender.failing_for.add(broken)

    with caplog.at_level(logging.ERROR):
        await world.notify(ride_id)

    assert [owner for owner, _ in world.sender.sent] == [fine]
    assert "failed" in caplog.text


async def test_a_failed_pair_stays_claimed_and_is_not_resent() -> None:
    world = World()
    broken = uuid4()
    alert = await _alert(world.repo, broken)
    ride_id = world.ride(DEPARTURE)
    world.rides.shown.add((ride_id, alert.id))
    world.sender.failing_for.add(broken)

    await world.notify(ride_id)
    world.sender.failing_for.clear()
    await world.notify(ride_id)

    assert (alert.id, ride_id) in world.log.claimed
    assert world.sender.sent == []


# PurgeAlerts


async def test_purge_removes_only_days_before_today_and_counts_them() -> None:
    repo = InMemoryAlertRepository()
    owner = uuid4()
    await _alert(repo, owner, day=date(2026, 10, 19))
    await _alert(repo, owner, day=date(2026, 10, 20))
    today = await _alert(repo, owner, day=TODAY)
    tomorrow = await _alert(repo, owner, day=date(2026, 10, 22))

    removed = await PurgeAlerts(repo, FixedClock(), RULES)()

    assert removed == 2
    assert set(repo.alerts) == {today.id, tomorrow.id}
