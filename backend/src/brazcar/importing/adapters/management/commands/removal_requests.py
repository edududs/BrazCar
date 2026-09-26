"""`manage.py removal_requests`: the removal requests of the public page, for a read over ssh (D-172).

Pending ones by default, oldest first; `--all` adds the decided ones with their decision. The phone
is masked unless `--reveal`. The note is kept as written, so one that carries a phone, an e-mail or a
plate is flagged for whoever reads it (D-128, D-155). Decide with `approve_removal`.
"""

import asyncio
from datetime import datetime
from typing import override

from django.core.management.base import BaseCommand, CommandParser
from django.utils import timezone

from brazcar.importing.adapters.repository import DjangoRemovalRequests
from brazcar.importing.domain import Pending, RemovalRequest
from brazcar.shared.domain.personal_data import has_personal_data

PERSONAL_DATA_WARNING = "  ! the text carries a phone, an e-mail or a plate"


def _when(moment: datetime) -> str:
    """In the board's zone (D-094)."""
    return timezone.localtime(moment).strftime("%d/%m/%Y %H:%M")


class Command(BaseCommand):
    help = "List the removal requests still waiting for a decision, oldest first."

    @override
    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--all", action="store_true", help="include the decided ones")
        parser.add_argument("--reveal", action="store_true", help="show the whole phone")

    @override
    def handle(self, *args: object, **options: object) -> None:
        everything, reveal = options["all"], options["reveal"]
        assert isinstance(everything, bool)  # noqa: S101 - argparse hands the declared types back
        assert isinstance(reveal, bool)  # noqa: S101
        requests = DjangoRemovalRequests()
        found = asyncio.run(requests.all() if everything else requests.pending())
        for request in found:
            self._write(request, reveal=reveal)
        self.stdout.write(f"{len(found)} request(s){'' if everything else ' pending'}")

    def _write(self, request: RemovalRequest, *, reveal: bool) -> None:
        phone = request.phone.e164() if reveal else request.phone.masked()
        decision = request.decision
        state = "pending" if isinstance(decision, Pending) else f"{decision.kind} {_when(decision.at)}"
        self.stdout.write(f"{request.id}\t{_when(request.requested_at)}\t{phone}\t{state}")
        if request.note is not None:
            self.stdout.write(f"  {request.note}")
            if has_personal_data(request.note):
                self.stdout.write(PERSONAL_DATA_WARNING)
