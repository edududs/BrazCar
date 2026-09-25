from datetime import UTC, datetime
from uuid import uuid4

import pytest

from brazcar.accounts.adapters.repository import DjangoAccountRepository
from brazcar.accounts.domain import Account
from brazcar.feedback.adapters.repository import DjangoFeedbackBox
from brazcar.feedback.application import FeedbackBox
from brazcar.feedback.domain import AccountId
from tests.contracts.feedback_box import FeedbackBoxContract

from .fakes import InMemoryFeedbackBox


class TestInMemoryFeedbackBox(FeedbackBoxContract):
    def make_box(self) -> FeedbackBox:
        return InMemoryFeedbackBox()


@pytest.mark.contract
@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
class TestDjangoFeedbackBox(FeedbackBoxContract):
    def make_box(self) -> FeedbackBox:
        return DjangoFeedbackBox()

    async def author(self) -> AccountId:
        digits = uuid4().int % 10**8
        account = Account.register(
            phone=f"+55619{digits:08d}",
            display_name="Quem opina",
            email=None,
            accepted_terms_at=datetime(2026, 9, 25, tzinfo=UTC),
        )
        await DjangoAccountRepository().save(account)
        return account.id
