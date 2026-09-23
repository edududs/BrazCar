"""`manage.py pair_whatsapp`: link the phone once. neonize prints the QR code on this terminal.

The session lands in the database of WHATSAPP_SESSION_DSN (D-108); afterwards the phone goes
into WHATSAPP_ACCOUNT. Ctrl+C after the phone is linked still leaves a usable account.
"""

import asyncio
import contextlib
from typing import override

from django.core.management.base import BaseCommand, CommandError
from whatsapp_extractor import bootstrap

from brazcar.importing.adapters.composition import extractor_settings
from brazcar.importing.adapters.config import ImportingSettings


class Command(BaseCommand):
    help = "Pair a WhatsApp account by QR code; run once per account."

    @override
    def handle(self, *args: object, **options: object) -> None:
        settings = extractor_settings(ImportingSettings.from_django())
        pairing = bootstrap.Pairing(settings)
        self.stdout.write("scan the QR code with WhatsApp > Linked devices")
        with contextlib.suppress(KeyboardInterrupt):
            asyncio.run(pairing.run())
        account = pairing.account
        if account is None:
            message = "pairing did not complete"
            raise CommandError(message)
        self.stdout.write(f"paired {account.phone} ({account.name}); set WHATSAPP_ACCOUNT={account.phone}")
