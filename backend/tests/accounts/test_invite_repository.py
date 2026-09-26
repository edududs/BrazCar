import pytest

from brazcar.accounts.adapters.invite_repository import DjangoInviteRepository
from brazcar.accounts.application import InviteRepository
from tests.contracts.invite_repository import InviteRepositoryContract

from .fakes import InMemoryInviteRepository


class TestInMemoryInviteRepository(InviteRepositoryContract):
    def make_repository(self) -> InviteRepository:
        return InMemoryInviteRepository()


@pytest.mark.contract
@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
class TestDjangoInviteRepository(InviteRepositoryContract):
    def make_repository(self) -> InviteRepository:
        return DjangoInviteRepository()
