"""The invite's routes against the real composition (D-167): ninja, session, use cases, ORM, the
e-mail backend (`locmem`) and the project's logging."""

import logging
import re
from datetime import timedelta
from http import HTTPStatus

import pytest
from django.core import mail
from django.utils import timezone

from brazcar.accounts.adapters.composition import issue_invite
from brazcar.accounts.adapters.invite_repository import DjangoInviteRepository
from brazcar.accounts.adapters.repository import DjangoAccountRepository
from brazcar.accounts.domain import Account, Invite, InvitePolicy, account_phone
from brazcar.config.log_filters import RedactSecretPaths

from .test_routes import FRONT, Browser, body

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.usefixtures("worker_thread_connections_closed"),
]

PHONE = "61 99999-0001"
EMAIL = "ana@example.com"
PASSWORD = "correct horse battery"
POLICY = InvitePolicy()


@pytest.fixture(autouse=True)
def _front_origin(settings: object) -> None:
    setattr(settings, "CORS_ALLOWED_ORIGINS", [FRONT])  # noqa: B010 - pytest-django's settings proxy


async def invited(phone: str = PHONE) -> str:
    _, token = await issue_invite()(phone=phone)
    return token


async def written(invite: Invite) -> None:
    await DjangoInviteRepository().save(invite)


async def existing(*, phone: str = "61 99999-0009", email: str | None = None) -> None:
    """An account that got in some other way: the seed, or before the invite."""
    account = Account.register(phone=phone, display_name="Bia", email=email, accepted_terms_at=timezone.now())
    await DjangoAccountRepository().save(account)


def last_email_token() -> str:
    match = re.search(r"cadastro\?token=([\w-]+)", mail.outbox[-1].body)
    assert match is not None
    return match.group(1)


async def emailed(client: Browser, token: str, email: str = EMAIL) -> str:
    response = await client.post(f"/api/accounts/invites/{token}/email", {"email": email})
    assert response.status_code == HTTPStatus.ACCEPTED, response.content
    return last_email_token()


def sign_up(email_token: str, display_name: str = "Ana") -> dict[str, object]:
    return {
        "email_token": email_token,
        "display_name": display_name,
        "password": PASSWORD,
        "accepts_terms": True,
    }


async def test_the_whole_way_from_the_invite_to_a_signed_in_account() -> None:
    client = Browser()
    token = await invited()

    opened = await client.get(f"/api/accounts/invites/{token}")
    given = await client.post(f"/api/accounts/invites/{token}/email", {"email": EMAIL})
    waiting = await client.get(f"/api/accounts/invites/{token}")
    (message,) = mail.outbox
    email_token = last_email_token()
    signup = await client.get(f"/api/accounts/signup/{email_token}")
    registered = await client.post("/api/accounts/register", sign_up(email_token))
    me = await client.get("/api/accounts/me")

    masked_phone = account_phone(PHONE).masked()
    assert opened.status_code == HTTPStatus.OK
    assert body(opened) == {
        "status": "open",
        "phone_masked": masked_phone,
        "expires_at": body(opened)["expires_at"],
        "email_masked": None,
    }
    assert "99999" not in masked_phone
    assert given.status_code == HTTPStatus.ACCEPTED
    assert message.to == [EMAIL]
    assert message.subject == "BrazCar: confirme seu e-mail"
    assert f"http://localhost:5173/cadastro?token={email_token}" in message.body
    assert body(waiting)["status"] == "awaiting_email_confirmation"
    assert body(waiting)["email_masked"] == "a***@example.com"
    assert signup.status_code == HTTPStatus.OK
    assert body(signup)["phone_masked"] == masked_phone
    assert body(signup)["email"] == EMAIL
    assert registered.status_code == HTTPStatus.CREATED
    assert me.status_code == HTTPStatus.OK
    assert body(me)["phone"] == "+5561999990001"
    assert body(me)["email"] == EMAIL
    assert body(me)["email_confirmed"] is True


