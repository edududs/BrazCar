from uuid import uuid4

import pytest
from hypothesis import assume, given

from brazcar.accounts.application import AccountRepository
from brazcar.accounts.domain import Account, PhoneAlreadyRegisteredError
from brazcar.shared.domain.phone import PhoneNumber
from tests.accounts.strategies import accounts

from . import contract_settings


class AccountRepositoryContract:
    """Subclass as `TestMyRepository` and implement `make_repository`.

    An example does not get a clean store, and a phone belongs to one account: every property
    first frees the phones it is about to use, through the port itself.
    """

    def make_repository(self) -> AccountRepository:
        raise NotImplementedError

    async def _free(self, repository: AccountRepository, *phones: PhoneNumber) -> None:
        for phone in phones:
            owner = await repository.by_phone(phone)
            if owner is not None:
                await repository.erase(owner.id)

    @contract_settings
    @given(account=accounts())
    async def test_saved_account_loads_back_equal_by_id_and_by_phone(self, account: Account) -> None:
        repository = self.make_repository()
        await self._free(repository, account.phone)

        await repository.save(account)

        assert await repository.get(account.id) == account
        assert await repository.by_phone(account.phone) == account

    @contract_settings
    @given(account=accounts(), changed=accounts())
    async def test_saving_again_replaces_the_account_and_its_cars(
        self, account: Account, changed: Account
    ) -> None:
        repository = self.make_repository()
        changed = changed.evolve(id=account.id)
        await self._free(repository, account.phone, changed.phone)

        await repository.save(account)
        await repository.save(changed)

        assert await repository.get(account.id) == changed
        assert await repository.by_phone(account.phone) in (None, changed)

    @contract_settings
    @given(one=accounts(), other=accounts())
    async def test_a_phone_belongs_to_one_account(self, one: Account, other: Account) -> None:
        assume(one.id != other.id)
        repository = self.make_repository()
        other = other.evolve(phone=one.phone)
        await self._free(repository, one.phone)

        await repository.save(one)
        with pytest.raises(PhoneAlreadyRegisteredError):
            await repository.save(other)

        assert await repository.get(one.id) == one
        assert await repository.get(other.id) is None

    async def test_unknown_id_and_phone_load_as_none(self) -> None:
        repository = self.make_repository()

        assert await repository.get(uuid4()) is None
        assert await repository.by_phone(PhoneNumber.parse("+5561900000000")) is None

    @contract_settings
    @given(account=accounts())
    async def test_erased_account_is_gone_and_its_phone_is_free_again(self, account: Account) -> None:
        repository = self.make_repository()
        await self._free(repository, account.phone)
        await repository.save(account)

        await repository.erase(account.id)

        assert await repository.get(account.id) is None
        assert await repository.by_phone(account.phone) is None
        await repository.save(account.evolve(id=uuid4()))  # the phone can register again
