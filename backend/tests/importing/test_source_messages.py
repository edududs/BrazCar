import pytest

from brazcar.importing.adapters.repository import DjangoSourceMessages
from brazcar.importing.application import SourceMessages
from tests.contracts.source_messages import SourceMessagesContract

from .fakes import InMemorySourceMessages


class TestInMemorySourceMessages(SourceMessagesContract):
    def make_messages(self) -> SourceMessages:
        return InMemorySourceMessages()


@pytest.mark.contract
@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
class TestDjangoSourceMessages(SourceMessagesContract):
    def make_messages(self) -> SourceMessages:
        return DjangoSourceMessages()
