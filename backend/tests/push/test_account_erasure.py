"""Deleting an account through the real API forgets its devices and only its (D-184)."""

import pytest

from brazcar.push.adapters.models import PushSubscriptionModel
from tests.accounts.test_routes import FRONT

from .test_routes import BIA, put, signed_in, subscription

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.usefixtures("worker_thread_connections_closed"),
]


@pytest.fixture(autouse=True)
def _front_origin(settings: object) -> None:
    setattr(settings, "CORS_ALLOWED_ORIGINS", [FRONT])  # noqa: B010 - pytest-django's settings proxy


async def test_deleting_the_account_removes_its_devices_and_leaves_the_others() -> None:
    ana, bia = await signed_in(), await signed_in(**BIA)
    mine = [subscription(), subscription()]
    hers = subscription()
    for data in mine:
        await put(ana, data)
    await put(bia, hers)
    assert await PushSubscriptionModel.objects.acount() == 3

    deleted = await ana.delete("/api/accounts/me")

    assert deleted.status_code == 200
    assert [row.endpoint async for row in PushSubscriptionModel.objects.all()] == [hers["endpoint"]]
