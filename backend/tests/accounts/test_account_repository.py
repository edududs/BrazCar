import pytest

from brazcar.accounts.adapters.repository import DjangoAccountRepository
from brazcar.accounts.application import AccountRepository
from tests.contracts.account_repository import AccountRepositoryContract

from .fakes import InMemoryAccountRepository


class TestInMemoryAccountRepository(AccountRepositoryContract):
    def make_repository(self) -> AccountRepository:
        return InMemoryAccountRepository()


@pytest.mark.contract
@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
class TestDjangoAccountRepository(AccountRepositoryContract):
    def make_repository(self) -> AccountRepository:
        return DjangoAccountRepository()