async def test_unknown_tokens_are_404_everywhere() -> None:
    client = Browser()

    answers = [
        await client.get("/api/accounts/invites/nope"),
        await client.post("/api/accounts/invites/nope/email", {"email": EMAIL}),
        await client.get("/api/accounts/signup/nope"),
        await client.post("/api/accounts/register", sign_up("nope")),
    ]

    assert [answer.status_code for answer in answers] == [HTTPStatus.NOT_FOUND] * 4
    assert {body(answer)["detail"] for answer in answers} == {"convite não encontrado"}


async def test_an_expired_invite_is_410_with_its_own_words() -> None:
    long_ago = timezone.now() - POLICY.lifetime - timedelta(minutes=1)
    invite, token = Invite.issue(account_phone(PHONE), long_ago, POLICY)
    await written(invite)
    client = Browser()

    opened = await client.get(f"/api/accounts/invites/{token}")
    given = await client.post(f"/api/accounts/invites/{token}/email", {"email": EMAIL})

    words = {"detail": "este convite venceu; peça um novo a quem convidou você"}
    assert (opened.status_code, body(opened)) == (HTTPStatus.GONE, words)
    assert (given.status_code, body(given)) == (HTTPStatus.GONE, words)
    assert mail.outbox == []


async def test_a_lapsed_email_link_is_410_and_the_invite_reads_open_again() -> None:
    issued_at = timezone.now() - POLICY.email_link_lifetime - timedelta(minutes=5)
    invite, token = Invite.issue(account_phone(PHONE), issued_at, POLICY)
    waiting, email_token = invite.give_email(EMAIL, issued_at, POLICY)
    await written(waiting)
    client = Browser()

    signup = await client.get(f"/api/accounts/signup/{email_token}")
    registered = await client.post("/api/accounts/register", sign_up(email_token))
    opened = await client.get(f"/api/accounts/invites/{token}")

    words = {"detail": "este link venceu; abra o convite de novo e informe o e-mail"}
    assert (signup.status_code, body(signup)) == (HTTPStatus.GONE, words)
    assert (registered.status_code, body(registered)) == (HTTPStatus.GONE, words)
    assert body(opened)["status"] == "open"


async def test_a_superseded_invite_is_410_and_sends_no_email() -> None:
    client = Browser()
    first = await invited()
    first_email_token = await emailed(client, first)
    await invited()

    opened = await client.get(f"/api/accounts/invites/{first}")
    given = await client.post(f"/api/accounts/invites/{first}/email", {"email": EMAIL})
    signup = await client.get(f"/api/accounts/signup/{first_email_token}")
    registered = await client.post("/api/accounts/register", sign_up(first_email_token))

    words = {"detail": "este convite foi substituído por um convite mais novo"}
    for answer in (opened, given, signup, registered):
        assert (answer.status_code, body(answer)) == (HTTPStatus.GONE, words)
    assert len(mail.outbox) == 1


async def test_a_used_invite_is_410_on_its_pages_and_409_on_a_second_registration() -> None:
    client = Browser()
    token = await invited()
    email_token = await emailed(client, token)
    assert (
        await client.post("/api/accounts/register", sign_up(email_token))
    ).status_code == HTTPStatus.CREATED

    opened = await Browser().get(f"/api/accounts/invites/{token}")
    signup = await Browser().get(f"/api/accounts/signup/{email_token}")
    again = await Browser().post("/api/accounts/register", sign_up(email_token, "Outra"))

    words = {"detail": "este convite já foi usado"}
    assert (opened.status_code, body(opened)) == (HTTPStatus.GONE, words)
    assert (signup.status_code, body(signup)) == (HTTPStatus.GONE, words)
    assert (again.status_code, body(again)) == (HTTPStatus.CONFLICT, words)


