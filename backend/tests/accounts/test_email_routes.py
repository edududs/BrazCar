"""The hold on an account without a confirmed e-mail, and the e-mail's change by link (D-168),
against the real composition: ninja, session, use cases, ORM, the e-mail backend (`locmem`)."""

import logging
import re
from datetime import timedelta
from http import HTTPStatus
from uuid import uuid4

import pytest
from django.core import mail
from django.http import HttpResponse
from django.utils import timezone

from brazcar.accounts.adapters.credentials import DjangoEmailConfirmationTokens
from brazcar.accounts.domain import EmailConfirmation

from .signup import PASSWORD, legacy_account
from .test_routes import ANA, FRONT, Browser, body, register

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.usefixtures("worker_thread_connections_closed"),
]

OLD_PHONE = "61 99999-0005"
HELD = {"detail": "confirme seu e-mail para continuar", "required_action": "confirm_email"}
SOME_ID = uuid4()
WRITES: list[tuple[str, str, object]] = [
    ("post", "/api/accounts/cars", {"model": "Gol", "color": "prata", "plate": "ABC1234"}),
    ("delete", f"/api/accounts/cars/{SOME_ID}", None),
    ("patch", "/api/accounts/me", {"display_name": "Outro Nome"}),
    ("post", "/api/accounts/me/password", {"current_password": PASSWORD, "new_password": "another good one"}),
    ("post", "/api/rides", {}),
    ("patch", f"/api/rides/{SOME_ID}", {}),
    ("post", f"/api/rides/{SOME_ID}/seats", {"seats_available": 2}),
    ("post", f"/api/rides/{SOME_ID}/cancel", None),
    ("post", f"/api/rides/{SOME_ID}/repeat", {}),
    ("post", f"/api/rides/{SOME_ID}/contact", None),
    ("post", "/api/feedback", {"kind": "suggestion", "message": "Uma ideia.", "web_version": "0.22.0"}),
]
"""Every route that changes state with a session, except the way out of the hold."""


@pytest.fixture(autouse=True)
def _front_origin(settings: object) -> None:
    setattr(settings, "CORS_ALLOWED_ORIGINS", [FRONT])  # noqa: B010 - pytest-django's settings proxy


async def held(email: str | None = None) -> Browser:
    """An account from before the invite, signed in: held until it confirms an e-mail."""
    await legacy_account(phone=OLD_PHONE, email=email)
    client = Browser()
    signed_in = await client.post("/api/accounts/login", {"phone": OLD_PHONE, "password": PASSWORD})
    assert signed_in.status_code == HTTPStatus.OK, signed_in.content
    return client


async def call(client: Browser, verb: str, path: str, data: object) -> HttpResponse:
    if verb == "post":
        return await client.post(path, data)
    if verb == "patch":
        return await client.patch(path, data)
    return await client.delete(path)


def last_confirm_token() -> str:
    match = re.search(r"confirmar-email\?token=(\S+)", mail.outbox[-1].body)
    assert match is not None
    return match.group(1)


async def emailed(client: Browser, email: str = "antiga@example.com") -> str:
    asked = await client.post("/api/accounts/me/email", {"email": email})
    assert asked.status_code == HTTPStatus.ACCEPTED, asked.content
    return last_confirm_token()


@pytest.mark.parametrize("email", [None, "nunca-confirmado@example.com"], ids=["without", "unconfirmed"])
async def test_the_account_tells_the_front_what_it_must_do(email: str | None) -> None:
    client = await held(email)

    me = body(await client.get("/api/accounts/me"))

    assert me["required_action"] == "confirm_email"
    assert me["email_confirmed"] is False


async def test_a_confirmed_account_has_nothing_required() -> None:
    assert (await register(Browser()))["required_action"] is None


