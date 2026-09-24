import pytest

from brazcar.importing.adapters.repository import DjangoCandidates, DjangoSourceMessages
from brazcar.importing.application import Candidates, SourceMessages
from tests.contracts.importing_repositories import ImportingRepositoriesContract

from .fakes import InMemoryCandidates, InMemorySourceMessages


class TestInMemoryRepositories(ImportingRepositoriesContract):
    def make_messages(self) -> SourceMessages:
        return InMemorySourceMessages()

    def make_candidates(self, messages: SourceMessages) -> Candidates:
        assert isinstance(messages, InMemorySourceMessages)
        return InMemoryCandidates(messages)


@pytest.mark.contract
@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
class TestDjangoRepositories(ImportingRepositoriesContract):
    def make_messages(self) -> SourceMessages:
        return DjangoSourceMessages()

    def make_candidates(self, messages: SourceMessages) -> Candidates:
        del messages  # the table links them by itself
        return DjangoCandidates()
