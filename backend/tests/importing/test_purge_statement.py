"""The two purge adapters of D-119 apply one rule: the SQL of the pg_cron job and the use case agree.

Postgres only: the statement is the job's, written in Postgres SQL. Installing the job is not a
test: pg_cron only loads in the database it was configured for, never in pytest's copy, so
`manage.py install_purge_schedule` is proven by hand against the compose Postgres (infra/postgres).
"""

from datetime import UTC, datetime, timedelta

import pytest
from asgiref.sync import sync_to_async
from django.db import connection

from brazcar.importing.adapters.models import SourceMessageModel
from brazcar.importing.adapters.purge import retention_statement
from brazcar.importing.adapters.repository import DjangoSourceMessages
from brazcar.importing.application import PurgeSourceMessages
from tests.contracts.source_messages import fresh

from .fakes import FixedClock

RETENTION = timedelta(hours=24)
postgres_only = pytest.mark.skipif(connection.vendor != "postgresql", reason="the job's SQL is Postgres SQL")


def run_statement() -> int:
    with connection.cursor() as cursor:
        cursor.execute(retention_statement(RETENTION))
        return cursor.rowcount


@postgres_only
@pytest.mark.contract
@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
async def test_the_job_statement_forgets_exactly_what_the_use_case_would() -> None:
    now = datetime.now(tz=UTC)
    messages = DjangoSourceMessages()
    old, recent = fresh(received_at=now - timedelta(hours=25)), fresh(received_at=now - timedelta(hours=23))
    await messages.save(old)
    await messages.save(recent)

    assert await sync_to_async(run_statement)() == 1
    assert await PurgeSourceMessages(messages, FixedClock(now), RETENTION)() == 0
    assert await sync_to_async(run_statement)() == 0
    kept = await SourceMessageModel.objects.filter(
        message_id__in=[old.message_id, recent.message_id]
    ).acount()
    assert kept == 1
