import pytest

from brazcar.importing.adapters.repository import DjangoRemovalRequests
from brazcar.importing.application import RemovalRequests
from tests.contracts.removal_requests import RemovalRequestsContract

from .fakes import InMemoryRemovalRequests


class TestInMemoryRemovalRequests(RemovalRequestsContract):
    def make_requests(self) -> RemovalRequests:
        return InMemoryRemovalRequests()


@pytest.mark.contract
@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
class TestDjangoRemovalRequests(RemovalRequestsContract):
    def make_requests(self) -> RemovalRequests:
        return DjangoRemovalRequests()
