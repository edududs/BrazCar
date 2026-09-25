from datetime import UTC, datetime, timedelta
from io import StringIO
from uuid import uuid4

import pytest
from asgiref.sync import sync_to_async
from django.core.management import call_command

from brazcar.accounts.adapters.repository import DjangoAccountRepository
from brazcar.accounts.domain import Account
from brazcar.feedback.adapters.management.commands.feedback import PERSONAL_DATA_WARNING
from brazcar.feedback.adapters.repository import DjangoFeedbackBox
from brazcar.feedback.domain import Feedback, FeedbackKind
from brazcar.shared.domain.phone import PhoneNumber

ACCUSED = "+5561999990002"


async def _run(*args: str) -> list[str]:
    out = StringIO()
    # The command opens a loop of its own, so it may not share this one's single thread executor.
    await sync_to_async(call_command, thread_sensitive=False)("feedback", *args, stdout=out)
    return out.getvalue().splitlines()


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
class TestFeedbackCommand:
    async def _keep(self, *, message: str, about: str | None = None, hours_ago: int = 1) -> Feedback:
        account = Account.register(
            phone=f"+55619{uuid4().int % 10**8:08d}",
            display_name="Quem opina",
            email=None,
            accepted_terms_at=datetime(2026, 9, 25, tzinfo=UTC),
        )
        await DjangoAccountRepository().save(account)
        feedback = Feedback.send(
            author_id=account.id,
            kind=FeedbackKind.COMPLAINT if about else FeedbackKind.SUGGESTION,
            message=message,
            about_phone=None if about is None else PhoneNumber.parse(about),
            web_version="0.20.2",
            at=datetime.now(UTC) - timedelta(hours=hours_ago),
        )
        await DjangoFeedbackBox().keep(feedback)
        return feedback

    async def test_lists_the_week_and_masks_the_phone_a_complaint_names(self) -> None:
        feedback = await self._keep(message="Não apareceu.", about=ACCUSED)

        lines = await _run()

        assert "complaint" in lines[0]
        assert str(feedback.author_id) in lines[0]
        assert "v0.20.2" in lines[0]
        assert "about +5561*****0002" in lines[0]
        assert ACCUSED not in "\n".join(lines)
        assert lines[1] == "  Não apareceu."
        assert lines[-1] == "1 opinion(s) in the last 168h"

    async def test_reveal_shows_the_whole_number(self) -> None:
        await self._keep(message="Não apareceu.", about=ACCUSED)

        lines = await _run("--reveal")

        assert f"about {ACCUSED}" in lines[0]

    async def test_since_leaves_older_ones_out(self) -> None:
        await self._keep(message="Antiga.", hours_ago=30)
        await self._keep(message="Recente.", hours_ago=1)

        lines = await _run("--since", "24")

        assert "  Recente." in lines
        assert "  Antiga." not in lines

    async def test_a_text_with_personal_data_is_flagged_but_kept_as_written(self) -> None:
        await self._keep(message="Me liga no 61 99999-0003 que eu explico.")

        lines = await _run()

        assert lines[1] == "  Me liga no 61 99999-0003 que eu explico."
        assert lines[2] == PERSONAL_DATA_WARNING
