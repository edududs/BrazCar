"""The routes against the real composition: ninja, session, use cases, ORM, e-mail backend."""

import json
import re
from http import HTTPStatus
from typing import Any

import pytest
from django.core import mail
from django.http import HttpResponse
from django.test.client import AsyncClient

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.usefixtures("worker_thread_connections_closed"),
]

FRONT = "http://localhost:5173"
ANA = {
    "phone": "61 99999-0001",
    "password": "correct horse battery",
    "display_name": "Ana",
    "email": "ana@example.com",
    "accepts_terms": True,
}


class Browser:
    """A client that behaves like the front: sends its origin on every request, keeps cookies.

    Headers go per request: on Django 6.0 the `AsyncClient` constructor mangles them (`HTTP_HTTP_*`).
    """

    def __init__(self) -> None:
        self.client = AsyncClient()

    async def get(self, path: str, *, origin: str = FRONT) -> HttpResponse:
        return await self.client.get(path, headers={"Origin": origin})

    async def post(self, path: str, data: object = None, *, origin: str = FRONT) -> HttpResponse:
        return await self.client.post(path, data, content_type="application/json", headers={"Origin": origin})

    async def patch(self, path: str, data: object = None, *, origin: str = FRONT) -> HttpResponse:
        headers = {"Origin": origin}
        return await self.client.patch(path, data, content_type="application/json", headers=headers)

    async def delete(self, path: str, *, origin: str = FRONT) -> HttpResponse:
        return await self.client.delete(path, headers={"Origin": origin})


def browser() -> Browser:
    return Browser()


def body(response: HttpResponse) -> dict[str, Any]:
    """Loosely typed on purpose: the tests assert the shape."""
    return json.loads(response.content)


async def register(client: Browser, **overrides: object) -> dict[str, object]:
    response = await client.post("/api/accounts/register", {**ANA, **overrides})
    assert response.status_code == HTTPStatus.CREATED, response.content
    return body(response)


@pytest.fixture(autouse=True)
def _front_origin(settings: object) -> None:
    setattr(settings, "CORS_ALLOWED_ORIGINS", [FRONT])  # noqa: B010 - pytest-django's settings proxy


async def test_register_logs_in_and_shows_the_own_account_without_verification() -> None:
    client = browser()

    account = await register(client)
    me = await client.get("/api/accounts/me")

    assert account["phone"] == "+5561999990001"
    assert account["phone_display"] == "(61) 99999-0001"
    assert account["can_drive"] is False
    assert me.status_code == HTTPStatus.OK
    assert body(me) == account


async def test_register_needs_the_terms_and_a_decent_password() -> None:
    client = browser()

    refused = await client.post("/api/accounts/register", {**ANA, "accepts_terms": False})
    weak = await client.post("/api/accounts/register", {**ANA, "password": "1234"})

    assert refused.status_code == HTTPStatus.UNPROCESSABLE_CONTENT
    assert weak.status_code == HTTPStatus.UNPROCESSABLE_CONTENT


@pytest.mark.parametrize(
    ("phone", "message"),
    [
        ("61 9", "telefone inválido: digite o celular com DDD, como (61) 99999-9999"),
        ("+1 415 555 2671", "por enquanto só números do Brasil"),
        ("(61) 3333-4444", "use um número de celular: o contato é pelo WhatsApp"),
    ],
)
async def test_a_phone_that_cannot_own_an_account_is_refused_with_its_reason(
    phone: str, message: str
) -> None:
    """Before D-137 a malformed phone escaped as a validation error and answered 500."""
    refused = await browser().post("/api/accounts/register", {**ANA, "phone": phone})

    assert refused.status_code == HTTPStatus.UNPROCESSABLE_CONTENT
    assert body(refused) == {"detail": message}


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"display_name": "   "}, "nome social não pode ficar vazio"),
        ({"email": "not-an-email"}, "e-mail inválido"),
    ],
)
async def test_a_malformed_registration_is_refused_with_its_reason(
    overrides: dict[str, object], message: str
) -> None:
    """Before D-158 an empty display name or a malformed e-mail escaped `RegisterIn`, which leaves
    both unconstrained the same way `ProfileIn` does, and answered 500 once `Account.register`
    refused to build."""
    refused = await browser().post("/api/accounts/register", {**ANA, **overrides})

    assert refused.status_code == HTTPStatus.UNPROCESSABLE_CONTENT
    assert body(refused) == {"detail": message}