@pytest.mark.parametrize(("verb", "path", "data"), WRITES, ids=[f"{v} {p}" for v, p, _ in WRITES])
async def test_a_held_account_is_refused_every_write_with_what_to_do(
    verb: str, path: str, data: object
) -> None:
    client = await held()

    refused = await call(client, verb, path, data)

    assert (refused.status_code, body(refused)) == (HTTPStatus.FORBIDDEN, HELD)


async def test_a_held_account_still_reads_logs_out_recovers_and_deletes() -> None:
    client = await held("antiga@example.com")

    me = await client.get("/api/accounts/me")
    board = await client.get("/api/rides/mine")
    reset = await client.post("/api/accounts/password-reset", {"phone": OLD_PHONE})
    reset_confirm = await client.post(
        "/api/accounts/password-reset/confirm", {"token": "nope", "password": "another good one"}
    )
    out = await client.post("/api/accounts/logout")
    again = await client.post("/api/accounts/login", {"phone": OLD_PHONE, "password": PASSWORD})
    deleted = await client.delete("/api/accounts/me")

    assert me.status_code == HTTPStatus.OK
    assert board.status_code == HTTPStatus.OK
    assert reset.status_code == HTTPStatus.OK
    assert reset_confirm.status_code == HTTPStatus.BAD_REQUEST
    assert out.status_code == HTTPStatus.OK
    assert again.status_code == HTTPStatus.OK
    assert deleted.status_code == HTTPStatus.OK


async def test_a_held_account_gets_out_through_the_email_routes() -> None:
    client = await held()

    token = await emailed(client)
    wrong = await client.post("/api/accounts/me/email/confirm", {"token": "nope"})
    confirmed = await client.post("/api/accounts/me/email/confirm", {"token": token})
    car = await client.post("/api/accounts/cars", {"model": "Gol", "color": "prata", "plate": "ABC1234"})

    assert (wrong.status_code, body(wrong)) == (
        HTTPStatus.BAD_REQUEST,
        {"detail": "link inválido ou vencido"},
    )
    assert confirmed.status_code == HTTPStatus.OK
    assert body(confirmed)["email"] == "antiga@example.com"
    assert body(confirmed)["email_confirmed"] is True
    assert body(confirmed)["required_action"] is None
    assert car.status_code == HTTPStatus.OK


async def test_changing_a_confirmed_email_keeps_the_old_one_until_the_link_is_opened() -> None:
    client = Browser()
    await register(client)

    token = await emailed(client, "nova@example.com")
    before = body(await client.get("/api/accounts/me"))
    confirmed = body(await client.post("/api/accounts/me/email/confirm", {"token": token}))

    assert mail.outbox[-1].to == ["nova@example.com"]
    assert before["email"] == ANA["email"]
    assert before["required_action"] is None  # asking for a change never holds the account
    assert confirmed["email"] == "nova@example.com"


async def test_the_link_works_once() -> None:
    client = await held()
    token = await emailed(client)

    first = await client.post("/api/accounts/me/email/confirm", {"token": token})
    second = await client.post("/api/accounts/me/email/confirm", {"token": token})

    assert first.status_code == HTTPStatus.OK
    assert second.status_code == HTTPStatus.BAD_REQUEST


async def test_the_link_of_another_account_is_refused() -> None:
    client = await held()
    token = await emailed(client)
    other = Browser()
    await register(other)

    refused = await other.post("/api/accounts/me/email/confirm", {"token": token})

    assert (refused.status_code, body(refused)) == (
        HTTPStatus.BAD_REQUEST,
        {"detail": "link inválido ou vencido"},
    )


