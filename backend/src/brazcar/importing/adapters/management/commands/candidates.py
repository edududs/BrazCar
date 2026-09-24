"""`manage.py candidates`: what was judged and why, for a look over ssh (D-124)."""

from typing import override

from django.core.management.base import BaseCommand, CommandParser
from django.db.models import Count

from brazcar.importing.adapters.models import CandidateModel

PREVIEW = 50


class Command(BaseCommand):
    help = "Count candidates by verdict and show the latest ones with their outcome."

    @override
    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--last", type=int, default=15, help="how many recent candidates to show")
        parser.add_argument(
            "--verdict", default="", help="only this verdict: pending, accepted, rejected, failed"
        )

    @override
    def handle(self, *args: object, **options: object) -> None:
        last, verdict = options["last"], options["verdict"]
        assert isinstance(last, int)  # noqa: S101 - argparse hands the declared type back
        assert isinstance(verdict, str)  # noqa: S101 - same
        for row in CandidateModel.objects.values("verdict").annotate(n=Count("id")).order_by("verdict"):
            self.stdout.write(f"{row['verdict']}\t{row['n']}")
        rows = CandidateModel.objects.order_by("-first_seen_at")
        if verdict:
            rows = rows.filter(verdict=verdict)
        for candidate in rows[:last]:
            preview = " ".join(candidate.text.split())[:PREVIEW]
            when = f"{candidate.first_seen_at:%d/%m %H:%M}"
            outcome = _outcome(candidate)
            self.stdout.write(f"{when}\t{candidate.sources}x\t{candidate.verdict}\t{outcome}\t{preview}")


def _outcome(candidate: CandidateModel) -> str:
    match candidate.verdict:
        case "accepted":
            return f"ride {candidate.ride_id}{' joined' if candidate.joined else ''}"
        case "rejected":
            confidence = "" if candidate.confidence is None else f" {candidate.confidence}"
            return f"{candidate.reason}{confidence}"
        case "failed":
            return f"{candidate.attempts}x {candidate.error[:40]}"
        case _:
            return ""