async def test_the_same_phone_cannot_register_twice() -> None:
    await register(browser())

    again = await browser().post("/api/accounts/register", {**ANA, "phone": "+55 (61) 99999-0001"})

    assert again.status_code == HTTPStatus.CONFLICT


async def test_login_logout_and_me_follow_the_session_cookie() -> None:
    await register(browser())
    client = browser()

    anonymous = await client.get("/api/accounts/me")
    wrong = await client.post("/api/accounts/login", {"phone": ANA["phone"], "password": "nope"})
    right = await client.post("/api/accounts/login", {"phone": ANA["phone"], "password": ANA["password"]})
    me = await client.get("/api/accounts/me")
    await client.post("/api/accounts/logout")
    after = await client.get("/api/accounts/me")

    assert anonymous.status_code == HTTPStatus.UNAUTHORIZED
    assert wrong.status_code == HTTPStatus.UNAUTHORIZED
    assert right.status_code == HTTPStatus.OK
    assert "brazcar_session" in right.cookies
    assert right.cookies["brazcar_session"]["httponly"]
    assert right.cookies["brazcar_session"]["samesite"] == "Lax"
    assert me.status_code == HTTPStatus.OK
    assert after.status_code == HTTPStatus.UNAUTHORIZED


async def test_a_state_change_from_an_unknown_origin_is_refused_even_with_the_cookie() -> None:
    client = browser()
    await register(client)

    foreign = await client.post(
        "/api/accounts/cars",
        {"model": "Gol", "color": "prata", "plate": "ABC1234"},
        origin="https://evil.example",
    )
    reading = await client.get("/api/accounts/me", origin="https://evil.example")

    assert foreign.status_code == HTTPStatus.FORBIDDEN
    assert reading.status_code == HTTPStatus.OK  # CORS keeps the answer from a foreign page anyway


async def test_cars_come_and_go_and_the_plate_stays_with_the_owner() -> None:
    client = browser()
    await register(client)

    added = await client.post("/api/accounts/cars", {"model": "Gol", "color": "prata", "plate": "abc-1234"})
    twice = await client.post("/api/accounts/cars", {"model": "Outro", "color": "azul", "plate": "ABC1234"})
    car = body(added)["cars"][0]
    removed = await client.delete(f"/api/accounts/cars/{car['id']}")
    gone = await client.delete(f"/api/accounts/cars/{car['id']}")

    assert body(added)["can_drive"] is True
    assert car["plate"] == "ABC1234"
    assert twice.status_code == HTTPStatus.CONFLICT
    assert body(removed)["cars"] == []
    assert gone.status_code == HTTPStatus.NOT_FOUND


@pytest.mark.parametrize(
    "overrides",
    [
        {"model": ""},
        {"color": ""},
        {"plate": ""},
        {"plate": "not a plate"},
    ],
)
async def test_a_malformed_car_is_refused_with_422_not_500(overrides: dict[str, object]) -> None:
    """Before D-158 `CarIn` left every field unconstrained, so a blank or malformed one reached
    `Car`'s own construction and answered 500 instead of a refusal (Schemathesis found it)."""
    client = browser()
    await register(client)

    refused = await client.post(
        "/api/accounts/cars", {"model": "Gol", "color": "prata", "plate": "ABC1234", **overrides}
    )

    assert refused.status_code == HTTPStatus.UNPROCESSABLE_CONTENT


async def test_password_reset_goes_by_email_and_the_link_works_once() -> None:
    await register(browser())
    client = browser()

    asked = await client.post("/api/accounts/password-reset", {"phone": ANA["phone"]})
    unknown = await client.post("/api/accounts/password-reset", {"phone": "61 99999-0009"})
    assert asked.status_code == unknown.status_code == HTTPStatus.OK
    assert len(mail.outbox) == 1
    match = re.search(r"token=([\w.-]+)", mail.outbox[0].body)
    assert match is not None
    token = match.group(1)

    changed = await client.post(
        "/api/accounts/password-reset/confirm",
        {"token": token, "password": "another good one"},
    )
    reused = await client.post(
        "/api/accounts/password-reset/confirm",
        {"token": token, "password": "third one"},
    )
    login = await client.post("/api/accounts/login", {"phone": ANA["phone"], "password": "another good one"})

    assert changed.status_code == HTTPStatus.OK
    assert reused.status_code == HTTPStatus.BAD_REQUEST
    assert login.status_code == HTTPStatus.OK


