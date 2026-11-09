"""`GET /api/health/importing` against the real composition (D-193)."""

from datetime import UTC, datetime, timedelta
from http import HTTPStatus

import pytest
from django.test.client import AsyncClient

from brazcar.importing.adapters.repository import DjangoCandidates, DjangoSourceMessages
from brazcar.importing.domain import Candidate
from tests.contracts.importing_repositories import fresh, own_phone

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.usefixtures("worker_thread_connections_closed"),
]

ROUTE = "/api/health/importing"
GROUPS = "120363000000000001@g.us=Rota"


async def get() -> tuple[int, object]:
    response = await AsyncClient().get(ROUTE)
    return response.status_code, response.json()


async def test_off_when_no_group_is_configured(settings: object) -> None:
    setattr(settings, "WHATSAPP_GROUPS", "")  # noqa: B010 - pytest-django's settings proxy

    assert await get() == (HTTPStatus.OK, {"status": "off", "reason": None})


async def test_each_state_answers_200_with_only_status_and_reason(settings: object) -> None:
    setattr(settings, "WHATSAPP_GROUPS", GROUPS)  # noqa: B010
    assert await get() == (HTTPStatus.OK, {"status": "degraded", "reason": "no_recent_messages"})

    message = fresh(phone=own_phone(), received_at=datetime.now(UTC) - timedelta(hours=1))
    await DjangoSourceMessages().save(message)
    assert await get() == (HTTPStatus.OK, {"status": "ok", "reason": None})

    failed = Candidate.open(message, group_label="Rota").fail("ConnectError: down", at=datetime.now(UTC))
    await DjangoCandidates().save(failed, attaching=message)
    assert await get() == (HTTPStatus.OK, {"status": "degraded", "reason": "parser_failing"})
