from uuid import uuid4

import pytest
from hypothesis import assume, given

from brazcar.accounts.application import AccountRepository
from brazcar.accounts.domain import Account, EmailAlreadyRegisteredError, PhoneAlreadyRegisteredError
from brazcar.shared.domain.phone import PhoneNumber
from tests.accounts.strategies import accounts

from . import contract_settings


class AccountRepositoryContract:
    """Subclass as `TestMyRepository` and implement `make_repository`.

    An example does not get a clean store, and a phone or an e-mail belongs to one account: every
    property first frees the phones and e-mails it is about to use, through the port itself.
    """

    def make_repository(self) -> AccountRepository:
        raise NotImplementedError

    async def _free(self, repository: AccountRepository, *accounts: Account) -> None:
        for account in accounts:
            by_phone = await repository.by_phone(account.phone)
            by_email = None if account.email is None else await repository.by_email(account.email)
            for owner in {holder.id for holder in (by_phone, by_email) if holder is not None}:
                await repository.erase(owner)

    @contract_settings
    @given(account=accounts())
    async def test_saved_account_loads_back_equal_by_id_and_by_phone(self, account: Account) -> None:
        repository = self.make_repository()
        await self._free(repository, account)

        await repository.save(account)

        assert await repository.get(account.id) == account
        assert await repository.by_phone(account.phone) == account
        if account.email is not None:
            assert await repository.by_email(account.email.upper()) == account

    @contract_settings
    @given(account=accounts(), changed=accounts())
    async def test_saving_again_replaces_the_account_and_its_cars(
        self, account: Account, changed: Account
    ) -> None:
        repository = self.make_repository()
        changed = changed.evolve(id=account.id)
        await self._free(repository, account, changed)

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
        await self._free(repository, one, other)

        await repository.save(one)
        with pytest.raises(PhoneAlreadyRegisteredError):
            await repository.save(other)

        assert await repository.get(one.id) == one
        assert await repository.get(other.id) is None

    @contract_settings
    @given(account=accounts())
    async def test_updating_the_display_name_and_email_persists(self, account: Account) -> None:
        repository = self.make_repository()
        changed = account.update_profile(display_name="Nome Novo", email="novo@example.com")
        await self._free(repository, account, changed)
        await repository.save(account)

        await repository.save(changed)

        assert await repository.get(account.id) == changed

    @contract_settings
    @given(account=accounts())
    async def test_clearing_the_email_persists(self, account: Account) -> None:
        repository = self.make_repository()
        with_email = account.update_profile(email="tinha@example.com")
        await self._free(repository, with_email)
        await repository.save(with_email)

        cleared = with_email.update_profile(email="")
        await repository.save(cleared)

        assert await repository.get(account.id) == cleared
        assert cleared.email is None

    async def test_unknown_id_and_phone_load_as_none(self) -> None:
        repository = self.make_repository()

        assert await repository.get(uuid4()) is None
        assert await repository.by_phone(PhoneNumber.parse("+5561900000000")) is None
        assert await repository.by_email("ninguem@example.com") is None

    @contract_settings
    @given(account=accounts())
    async def test_erased_account_is_gone_and_its_phone_is_free_again(self, account: Account) -> None:
        repository = self.make_repository()
        await self._free(repository, account)
        await repository.save(account)

        await repository.erase(account.id)

        assert await repository.get(account.id) is None
        assert await repository.by_phone(account.phone) is None
        if account.email is not None:
            assert await repository.by_email(account.email) is None
        await repository.save(account.evolve(id=uuid4()))  # the phone and the e-mail can register again

    @contract_settings
    @given(one=accounts(), other=accounts())
    async def test_an_email_belongs_to_one_account_case_aside(self, one: Account, other: Account) -> None:
        assume(one.phone != other.phone)
        repository = self.make_repository()
        one = one.update_profile(email="dono@example.com")
        other = other.update_profile(email="DONO@Example.com")
        await self._free(repository, one, other)

        await repository.save(one)
        with pytest.raises(EmailAlreadyRegisteredError):
            await repository.save(other)

        assert await repository.get(other.id) is None
        assert await repository.by_email("Dono@example.COM") == one
