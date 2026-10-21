"""Rules of an alert that the API translates (D-175)."""

from uuid import UUID


class AlertError(Exception):
    """Base of every alert rule the API translates."""


class AlertDayPastError(AlertError):
    """The day is before today, in the board's zone."""


class AlertWindowError(AlertError, ValueError):
    """`until_time` comes before `from_time`."""


class AlertLimitError(AlertError):
    """The account already holds as many active alerts as it may (D-175)."""

    def __init__(self, limit: int) -> None:
        super().__init__(f"an account holds at most {limit} active alerts")
        self.limit = limit


class AlertNotFoundError(AlertError):
    """No such alert for this account; also what another account's alert looks like (D-175)."""

    def __init__(self, alert_id: UUID) -> None:
        super().__init__(f"alert {alert_id} not found")
        self.alert_id = alert_id
