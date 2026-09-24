"""`manage.py import_rides`: one sweep by hand (D-112), for a backlog or a look at what happens.

With `--rejudge`, what was judged since the start of a day (today by default) is read again first
(D-130): rejected candidates go back to pending, and the external rides of accepted ones leave the
board to be made again. Rides linked to an account are the driver's and are left alone.
"""

import asyncio
from datetime import date, datetime, time
from typing import override

from django.core.management.base import BaseCommand, CommandParser
from django.utils import timezone

from brazcar.importing.adapters.composition import import_use_cases
from brazcar.importing.adapters.config import ImportingSettings, PurgeMode
from brazcar.importing.domain import Accepted, Failed, Rejected


class Command(BaseCommand):
    help = "Take new messages into candidates, judge them, and purge (unless pg_cron does). One pass."

    @override
    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--limit", type=int, default=50, help="how many candidates to judge")
        parser.add_argument("--rejudge", action="store_true", help="read again what was judged since --since")
        parser.add_argument(
            "--since", type=date.fromisoformat, default=None, help="YYYY-MM-DD, default today"
        )

    @override
    def handle(self, *args: object, **options: object) -> None:
        limit, rejudge, since = options["limit"], options["rejudge"], options["since"]
        assert isinstance(limit, int)  # noqa: S101 - argparse hands the declared type back
        assert isinstance(rejudge, bool)  # noqa: S101 - same
        day = since if isinstance(since, date) else timezone.localdate()
        start = datetime.combine(day, time.min, tzinfo=timezone.get_current_timezone())
        asyncio.run(self._run(limit, start if rejudge else None))

    async def _run(self, limit: int, rejudge_since: datetime | None) -> None:
        config = ImportingSettings.from_django()
        use_cases = import_use_cases(config)
        if rejudge_since is not None:
            report = await use_cases.reopen(rejudge_since)
            self.stdout.write(
                f"rejudge since {rejudge_since:%d/%m %H:%M}: {report.reopened} candidate(s) reopened, "
                f"{report.rides_released} ride(s) taken off the board, {report.kept} kept (an account's)"
            )
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
