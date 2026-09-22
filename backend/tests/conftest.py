import os
from collections.abc import AsyncIterator

import pytest
from asgiref.sync import sync_to_async
from django.db import connection, connections


def pytest_report_header() -> str:
    return f"database: {connection.vendor}"


def pytest_sessionstart() -> None:
    """A gate that means to prove a database says which; passing on another one is a failure."""
    expected = os.environ.get("EXPECT_DB_VENDOR")
    if expected and connection.vendor != expected:
        pytest.exit(
            f"EXPECT_DB_VENDOR={expected}, but DATABASE_URL selects {connection.vendor}", returncode=1
        )


@pytest.fixture
async def worker_thread_connections_closed() -> AsyncIterator[None]:
    """For tests that reach the database through `sync_to_async`.

    That work runs on a thread of its own, whose connection nobody else closes; left open, it
    blocks the teardown of the Postgres test database.
    """
    yield
    await sync_to_async(connections.close_all)()
