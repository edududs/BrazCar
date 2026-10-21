from datetime import UTC, date, datetime, time
from uuid import uuid4

import pytest

from brazcar.alerts.domain import (
    TEXT_LIMIT,
    AlertDayPastError,
    AlertWindowError,
    RideAlert,
)

from .fakes import NOW, ZONE

TODAY = date(2026, 10, 21)


def _create(
    *,
    text: str | None = None,
    day: date = TODAY,
    from_time: time | None = None,
    until_time: time | None = None,
    now: datetime = NOW,
) -> RideAlert:
    return RideAlert.create(
        owner_id=uuid4(), text=text, day=day, from_time=from_time, until_time=until_time, now=now, zone=ZONE
    )


def test_an_inverted_window_is_refused_by_name() -> None:
    with pytest.raises(AlertWindowError):
        _create(from_time=time(18, 0), until_time=time(17, 59))


def test_a_window_of_one_instant_is_accepted() -> None:
    alert = _create(from_time=time(18, 0), until_time=time(18, 0))

    assert alert.from_time == alert.until_time == time(18, 0)


@pytest.mark.parametrize(
    ("from_time", "until_time"),
    [(time(7, 0), None), (None, time(9, 0)), (None, None), (time(7, 0), time(9, 0))],
)
def test_one_bound_both_or_none_are_accepted(from_time: time | None, until_time: time | None) -> None:
    alert = _create(from_time=from_time, until_time=until_time)

    assert (alert.from_time, alert.until_time) == (from_time, until_time)


def test_the_model_itself_refuses_an_inverted_window() -> None:
    alert = _create()

    with pytest.raises(ValueError, match=r"AlertWindowError|Value error"):
        alert.evolve(from_time=time(18, 0), until_time=time(17, 0))


def test_a_past_day_is_refused_by_name() -> None:
    with pytest.raises(AlertDayPastError):
        _create(day=date(2026, 10, 20))


def test_today_is_accepted() -> None:
    assert _create(day=TODAY).day == TODAY


def test_today_is_the_boards_not_utc() -> None:
    late = datetime(2026, 10, 21, 2, 0, tzinfo=UTC)  # 20/10, 23:00 in Brasília

    assert _create(day=date(2026, 10, 20), now=late).day == date(2026, 10, 20)
    with pytest.raises(AlertDayPastError):
        _create(day=date(2026, 10, 19), now=late)


@pytest.mark.parametrize("blank", ["", "   ", "\t\n"])
def test_blank_text_becomes_none(blank: str) -> None:
    assert _create(text=blank).text is None


def test_text_is_trimmed() -> None:
    assert _create(text="  Rodoviária  ").text == "Rodoviária"


def test_text_above_the_limit_is_refused() -> None:
    assert _create(text="a" * TEXT_LIMIT).text == "a" * TEXT_LIMIT
    with pytest.raises(ValueError, match="at most"):
        _create(text="a" * (TEXT_LIMIT + 1))


def test_an_alert_is_active_until_the_last_minute_of_its_local_day() -> None:
    alert = _create(day=TODAY)

    assert alert.is_active(datetime(2026, 10, 22, 2, 59, tzinfo=UTC), ZONE)  # 21/10, 23:59 local
    assert not alert.is_active(datetime(2026, 10, 22, 3, 0, tzinfo=UTC), ZONE)  # 22/10, 00:00 local


def test_an_alert_is_active_on_the_days_before_its_own() -> None:
    assert _create(day=date(2026, 10, 25)).is_active(NOW, ZONE)