async def test_a_lapsed_or_tampered_link_is_refused() -> None:
    account = await legacy_account(phone="61 99999-0006")
    client = Browser()
    await client.post("/api/accounts/login", {"phone": "61 99999-0006", "password": PASSWORD})
    lapsed = EmailConfirmation(
        account_id=account.id,
        email="antiga@example.com",
        expires_at=timezone.now() - timedelta(seconds=1),
        previous_confirmation=None,
    )
    good = lapsed.evolve(expires_at=timezone.now() + timedelta(hours=2))
    tokens = DjangoEmailConfirmationTokens()
    signed = await tokens.issue(good)
    presented = (
        await tokens.issue(lapsed),
        signed[:-3] + ("xyz" if not signed.endswith("xyz") else "abc"),  # the signature no longer matches
        await DjangoEmailConfirmationTokens(salt="another.purpose").issue(good),  # signed for something else
    )

    answers = [
        (await client.post("/api/accounts/me/email/confirm", {"token": token})).status_code
        for token in presented
    ]

    assert answers == [HTTPStatus.BAD_REQUEST] * 3
    assert (
        await client.post("/api/accounts/me/email/confirm", {"token": signed})
    ).status_code == HTTPStatus.OK


async def test_the_confirmation_needs_a_session() -> None:
    client = await held()
    token = await emailed(client)

    refused = await Browser().post("/api/accounts/me/email/confirm", {"token": token})

    assert refused.status_code == HTTPStatus.UNAUTHORIZED


async def test_an_email_of_another_account_is_409_on_asking_and_on_confirming() -> None:
    client = await held()
    token = await emailed(client, "ana@example.com")
    await register(Browser())  # Ana signs up with that very address after the link went out

    asked = await client.post("/api/accounts/me/email", {"email": "ANA@example.com"})
    confirmed = await client.post("/api/accounts/me/email/confirm", {"token": token})

    assert (asked.status_code, body(asked)) == (HTTPStatus.CONFLICT, {"detail": "este e-mail já tem conta"})
    assert (confirmed.status_code, body(confirmed)) == (
        HTTPStatus.CONFLICT,
        {"detail": "este e-mail já tem conta"},
    )


async def test_an_address_that_is_not_one_is_422() -> None:
    client = await held()

    refused = await client.post("/api/accounts/me/email", {"email": "not-an-email"})

    assert (refused.status_code, body(refused)) == (
        HTTPStatus.UNPROCESSABLE_CONTENT,
        {"detail": "e-mail inválido"},
    )
    assert mail.outbox == []


async def test_asking_is_limited_per_account() -> None:
    """Five an hour (`AccountLimits.email_change_requests`)."""
    client = await held()

    answers = [
        (await client.post("/api/accounts/me/email", {"email": f"n{n}@example.com"})).status_code
        for n in range(6)
    ]

    assert answers == [HTTPStatus.ACCEPTED] * 5 + [HTTPStatus.TOO_MANY_REQUESTS]
    assert len(mail.outbox) == 5


async def test_asking_needs_a_session() -> None:
    refused = await Browser().post("/api/accounts/me/email", {"email": "ana@example.com"})

    assert refused.status_code == HTTPStatus.UNAUTHORIZED


async def test_the_profile_no_longer_touches_the_email() -> None:
    client = Browser()
    await register(client)

    changed = await client.patch("/api/accounts/me", {"display_name": "Ana Paula", "email": ""})

    assert changed.status_code == HTTPStatus.OK
    assert body(changed)["email"] == ANA["email"]
    assert body(changed)["email_confirmed"] is True


async def test_no_log_record_carries_the_links_token(caplog: pytest.LogCaptureFixture) -> None:
    """The token goes in the body, never in the path the request log writes down."""
    caplog.set_level(logging.DEBUG)
    client = await held()
    token = await emailed(client)
    await client.post("/api/accounts/me/email/confirm", {"token": token + "x"})  # 400: a log line
    await Browser().post("/api/accounts/me/email/confirm", {"token": token})  # 401: another one
    await client.post("/api/accounts/me/email/confirm", {"token": token})

    written_down = [f"{record.getMessage()} {record.args!r}" for record in caplog.records]
    assert not [line for line in written_down if token in line]
    assert any("/api/accounts/me/email/confirm" in line for line in written_down)  # the log is there
