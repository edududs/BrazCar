"""A standing request: "warn me when a ride with seats passes through X, on day D, between H1 and H2" (D-175).

The alert belongs to an account and nothing else; the day is required and the alert is inert once
that day is over (D-179). What it matches is decided by the board, not here (D-176).
"""

from datetime import date, datetime, time, tzinfo
from typing import Annotated, Self
from uuid import UUID, uuid4

from pydantic import StringConstraints, model_validator

from brazcar.shared.domain.model import FrozenModel

from .errors import AlertDayPastError, AlertWindowError

TEXT_LIMIT = 80  # the board's `q` has the same limit

type AlertId = UUID
type AccountId = UUID
type RideId = UUID
type AlertText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=TEXT_LIMIT)]


def local_day(moment: datetime, zone: tzinfo) -> date:
    """The calendar day of `moment` in `zone` (the board's, D-094)."""
    return moment.astimezone(zone).date()


class RideAlert(FrozenModel):
    id: AlertId
    owner_id: AccountId
    text: AlertText | None  # "passes through", same meaning as the board's `q` (D-101)
    day: date
    from_time: time | None  # local hour of the board, at or after (D-141)
    until_time: time | None  # local hour of the board, at or before, inclusive (D-176)
    created_at: datetime

    @model_validator(mode="after")
    def _window_is_not_inverted(self) -> Self:
        if self.from_time is not None and self.until_time is not None and self.until_time < self.from_time:
            raise AlertWindowError
        return self

    @classmethod
    def create(  # noqa: PLR0913 - every fact of the alert at once, by name
        cls,
        *,
        owner_id: AccountId,
        text: str | None,
        day: date,
        from_time: time | None,
        until_time: time | None,
        now: datetime,
        zone: tzinfo,
    ) -> Self:
        """Raises `AlertWindowError` or `AlertDayPastError` by name, not wrapped in a validation error.

        Today is allowed, and so is a window of a single instant (`until_time == from_time`).
        """
        if from_time is not None and until_time is not None and until_time < from_time:
            raise AlertWindowError
        if day < local_day(now, zone):
            raise AlertDayPastError
        return cls(
            id=uuid4(),
            owner_id=owner_id,
            text=None if text is None else text.strip() or None,
            day=day,
            from_time=from_time,
            until_time=until_time,
            created_at=now,
        )

    def is_active(self, now: datetime, zone: tzinfo) -> bool:
        """Active through 23:59 of its day in `zone`; inert from the next midnight (D-179)."""
        return local_day(now, zone) <= self.day
