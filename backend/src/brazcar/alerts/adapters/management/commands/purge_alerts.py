"""`manage.py purge_alerts`: the cleanup of D-179, alerts whose day has passed and those of erased
accounts, with their notices. The `pg_cron` job that runs it on a schedule comes later."""

import asyncio
from typing import override

from django.core.management.base import BaseCommand

from brazcar.alerts.adapters.composition import purge_alerts


class Command(BaseCommand):
    help = "Delete the alerts whose day has passed, and those of erased accounts."

    @override
    def handle(self, *args: object, **options: object) -> None:
        purged = asyncio.run(purge_alerts()())
        self.stdout.write(f"{purged} alert(s) purged")
