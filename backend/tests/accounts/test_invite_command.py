import logging
from datetime import timedelta
from io import StringIO
from urllib.parse import parse_qs, urlparse

import pytest
from asgiref.sync import sync_to_async
from django.core.management import CommandError, call_command
from django.utils import timezone

from brazcar.accounts.adapters.invite_repository import DjangoInviteRepository
from brazcar.accounts.adapters.repository import DjangoAccountRepository
from brazcar.accounts.domain import Account, Invite, InviteStatus

PHONE = "+5561999990001"
LANDLINE = "+556132540000"  # a valid Brazilian number, but not a mobile: the contact is WhatsApp only
ACCOUNT_PHONE = "+5561999990002"


async def _run(*args: str) -> list[str]:
    out = StringIO()
    # The command opens a loop of its own, so it may not share this one's single thread executor.
    await sync_to_async(call_command, thread_sensitive=False)("invite", *args, stdout=out)
    return out.getvalue().splitlines()


def _token_from(lines: list[str]) -> str:
    return parse_qs(urlparse(lines[0]).query)["token"][0]


async def _invite(lines: list[str]) -> Invite:
    invite = await DjangoInviteRepository().by_invite_token(_token_from(lines))
    assert invite is not None
    return invite


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
class TestInviteCommand:
    async def test_the_first_line_is_only_the_link_and_the_second_only_the_deadline(self) -> None:
        lines = await _run(PHONE)

        invite = await _invite(lines)
        assert invite.phone.e164() == PHONE
        assert lines[0] == f"http://localhost:5173/convite?token={_token_from(lines)}"
        expires = timezone.localtime(invite.expires_at).strftime("%d/%m às %H:%M")
        assert lines[1] == f"Vale até {expires} (horário de Brasília)."

    async def test_hours_sets_the_lifetime(self) -> None:
        lines = await _run(PHONE, "--hours", "1")

        invite = await _invite(lines)
        assert invite.expires_at - invite.issued_at == timedelta(hours=1)

    async def test_zero_hours_refuses(self) -> None:
        with pytest.raises(CommandError, match="positivo"):
            await _run(PHONE, "--hours", "0")

    async def test_a_phone_with_an_account_refuses(self) -> None:
        account = Account.register(
            phone=ACCOUNT_PHONE,
            display_name="Já tem conta",
            email=None,
            accepted_terms_at=timezone.now(),
        )
        await DjangoAccountRepository().save(account)

        with pytest.raises(CommandError, match="já tem conta"):
            await _run(ACCOUNT_PHONE)

    async def test_a_landline_refuses(self) -> None:
        with pytest.raises(CommandError):
            await _run(LANDLINE)

    async def test_garbage_refuses(self) -> None:
        with pytest.raises(CommandError):
            await _run("not-a-phone")

    async def test_reissuing_supersedes_the_first_invite(self) -> None:
        first_lines = await _run(PHONE)
        second_lines = await _run(PHONE)

        repository = DjangoInviteRepository()
        first, second = await _invite(first_lines), await _invite(second_lines)
        assert first.id != second.id
        assert await repository.latest_for(first.phone) == second

        now = timezone.now()
        assert first.status(now, latest=False) is InviteStatus.SUPERSEDED
        assert second.status(now, latest=True) is InviteStatus.OPEN

    async def test_no_log_record_carries_the_token(self, caplog: pytest.LogCaptureFixture) -> None:
        with caplog.at_level(logging.DEBUG):
            lines = await _run(PHONE)

        token = _token_from(lines)
        assert all(token not in record.getMessage() for record in caplog.records)
