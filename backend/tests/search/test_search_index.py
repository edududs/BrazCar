import pytest

from brazcar.search.adapters.index import DjangoSearchIndex
from brazcar.search.application import SearchIndex
from tests.contracts.search_index import SearchIndexContract

from .fakes import InMemorySearchIndex


class TestInMemorySearchIndex(SearchIndexContract):
    def make_index(self) -> SearchIndex:
        return InMemorySearchIndex()


@pytest.mark.contract
@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
class TestDjangoSearchIndex(SearchIndexContract):
    def make_index(self) -> SearchIndex:
        return DjangoSearchIndex("contract")