async def test_a_phone_that_got_an_account_elsewhere_ends_the_invite() -> None:
    client = Browser()
    token = await invited()
    email_token = await emailed(client, token)
    await existing(phone=PHONE)

    opened = await client.get(f"/api/accounts/invites/{token}")
    given = await client.post(f"/api/accounts/invites/{token}/email", {"email": "outra@example.com"})
    signup = await client.get(f"/api/accounts/signup/{email_token}")
    registered = await client.post("/api/accounts/register", sign_up(email_token))

    words = {"detail": "este telefone já tem conta"}
    for answer in (opened, given, signup):
        assert (answer.status_code, body(answer)) == (HTTPStatus.GONE, words)
    assert (registered.status_code, body(registered)) == (HTTPStatus.CONFLICT, words)
    assert len(mail.outbox) == 1


async def test_an_email_that_has_an_account_is_409_on_the_step_and_on_the_registration() -> None:
    client = Browser()
    token = await invited()
    email_token = await emailed(client, token)
    await existing(email="Ana@Example.com")

    given = await client.post(f"/api/accounts/invites/{token}/email", {"email": "ANA@example.com"})
    registered = await client.post("/api/accounts/register", sign_up(email_token))

    words = {"detail": "este e-mail já tem conta"}
    assert (given.status_code, body(given)) == (HTTPStatus.CONFLICT, words)
    assert (registered.status_code, body(registered)) == (HTTPStatus.CONFLICT, words)


async def test_an_address_that_is_not_one_is_422() -> None:
    token = await invited()

    refused = await Browser().post(f"/api/accounts/invites/{token}/email", {"email": "not-an-email"})

    assert (refused.status_code, body(refused)) == (
        HTTPStatus.UNPROCESSABLE_CONTENT,
        {"detail": "e-mail inválido"},
    )


async def test_the_email_step_is_limited_per_invite() -> None:
    client = Browser()
    token = await invited()

    answers = [
        (
            await client.post(f"/api/accounts/invites/{token}/email", {"email": f"ana{n}@example.com"})
        ).status_code
        for n in range(6)
    ]

    assert answers == [HTTPStatus.ACCEPTED] * 5 + [HTTPStatus.TOO_MANY_REQUESTS]
    assert len(mail.outbox) == 5


async def test_no_log_record_carries_a_token(caplog: pytest.LogCaptureFixture) -> None:
    """Django's request log writes the path of every 4xx (`Not Found: /api/...`); the project's
    filter keeps the tokens in those paths out of it (D-167)."""
    caplog.set_level(logging.DEBUG)
    client = Browser()
    token = await invited()
    unknown = "desconhecido-" + token[::-1]
    email_token = await emailed(client, token)
    await client.get(f"/api/accounts/invites/{token}")
    await client.get(f"/api/accounts/invites/{unknown}")
    await client.post(f"/api/accounts/invites/{unknown}/email", {"email": EMAIL})
    await client.get(f"/api/accounts/signup/{email_token}")
    await client.get(f"/api/accounts/signup/{unknown}")
    await client.post("/api/accounts/register", sign_up(email_token))
    await client.get(f"/api/accounts/invites/{token}")  # used: 410
    await client.get(f"/api/accounts/signup/{email_token}")  # used: 410

    written_down = [f"{record.getMessage()} {record.args!r}" for record in caplog.records]
    assert not [line for line in written_down if any(t in line for t in (token, email_token, unknown))]
    assert any("/api/accounts/invites/[token]" in line for line in written_down)  # the log is there


def test_the_access_log_of_uvicorn_loses_the_token_too() -> None:
    record = logging.LogRecord(
        "uvicorn.access",
        logging.INFO,
        __file__,
        1,
        '%s - "%s %s HTTP/%s" %d',
        ("127.0.0.1:5000", "GET", "/api/accounts/signup/s3cr3t-t0k3n?x=1", "1.1", 200),
        None,
    )

    assert RedactSecretPaths().filter(record)
    assert record.getMessage() == '127.0.0.1:5000 - "GET /api/accounts/signup/[token]?x=1 HTTP/1.1" 200'
