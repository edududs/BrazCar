"""The rule that says whether the importing works (D-193): pure, a table of cases."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from brazcar.importing.domain import (
    Accepted,
    Failed,
    ImportingHealth,
    ImportingProblem,
    ImportingStatus,
    Pending,
    Rejected,
    RejectReason,
    Verdict,
    assess_importing,
)

NOW = datetime(2026, 11, 9, 12, 0, tzinfo=UTC)
STALE = timedelta(hours=8)
FAILED = Failed(error="ConnectError", attempts=1)
REJECTED = Rejected(reason=RejectReason.NO_TIME)
ACCEPTED = Accepted(ride_id=uuid4())
OK = ImportingHealth(status=ImportingStatus.OK)
PARSER = ImportingHealth(status=ImportingStatus.DEGRADED, reason=ImportingProblem.PARSER_FAILING)
SILENT = ImportingHealth(status=ImportingStatus.DEGRADED, reason=ImportingProblem.NO_RECENT_MESSAGES)
OFF = ImportingHealth(status=ImportingStatus.OFF)


@pytest.mark.parametrize(
    ("configured", "verdict", "received", "expected"),
    [
        (False, FAILED, None, OFF),
        (False, None, NOW, OFF),
        (True, None, NOW - timedelta(minutes=1), OK),
        (True, ACCEPTED, NOW - timedelta(hours=1), OK),
        (True, REJECTED, NOW - timedelta(hours=1), OK),
        (True, FAILED, NOW - timedelta(minutes=1), PARSER),
        (True, None, None, SILENT),
        (True, ACCEPTED, None, SILENT),
        (True, ACCEPTED, NOW - STALE, OK),  # exactly 8 h is still fine
        (True, ACCEPTED, NOW - STALE - timedelta(microseconds=1), SILENT),
        (True, ACCEPTED, NOW - timedelta(days=11), SILENT),
        (True, FAILED, NOW - timedelta(days=11), PARSER),  # both hold: the interpreter wins
        (True, FAILED, None, PARSER),
    ],
)
def test_assess_importing(
    *, configured: bool, verdict: Verdict | None, received: datetime | None, expected: ImportingHealth
) -> None:
    got = assess_importing(
        configured=configured, last_verdict=verdict, last_received_at=received, now=NOW, stale_after=STALE
    )

    assert got == expected


def test_a_pending_verdict_does_not_count_as_a_failure() -> None:
    got = assess_importing(configured=True, last_verdict=Pending(), last_received_at=NOW, now=NOW)

    assert got == OK


def test_the_default_window_is_eight_hours() -> None:
    inside = assess_importing(
        configured=True, last_verdict=None, last_received_at=NOW - timedelta(hours=8), now=NOW
    )
    outside = assess_importing(
        configured=True, last_verdict=None, last_received_at=NOW - timedelta(hours=9), now=NOW
    )

    assert (inside, outside) == (OK, SILENT)


@pytest.mark.parametrize("status", [ImportingStatus.OK, ImportingStatus.OFF])
def test_only_a_degraded_state_has_a_reason(status: ImportingStatus) -> None:
    with pytest.raises(ValueError, match="reason"):
        ImportingHealth(status=status, reason=ImportingProblem.PARSER_FAILING)
    with pytest.raises(ValueError, match="reason"):
        ImportingHealth(status=ImportingStatus.DEGRADED)
