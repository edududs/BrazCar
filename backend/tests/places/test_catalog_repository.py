import pytest

from brazcar.places.adapters.repository import DjangoCatalogRepository
from brazcar.places.application import CatalogRepository
from tests.contracts.catalog_repository import CatalogRepositoryContract

from .fakes import InMemoryCatalogRepository


class TestInMemoryCatalogRepository(CatalogRepositoryContract):
    def make_repository(self) -> CatalogRepository:
        return InMemoryCatalogRepository()


# `transaction=True`: the adapter writes from the thread `sync_to_async` hands it, on a connection
# that the wrapping transaction of a plain `django_db` test would not roll back.
@pytest.mark.contract
@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
class TestDjangoCatalogRepository(CatalogRepositoryContract):
    def make_repository(self) -> CatalogRepository:
        return DjangoCatalogRepository()
