"""`manage.py source_messages`: what the worker has stored, for a look over ssh (D-124)."""

from typing import override

from django.core.management.base import BaseCommand, CommandParser
from django.db.models import Count

from brazcar.importing.adapters.models import SourceMessageModel

PREVIEW = 60


class Command(BaseCommand):
    help = "Count the stored source messages by group and show the latest ones."

    @override
    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--last", type=int, default=10, help="how many recent messages to show")

    @override
    def handle(self, *args: object, **options: object) -> None:
        last = options["last"]
        assert isinstance(last, int)  # noqa: S101 - argparse hands the declared type back
        by_group = SourceMessageModel.objects.values("chat_jid").annotate(n=Count("id")).order_by("-n")
        total = 0
        for row in by_group:
            total += int(row["n"])
            self.stdout.write(f"{row['chat_jid']}\t{row['n']}")
        self.stdout.write(f"{total} message(s) in {len(by_group)} group(s)")
        for message in SourceMessageModel.objects.order_by("-received_at")[:last]:
            preview = " ".join(message.text.split())[:PREVIEW]
            self.stdout.write(f"{message.received_at:%d/%m %H:%M}\t{message.sender_name[:20]}\t{preview}")
