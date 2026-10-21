"""The routes against the real composition: ninja, session, use cases, ORM."""

from http import HTTPStatus
from uuid import uuid4

import pytest
from django.http import HttpResponse

from brazcar.push.adapters.models import PushSubscriptionModel
from brazcar.push.adapters.web_push import VapidKeys, generate_vapid_keys
from tests.accounts.signup import PASSWORD, legacy_account
from tests.accounts.test_routes import FRONT, Browser, body, register

from .fakes import FCM, new_auth, new_p256dh

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.usefixtures("worker_thread_connections_closed"),
]

BIA = {"phone": "61 99999-0002", "email": "bia@example.com", "display_name": "Bia"}
KEY_MESSAGE = "as notificações não estão disponíveis no momento"


@pytest.fixture(autouse=True)
def _front_origin(settings: object) -> None:
    setattr(settings, "CORS_ALLOWED_ORIGINS", [FRONT])  # noqa: B010 - pytest-django's settings proxy


def subscription(address: str | None = None, **extra: object) -> dict[str, object]:
    return {
        "endpoint": address or f"{FCM}{uuid4().hex}",
        "keys": {"p256dh": new_p256dh(), "auth": new_auth()},
        **extra,
    }


async def put(client: Browser, data: object) -> HttpResponse:
    return await client.client.put(
        "/api/push/subscriptions", data, content_type="application/json", headers={"Origin": FRONT}
    )


async def remove(client: Browser, endpoint: str) -> HttpResponse:
    return await client.client.delete(
        "/api/push/subscriptions",
        {"endpoint": endpoint},
        content_type="application/json",
        headers={"Origin": FRONT},
    )


async def signed_in(**overrides: str) -> Browser:
    client = Browser()
    await register(client, **overrides)
    return client


async def held() -> Browser:
    await legacy_account(phone="61 99999-0005")
    client = Browser()
    await client.post("/api/accounts/login", {"phone": "61 99999-0005", "password": PASSWORD})
    return client


async def test_every_route_refuses_without_a_session() -> None:
    anonymous = Browser()

    key = await anonymous.get("/api/push/public-key")
    saved = await put(anonymous, subscription())
    deleted = await remove(anonymous, f"{FCM}x")

    assert [key.status_code, saved.status_code, deleted.status_code] == [HTTPStatus.UNAUTHORIZED] * 3
    assert await PushSubscriptionModel.objects.acount() == 0


async def test_the_public_key_is_unavailable_while_push_is_off(settings: object) -> None:
    setattr(settings, "PUSH_VAPID", None)  # noqa: B010 - pytest-django's settings proxy
    client = await signed_in()

    response = await client.get("/api/push/public-key")

    assert response.status_code == HTTPStatus.SERVICE_UNAVAILABLE
    assert body(response) == {"detail": KEY_MESSAGE}


async def test_the_public_key_is_served_while_push_is_on(settings: object) -> None:
    public, private = generate_vapid_keys()
    setattr(settings, "PUSH_VAPID", VapidKeys(public, private, "mailto:ops@example.com"))  # noqa: B010
    client = await signed_in()

    response = await client.get("/api/push/public-key")

    assert response.status_code == HTTPStatus.OK
    assert body(response) == {"public_key": public}


async def test_a_subscription_is_kept_and_its_endpoint_comes_back_extra_fields_ignored() -> None:
    client = await signed_in()
    data = subscription(expirationTime=None)

    response = await put(client, data)

    assert response.status_code == HTTPStatus.OK
    assert body(response) == {"endpoint": data["endpoint"]}
    assert await PushSubscriptionModel.objects.filter(endpoint=data["endpoint"]).acount() == 1


async def test_the_same_endpoint_under_another_account_passes_to_it() -> None:
    ana, bia = await signed_in(), await signed_in(**BIA)
    data = subscription()
    await put(ana, data)
    owner_before = (await PushSubscriptionModel.objects.aget(endpoint=data["endpoint"])).owner_id

    response = await put(bia, data)

    row = await PushSubscriptionModel.objects.aget(endpoint=data["endpoint"])
    assert response.status_code == HTTPStatus.OK
    assert row.owner_id != owner_before
    assert await PushSubscriptionModel.objects.acount() == 1


@pytest.mark.parametrize(
    "data",
    [
        {**subscription(), "endpoint": "https://evil.example.com/push"},
        {**subscription(), "keys": {"p256dh": "AAAA", "auth": new_auth()}},
    ],
    ids=["unknown service", "bad p256dh"],
)
async def test_an_invalid_subscription_is_refused_with_422(data: dict[str, object]) -> None:
    client = await signed_in()

    response = await put(client, data)

    assert response.status_code == HTTPStatus.UNPROCESSABLE_CONTENT
    assert body(response) == {"detail": "inscrição de notificação inválida"}
    assert await PushSubscriptionModel.objects.acount() == 0


async def test_a_held_account_neither_saves_nor_deletes() -> None:
    client = await held()

    saved = await put(client, subscription())
    deleted = await remove(client, f"{FCM}x")

    assert saved.status_code == HTTPStatus.FORBIDDEN
    assert deleted.status_code == HTTPStatus.FORBIDDEN
    assert await PushSubscriptionModel.objects.acount() == 0


async def test_deleting_the_own_device_answers_204_and_removes_it() -> None:
    client = await signed_in()
    data = subscription()
    await put(client, data)

    response = await remove(client, str(data["endpoint"]))

    assert response.status_code == HTTPStatus.NO_CONTENT
    assert await PushSubscriptionModel.objects.acount() == 0


async def test_deleting_a_device_of_another_account_answers_204_and_keeps_it() -> None:
    ana, bia = await signed_in(), await signed_in(**BIA)
    data = subscription()
    await put(ana, data)

    foreign = await remove(bia, str(data["endpoint"]))
    unknown = await remove(bia, f"{FCM}{uuid4().hex}")

    assert [foreign.status_code, unknown.status_code] == [HTTPStatus.NO_CONTENT] * 2
    assert await PushSubscriptionModel.objects.acount() == 1
