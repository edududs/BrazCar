"""`manage.py run_extractor`: the worker service (D-108). One process, one paired account."""

import asyncio
from typing import override

from django.core.exceptions import ImproperlyConfigured
from django.core.management.base import BaseCommand

from brazcar.importing.adapters.composition import (
    SWEEP_INTERVAL_SECONDS,
    extract,
    quiet_extractor_logs,
    sweep,
)
from brazcar.importing.adapters.config import ImportingSettings
from brazcar.importing.adapters.worker import run_worker


class Command(BaseCommand):
    help = "Read the watched WhatsApp groups into the source message table until stopped."

    @override
    def handle(self, *args: object, **options: object) -> None:
        config = ImportingSettings.from_django()
        if not config.groups:
            message = "WHATSAPP_GROUPS is empty: list them with `manage.py list_whatsapp_groups`"
            raise ImproperlyConfigured(message)
        quiet_extractor_logs()
        self.stdout.write(
            f"extractor: account {config.require_account()}, {len(config.groups)} group(s), "
            f"purge by {config.purge.value}"
        )
        asyncio.run(run_worker(extract(config), sweep(config), interval=SWEEP_INTERVAL_SECONDS))
