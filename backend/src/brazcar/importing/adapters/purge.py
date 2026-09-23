"""The purge as a job inside Postgres (D-119): the same rule the worker's sweep applies, in SQL.

`pg_cron` runs the statement on its own, so nothing here executes it; this module only knows how
to write it and how to (re)install the job. The contract in `tests/importing` proves the statement
and the use case leave the table in the same state.
"""

from datetime import timedelta

from django.db import connection

JOB_NAME = "brazcar-importing-purge"
EVERY_FIVE_MINUTES = "*/5 * * * *"
TABLE = "importing_source_message"


def retention_statement(retention: timedelta) -> str:
    """`PurgeSourceMessages` in SQL: forget what was received longer than `retention` ago."""
    seconds = int(retention.total_seconds())
    return f"DELETE FROM {TABLE} WHERE received_at < now() - interval '{seconds} seconds'"  # noqa: S608 - the table name is a constant and the interval an int


def install_schedule(retention: timedelta, *, every: str = EVERY_FIVE_MINUTES) -> int:
    """Create or replace the job; `cron.schedule` with a name upserts. Returns the job id."""
    with connection.cursor() as cursor:
        cursor.execute("CREATE EXTENSION IF NOT EXISTS pg_cron")
        cursor.execute("SELECT cron.schedule(%s, %s, %s)", [JOB_NAME, every, retention_statement(retention)])
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
