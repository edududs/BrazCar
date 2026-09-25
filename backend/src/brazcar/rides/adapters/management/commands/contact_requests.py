"""`manage.py contact_requests`: who saw whose number and when, for a look over ssh (D-124, D-140).

The base of the conversion metric and of scraping detection (an account that keeps hitting its
window shows up here, again and again). The tool and the automatic alert are for the admin panel
(ROADMAP); this command is what exists until then.
"""

import asyncio
from datetime import datetime, timedelta
from typing import override

from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.utils import timezone

from brazcar.accounts.adapters.repository import DjangoAccountRepository
from brazcar.rides.adapters.directories import AccountDriverDirectory
from brazcar.rides.adapters.repository import DjangoContactRequests
from brazcar.rides.application import ContactRequestRecord
from brazcar.shared.domain.phone import InvalidPhoneNumberError, PhoneNumber

DEFAULT_SINCE_HOURS = 24


class Command(BaseCommand):
    help = "List contact requests by account or by the phone they revealed, in a time window."

    @override
    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--account", default="", help="the requester's own phone")
        parser.add_argument("--phone", default="", help="the phone that was revealed")
        parser.add_argument(
            "--since", type=int, default=DEFAULT_SINCE_HOURS, help="how many hours back to look"
        )
        parser.add_argument("--reveal", action="store_true", help="show the phone unmasked")

    @override
    def handle(self, *args: object, **options: object) -> None:
        account_phone, seen_phone, since_hours, reveal = (
            options["account"],
            options["phone"],
            options["since"],
            options["reveal"],
        )
        assert isinstance(account_phone, str)  # noqa: S101 - argparse hands the declared types back
        assert isinstance(seen_phone, str)  # noqa: S101
        assert isinstance(since_hours, int)  # noqa: S101
        assert isinstance(reveal, bool)  # noqa: S101
        if bool(account_phone) == bool(seen_phone):
            message = "give exactly one of --account or --phone"
            raise CommandError(message)
        since = timezone.now() - timedelta(hours=since_hours)
        records = asyncio.run(_lookup(account_phone, seen_phone, since))
        for record in records:
            self._write(record, reveal=reveal)
        self.stdout.write(f"{len(records)} request(s) in the last {since_hours}h")

    def _write(self, record: ContactRequestRecord, *, reveal: bool) -> None:
        when = record.at.strftime("%d/%m %H:%M")
        ride = str(record.ride_id) if record.ride_id is not None else "carona apagada"
        phone = record.phone_revealed.e164() if reveal else record.phone_revealed.masked()
        self.stdout.write(f"{when}\t{record.requester_id}\t{ride}\t{record.driver_kind}\t{phone}")


async def _lookup(account_phone: str, seen_phone: str, since: datetime) -> tuple[ContactRequestRecord, ...]:
    contacts = DjangoContactRequests()
    if account_phone:
        driver = AccountDriverDirectory(DjangoAccountRepository())
        account = await driver.by_phone(_phone(account_phone))
        if account is None:
            message = f"no account with phone {account_phone}"
            raise CommandError(message)
        return await contacts.by_account(account.id, since=since)
    return await contacts.by_phone(_phone(seen_phone), since=since)


def _phone(raw: str) -> PhoneNumber:
    try:
        return PhoneNumber.parse(raw)
    except InvalidPhoneNumberError as error:
        message = f"{raw!r} is not a valid phone number"
        raise CommandError(message) from error
