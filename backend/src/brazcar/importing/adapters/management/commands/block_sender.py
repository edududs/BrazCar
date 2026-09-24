"""`manage.py block_sender <phone>`: someone asked to be left out (D-119). Everything of theirs goes."""

import asyncio
from typing import override

from django.core.management.base import BaseCommand, CommandError, CommandParser

from brazcar.importing.adapters.composition import import_use_cases
from brazcar.importing.adapters.config import ImportingSettings


class Command(BaseCommand):
    help = "Block a WhatsApp phone (digits, no +) and delete its messages, candidates and rides."

    @override
    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("phone", help="digits only, country code first: 5561999990000")

    @override
    def handle(self, *args: object, **options: object) -> None:
        phone = options["phone"]
        assert isinstance(phone, str)  # noqa: S101 - argparse hands the declared type back
        if not phone.isdigit():
            message = "the phone is digits only, country code first, no +"
            raise CommandError(message)
        report = asyncio.run(import_use_cases(ImportingSettings.from_django()).block(phone))
        self.stdout.write(
            f"blocked; removed {report.rides} ride(s), {report.candidates} candidate(s), "
            f"{report.messages} message(s)"
        )
