"""`manage.py import_rides`: one sweep by hand (D-112), for a backlog or a look at what happens."""

import asyncio
from typing import override

from django.core.management.base import BaseCommand, CommandParser

from brazcar.importing.adapters.composition import import_use_cases
from brazcar.importing.adapters.config import ImportingSettings, PurgeMode
from brazcar.importing.domain import Accepted, Failed, Rejected


class Command(BaseCommand):
    help = "Take new messages into candidates, judge them, and purge (unless pg_cron does). One pass."

    @override
    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--limit", type=int, default=50, help="how many candidates to judge")

    @override
    def handle(self, *args: object, **options: object) -> None:
        limit = options["limit"]
        assert isinstance(limit, int)  # noqa: S101 - argparse hands the declared type back
        asyncio.run(self._run(limit))

    async def _run(self, limit: int) -> None:
        config = ImportingSettings.from_django()
        use_cases = import_use_cases(config)
        taken = await use_cases.ingest()
        self.stdout.write(f"{taken} message(s) taken into candidates")
        for judged in await use_cases.judge(limit=limit):
            candidate, verdict = judged.candidate, judged.candidate.verdict
            match verdict:
                case Accepted():
                    outcome = f"accepted, ride {verdict.ride_id}{' (joined)' if verdict.joined else ''}"
                case Rejected():
                    outcome = f"rejected: {verdict.reason.value} (confidence {verdict.confidence})"
                case Failed():
                    outcome = f"failed ({verdict.attempts}): {verdict.error}"
                case _:
                    outcome = "pending"
            self.stdout.write(f"{candidate.first_seen_at:%d/%m %H:%M}\t{candidate.sources}x\t{outcome}")
        if config.purge is PurgeMode.WORKER:
            report = await use_cases.purge()
            self.stdout.write(
                f"purged {report.rides} ride(s), {report.candidates} candidate(s), "
                f"{report.messages} message(s)"
            )
