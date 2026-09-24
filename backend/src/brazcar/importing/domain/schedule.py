"""From "19:30" and "amanhã" to a departure the board can place (D-115). Code, never the model."""

from datetime import datetime, time, timedelta, tzinfo

from .judgement import Day


def resolve_departure(
    *,
    sent_at: datetime,
    day: Day,
    at: time | None,
    zone: tzinfo,
    tolerance: timedelta,
) -> datetime | None:
    """The departure in the board's zone, or None when the message gave no time.

    "Hoje" is the day the message was sent, "amanhã" the next. Unsaid, it is today while the time
    is still ahead (within the tolerance the board gives a ride to leave), else tomorrow: the
    evening post for the morning ride is the rule of the groups, not the exception.
    """
    if at is None:
        return None
    local = sent_at.astimezone(zone)
    today = datetime.combine(local.date(), at, tzinfo=zone)
    match day:
        case Day.TODAY:
            return today
        case Day.TOMORROW:
            return today + timedelta(days=1)
        case Day.UNKNOWN:
            return today if today + tolerance >= local else today + timedelta(days=1)
