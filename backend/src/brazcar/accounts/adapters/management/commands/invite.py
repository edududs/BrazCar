"""`manage.py invite <phone>`: the owner's way to invite one phone while registration stays
closed (D-159, D-166). The link and the token appear once, in this output, and nowhere else -
never a log line, so a copy of the console never carries what the link itself already does.
"""

import asyncio
from datetime import datetime, timedelta
from typing import override

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.utils import timezone

from brazcar.accounts.adapters.composition import issue_invite
from brazcar.accounts.adapters.routes import PHONE_REFUSALS
from brazcar.accounts.domain import (
    ForeignPhoneNumberError,
    Invite,
    InvitePolicy,
    NotAMobilePhoneError,
    PhoneAlreadyRegisteredError,
)
from brazcar.shared.domain.phone import InvalidPhoneNumberError

DEFAULT_HOURS = int(InvitePolicy().lifetime.total_seconds() // 3600)


class Command(BaseCommand):
    help = "Issue an invite for one phone; issuing again supersedes the phone's earlier invite."

    @override
    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("phone", help="o celular convidado, com DDD")
        parser.add_argument("--hours", type=int, default=DEFAULT_HOURS, help="por quantas horas o link vale")

    @override
    def handle(self, *args: object, **options: object) -> None:
        phone, hours = options["phone"], options["hours"]
        assert isinstance(phone, str)  # noqa: S101 - argparse hands the declared types back
        assert isinstance(hours, int)  # noqa: S101
        if hours <= 0:
            message = "--hours precisa ser um número inteiro positivo"
            raise CommandError(message)
        policy = InvitePolicy(lifetime=timedelta(hours=hours))
        try:
            invite, token = asyncio.run(issue_invite(policy)(phone=phone))
        except PhoneAlreadyRegisteredError as error:
            message = "este telefone já tem conta"
            raise CommandError(message) from error
        except (InvalidPhoneNumberError, ForeignPhoneNumberError, NotAMobilePhoneError) as error:
            raise CommandError(PHONE_REFUSALS[type(error)]) from error
        self._announce(invite, token)

    def _announce(self, invite: Invite, token: str) -> None:
        """The link alone on its own line, easy to copy into whatever message the owner writes."""
        self.stdout.write(settings.INVITE_LINK.format(token=token))
        self.stdout.write(f"Vale até {_local(invite.expires_at)} (horário de Brasília).")


def _local(at: datetime) -> str:
    return timezone.localtime(at).strftime("%d/%m às %H:%M")
