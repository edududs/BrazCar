from datetime import UTC, datetime
from uuid import uuid4

import pytest

from brazcar.accounts.adapters.repository import DjangoAccountRepository
from brazcar.accounts.domain import Account
from brazcar.rides.adapters.repository import DjangoRideRepository
from brazcar.rides.application import BoardRevision, RideRepository
from brazcar.rides.domain import AccountId
from brazcar.shared.adapters.board_revision import DjangoBoardRevision
from tests.contracts.ride_repository import RideRepositoryContract

from .fakes import InMemoryRideRepository


class TestInMemoryRideRepository(RideRepositoryContract):
    _fake: InMemoryRideRepository | None = None  # the fake is its own revision counter

    def make_repository(self) -> RideRepository:
        return self._shared_fake()

    def make_revision(self) -> BoardRevision:
        return self._shared_fake()

    def _shared_fake(self) -> InMemoryRideRepository:
        if self._fake is None:
            self._fake = InMemoryRideRepository()
        return self._fake


@pytest.mark.contract
@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
class TestDjangoRideRepository(RideRepositoryContract):
    def make_repository(self) -> RideRepository:
        return DjangoRideRepository()

    def make_revision(self) -> BoardRevision:
        return DjangoBoardRevision()

    async def driver(self) -> AccountId:
        """A ride's driver is a row of `accounts` (D-090): one fresh account per example."""
        digits = uuid4().int % 10**8
        account = Account.register(
            phone=f"+55619{digits:08d}",
            display_name="Motorista",
            email=None,
            accepted_terms_at=datetime(2026, 9, 22, tzinfo=UTC),
        )
        await DjangoAccountRepository().save(account)
        return account.id