async def test_updating_the_profile_changes_only_what_is_sent() -> None:
    client = browser()
    await register(client)

    renamed = await client.patch("/api/accounts/me", {"display_name": "Ana Paula"})
    me = await client.get("/api/accounts/me")

    assert renamed.status_code == HTTPStatus.OK
    assert body(renamed)["display_name"] == "Ana Paula"
    assert body(renamed)["email"] == ANA["email"]  # untouched: it was absent from the body
    assert body(me) == body(renamed)


async def test_updating_the_profile_without_a_session_is_refused() -> None:
    refused = await browser().patch("/api/accounts/me", {"display_name": "Outro Nome"})

    assert refused.status_code == HTTPStatus.UNAUTHORIZED


async def test_a_blank_display_name_is_refused() -> None:
    client = browser()
    await register(client)

    refused = await client.patch("/api/accounts/me", {"display_name": "   "})

    assert refused.status_code == HTTPStatus.UNPROCESSABLE_CONTENT
    assert body(refused) == {"detail": "nome social não pode ficar vazio"}


async def test_an_invalid_email_is_refused() -> None:
    client = browser()
    await register(client)

    refused = await client.patch("/api/accounts/me", {"email": "not-an-email"})

    assert refused.status_code == HTTPStatus.UNPROCESSABLE_CONTENT
    assert body(refused) == {"detail": "e-mail inválido"}


async def test_a_blank_email_clears_it() -> None:
    client = browser()
    await register(client)

    cleared = await client.patch("/api/accounts/me", {"email": ""})

    assert cleared.status_code == HTTPStatus.OK
    assert body(cleared)["email"] is None


async def test_changing_the_password_needs_the_current_one_and_then_it_works() -> None:
    client = browser()
    await register(client)

    wrong = await client.post(
        "/api/accounts/me/password",
        {"current_password": "not it", "new_password": "another good one"},
    )
    weak = await client.post(
        "/api/accounts/me/password",
        {"current_password": ANA["password"], "new_password": "1234"},
    )
    changed = await client.post(
        "/api/accounts/me/password",
        {"current_password": ANA["password"], "new_password": "another good one"},
    )
    login = await client.post("/api/accounts/login", {"phone": ANA["phone"], "password": "another good one"})

    assert wrong.status_code == HTTPStatus.FORBIDDEN
    assert body(wrong) == {"detail": "senha atual não confere"}
    assert weak.status_code == HTTPStatus.UNPROCESSABLE_CONTENT
    assert changed.status_code == HTTPStatus.OK
    assert login.status_code == HTTPStatus.OK


async def test_changing_the_password_without_a_session_is_refused() -> None:
    refused = await browser().post(
        "/api/accounts/me/password",
        {"current_password": "whatever", "new_password": "another good one"},
    )

    assert refused.status_code == HTTPStatus.UNAUTHORIZED


async def test_changing_the_password_is_capped_like_a_login() -> None:
    """Ten wrong attempts (`AccountLimits.login_attempts`, D-097) exhaust the very bucket login uses."""
    client = browser()
    await register(client)

    for _ in range(10):
        await client.post(
            "/api/accounts/me/password",
            {"current_password": "not it", "new_password": "another good one"},
        )
    capped = await client.post(
        "/api/accounts/me/password",
        {"current_password": ANA["password"], "new_password": "another good one"},
    )

    assert capped.status_code == HTTPStatus.TOO_MANY_REQUESTS


async def test_deleting_the_account_erases_it_ends_the_session_and_frees_the_phone() -> None:
    client = browser()
    await register(client)

    deleted = await client.delete("/api/accounts/me")
    after = await client.get("/api/accounts/me")
    login = await client.post("/api/accounts/login", {"phone": ANA["phone"], "password": ANA["password"]})
    again = await client.post("/api/accounts/register", ANA)

    assert deleted.status_code == HTTPStatus.OK
    assert after.status_code == HTTPStatus.UNAUTHORIZED
    assert login.status_code == HTTPStatus.UNAUTHORIZED
    assert again.status_code == HTTPStatus.CREATED
