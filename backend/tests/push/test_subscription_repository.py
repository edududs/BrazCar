from uuid import UUID, uuid4

import pytest

from brazcar.accounts.adapters.repository import DjangoAccountRepository
from brazcar.accounts.domain import Account
from brazcar.push.adapters.repository import DjangoSubscriptionRepository
from brazcar.push.application import SubscriptionRepository
from tests.contracts.subscription_repository import SubscriptionRepositoryContract, endpoint

from .fakes import NOW, InMemorySubscriptionRepository, make_subscription


class TestInMemorySubscriptionRepository(SubscriptionRepositoryContract):
    def make_subscriptions(self) -> SubscriptionRepository:
        return InMemorySubscriptionRepository()


async def register() -> UUID:
    digits = uuid4().int % 10**8
    account = Account.register(
        phone=f"+55619{digits:08d}",
        display_name="Quem recebe",
        email=None,
        accepted_terms_at=NOW,
    )
    await DjangoAccountRepository().save(account)
    return account.id


@pytest.mark.contract
@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
class TestDjangoSubscriptionRepository(SubscriptionRepositoryContract):
    def make_subscriptions(self) -> SubscriptionRepository:
        return DjangoSubscriptionRepository()

    async def owner(self) -> UUID:
        return await register()

    async def test_an_erased_account_keeps_its_row_but_its_devices_are_never_listed(self) -> None:
        repository = DjangoSubscriptionRepository()
        gone, staying = await register(), await register()
        lost = make_subscription(endpoint(), gone)
        kept = make_subscription(endpoint(), staying)
        await repository.save(lost)
        await repository.save(kept)

        await DjangoAccountRepository().erase(gone)

        assert await repository.of_owner(gone) == ()
        assert await repository.of_owner(staying) == (kept,)
        assert await repository.get(lost.endpoint) == lost
