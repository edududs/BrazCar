"""Whether the importing is working, as a pure rule (D-193). No clock, no I/O: the caller hands in
what it read and the instant it read it."""

from datetime import datetime, timedelta
from enum import StrEnum
from typing import Self

from pydantic import model_validator

from brazcar.shared.domain.model import FrozenModel

from .candidate import Failed, Verdict

DEFAULT_STALE_AFTER = timedelta(hours=8)
"""No message received for longer than this and the groups look silent, or the listener is down."""


class ImportingStatus(StrEnum):
    OK = "ok"
    DEGRADED = "degraded"
    OFF = "off"  # not configured in this process: development, CI, e2e


class ImportingProblem(StrEnum):
    PARSER_FAILING = "parser_failing"  # the newest judgement failed: the interpreter is out
    NO_RECENT_MESSAGES = "no_recent_messages"  # nothing received within the staleness window


class ImportingHealth(FrozenModel):
    status: ImportingStatus
    reason: ImportingProblem | None = None

    @model_validator(mode="after")
    def _reason_only_when_degraded(self) -> Self:
        if (self.status is ImportingStatus.DEGRADED) != (self.reason is not None):
            message = "a degraded importing has a reason; the others have none"
            raise ValueError(message)
        return self


def assess_importing(
    *,
    configured: bool,
    last_verdict: Verdict | None,
    last_received_at: datetime | None,
    now: datetime,
    stale_after: timedelta = DEFAULT_STALE_AFTER,
) -> ImportingHealth:
    """`last_verdict` is the verdict of the most recently judged candidate, `None` when nothing was
    judged yet. One isolated failure heals by itself: the next good judgement replaces it as the
    latest. A failing interpreter wins over silence, since it is the cause that can be fixed."""
    if not configured:
        return ImportingHealth(status=ImportingStatus.OFF)
    if isinstance(last_verdict, Failed):
        return ImportingHealth(status=ImportingStatus.DEGRADED, reason=ImportingProblem.PARSER_FAILING)
    if last_received_at is None or now - last_received_at > stale_after:
        return ImportingHealth(status=ImportingStatus.DEGRADED, reason=ImportingProblem.NO_RECENT_MESSAGES)
    return ImportingHealth(status=ImportingStatus.OK)
