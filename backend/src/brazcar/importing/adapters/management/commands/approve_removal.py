"""`manage.py approve_removal <id>`: decide a removal request of the public page (D-172).

Approving blocks the phone and forgets its messages, candidates and external rides, as
`block_sender` does (D-119); `--refuse` records a refusal and removes nothing. Deciding again what
was decided the same way does nothing; the opposite decision is refused.
"""

import asyncio
from typing import override
from uuid import UUID

from django.core.management.base import BaseCommand, CommandError, CommandParser

from brazcar.importing.adapters.composition import removal_decisions
from brazcar.importing.adapters.config import ImportingSettings
from brazcar.importing.application import RemovalRequestNotFoundError
from brazcar.importing.domain import RemovalAlreadyDecidedError


class Command(BaseCommand):
    help = "Approve a removal request (block the phone, remove what was imported), or --refuse it."

    @override
    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("id", help="the request's id, as `removal_requests` lists it")
        parser.add_argument("--refuse", action="store_true", help="refuse instead: nothing is removed")

    @override
    def handle(self, *args: object, **options: object) -> None:
        raw, refuse = options["id"], options["refuse"]
        assert isinstance(raw, str)  # noqa: S101 - argparse hands the declared types back
        assert isinstance(refuse, bool)  # noqa: S101
        try:
            request_id = UUID(raw)
        except ValueError as error:
            message = f"not a request id: {raw}"
            raise CommandError(message) from error
        decisions = removal_decisions(ImportingSettings.from_django())
        try:
            if refuse:
                refused = asyncio.run(decisions.refuse(request_id))
                self.stdout.write("refused; nothing removed" if refused else "already refused; nothing to do")
                return
            report = asyncio.run(decisions.approve(request_id))
        except RemovalRequestNotFoundError as error:
            message = f"no removal request {request_id}"
            raise CommandError(message) from error
        except RemovalAlreadyDecidedError as error:
            message = f"the request was already {error.decision}; the first decision stands"
            raise CommandError(message) from error
        if report is None:
            self.stdout.write("already approved; nothing to do")
            return
        self.stdout.write(
            f"approved; the phone is blocked; removed {report.rides} ride(s), "
            f"{report.candidates} candidate(s), {report.messages} message(s)"
        )
