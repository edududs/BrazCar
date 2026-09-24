"""The purge as a job inside Postgres (D-119): the same rule `PurgeImported` applies, in SQL.

`pg_cron` runs the statements on its own, so nothing here executes them; this module only knows
how to write them and how to (re)install the job. The contract in `tests/importing` proves the SQL
and the use case leave the tables in the same state. Four statements, in the use case's order:
the candidates of the external rides that left, with their messages; those rides, with their
stops, history and contact requests, and the board revision bumped when any went; the candidates
that made no ride and were judged a while ago, with their messages; and the messages nobody took.
"""

from datetime import timedelta

from django.db import connection

JOB_NAME = "brazcar-importing-purge"
EVERY_FIVE_MINUTES = "*/5 * * * *"


def purge_statements(*, retention: timedelta, tolerance: timedelta) -> tuple[str, ...]:
    """Django emulates `on_delete` in Python, so every dependent row is deleted here by hand."""
    keep = int(retention.total_seconds())
    leave = int(tolerance.total_seconds())
    # Only integers are interpolated, and the table names are constants: no user input gets here.
    departed = (
        "SELECT id FROM rides_ride WHERE driver_id IS NULL "
        f"AND departure_at < now() - interval '{leave} seconds'"
    )
    of_departed = f"SELECT id FROM importing_candidate WHERE ride_id IN ({departed})"
    stale = (
        "SELECT id FROM importing_candidate WHERE verdict <> 'accepted' "
        f"AND judged_at < now() - interval '{keep} seconds'"
    )
    forget_departed = (
        "WITH gone AS ("
        "DELETE FROM rides_ride WHERE driver_id IS NULL "
        f"AND departure_at < now() - interval '{leave} seconds' RETURNING id) "
        "UPDATE shared_board_revision SET revision = revision + 1 WHERE (SELECT count(*) FROM gone) > 0"
    )
    forget_untaken = (
        "DELETE FROM importing_source_message WHERE candidate_id IS NULL "
        f"AND received_at < now() - interval '{keep} seconds'"
    )
    return (
        f"DELETE FROM importing_source_message WHERE candidate_id IN ({of_departed})",
        f"DELETE FROM importing_candidate WHERE id IN ({of_departed})",
        f"DELETE FROM rides_contact_request WHERE ride_id IN ({departed})",
        f"DELETE FROM rides_event WHERE ride_id IN ({departed})",
        f"DELETE FROM rides_stop WHERE ride_id IN ({departed})",
        forget_departed,
        f"DELETE FROM importing_source_message WHERE candidate_id IN ({stale})",
        f"DELETE FROM importing_candidate WHERE id IN ({stale})",
        forget_untaken,
    )


def purge_command(*, retention: timedelta, tolerance: timedelta) -> str:
    """One command for the job: the statements in order, in one transaction."""
    return "; ".join(purge_statements(retention=retention, tolerance=tolerance))


def install_schedule(*, retention: timedelta, tolerance: timedelta, every: str = EVERY_FIVE_MINUTES) -> int:
    """Create or replace the job; `cron.schedule` with a name upserts. Returns the job id."""
    command = purge_command(retention=retention, tolerance=tolerance)
    with connection.cursor() as cursor:
        cursor.execute("CREATE EXTENSION IF NOT EXISTS pg_cron")
        cursor.execute("SELECT cron.schedule(%s, %s, %s)", [JOB_NAME, every, command])
        row = cursor.fetchone()
    if row is None:
        message = "cron.schedule returned no job id"
        raise RuntimeError(message)
    job_id: object = row[0]
    return int(str(job_id))


def pg_cron_available() -> bool:
    if connection.vendor != "postgresql":
        return False
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron'")
        return cursor.fetchone() is not None
