"""`manage.py feedback`: the opinions sent from the account screen, for a read over ssh (D-155).

Nothing shows them in the app: no reply goes back to the person, and whoever a complaint names is
never told. The phone a complaint names is masked unless `--reveal`. The text is kept as written,
so a line that carries a phone, an e-mail or a plate is flagged for whoever reads it.
"""

import asyncio
from datetime import timedelta
from typing import override

from django.core.management.base import BaseCommand, CommandParser
from django.utils import timezone

from brazcar.feedback.adapters.repository import DjangoFeedbackBox
from brazcar.feedback.application import ReadFeedback
from brazcar.feedback.domain import Feedback
from brazcar.shared.domain.personal_data import has_personal_data

DEFAULT_SINCE_HOURS = 24 * 7  # read "from time to time": a week by default
PERSONAL_DATA_WARNING = "  ! the text carries a phone, an e-mail or a plate"


class Command(BaseCommand):
    help = "List the opinions sent about the app in a time window, oldest first."

    @override
    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--since", type=int, default=DEFAULT_SINCE_HOURS, help="how many hours back to look"
        )
        parser.add_argument("--reveal", action="store_true", help="show the phone a complaint names")

    @override
    def handle(self, *args: object, **options: object) -> None:
        since_hours, reveal = options["since"], options["reveal"]
        assert isinstance(since_hours, int)  # noqa: S101 - argparse hands the declared types back
        assert isinstance(reveal, bool)  # noqa: S101
        since = timezone.now() - timedelta(hours=since_hours)
        opinions = asyncio.run(ReadFeedback(DjangoFeedbackBox())(since))
        for feedback in opinions:
            self._write(feedback, reveal=reveal)
        self.stdout.write(f"{len(opinions)} opinion(s) in the last {since_hours}h")

    def _write(self, feedback: Feedback, *, reveal: bool) -> None:
        when = timezone.localtime(feedback.at).strftime("%d/%m %H:%M")
        about = ""
        if feedback.about_phone is not None:
            phone = feedback.about_phone.e164() if reveal else feedback.about_phone.masked()
            about = f"\tabout {phone}"
        self.stdout.write(
            f"{when}\t{feedback.kind.value}\t{feedback.author_id}\tv{feedback.web_version}{about}"
        )
        self.stdout.write(f"  {feedback.message}")
        if has_personal_data(feedback.message):
            self.stdout.write(PERSONAL_DATA_WARNING)
