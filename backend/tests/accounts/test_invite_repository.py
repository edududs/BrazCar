from brazcar.accounts.application import InviteRepository
from tests.contracts.invite_repository import InviteRepositoryContract

from .fakes import InMemoryInviteRepository


class TestInMemoryInviteRepository(InviteRepositoryContract):
    def make_repository(self) -> InviteRepository:
        return InMemoryInviteRepository()


# The Django adapter joins here as `TestDjangoInviteRepository`, marked like `TestDjangoAccountRepository`.
