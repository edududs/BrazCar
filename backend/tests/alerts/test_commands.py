"""`manage.py purge_alerts` against the real store."""

from datetime import timedelta
from io import StringIO
from uuid import uuid4

import pytest
from asgiref.sync import sync_to_async
from django.core.management import call_command
from django.utils import timezone

from brazcar.alerts.adapters.models import RideAlertModel
from brazcar.alerts.adapters.repository import DjangoAlertRepository
from brazcar.alerts.domain import RideAlert
from tests.alerts.test_alert_repository import register

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.usefixtures("worker_thread_connections_closed"),
]


async def test_the_command_deletes_the_days_that_passed_keeps_today_and_says_how_many() -> None:
    owner = await register()
    today = timezone.localdate()
    alerts = DjangoAlertRepository()
    for offset in (-2, -1, 0):
        await alerts.add(
            RideAlert(
                id=uuid4(),
                owner_id=owner,
                text=None,
                day=today + timedelta(days=offset),
                from_time=None,
                until_time=None,
                created_at=timezone.now(),
            )
        )
    out = StringIO()

    await sync_to_async(call_command, thread_sensitive=False)("purge_alerts", stdout=out)

    assert out.getvalue().strip() == "2 alert(s) purged"
    (kept,) = [row.day async for row in RideAlertModel.objects.all()]
    assert kept == today
