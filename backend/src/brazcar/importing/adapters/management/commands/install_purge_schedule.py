"""`manage.py install_purge_schedule`: put the purge inside Postgres as a pg_cron job (D-119).

Run once per database, and again whenever the retention changes; the job is replaced by name.
"""

from typing import override

from django.core.management.base import BaseCommand, CommandError

from brazcar.importing.adapters.config import ImportingSettings
from brazcar.importing.adapters.purge import (
    EVERY_FIVE_MINUTES,
    JOB_NAME,
    install_schedule,
    pg_cron_available,
)


class Command(BaseCommand):
    help = "Schedule the source message purge as a pg_cron job in the application's database."

    @override
    def handle(self, *args: object, **options: object) -> None:
        if not pg_cron_available():
            message = "pg_cron is not available on this database; use IMPORT_PURGE=worker instead"
            raise CommandError(message)
        retention = ImportingSettings.from_django().raw_retention
        job_id = install_schedule(retention)
        self.stdout.write(f"{JOB_NAME}: job {job_id}, {EVERY_FIVE_MINUTES}, retention {retention}")
