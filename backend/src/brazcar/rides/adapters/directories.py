"""What `rides` asks the other contexts, through their own ports (D-006): never their tables."""

from brazcar.accounts.application import AccountRepository
from brazcar.accounts.domain import Account
from brazcar.places.application import CatalogRepository
from brazcar.rides.application import DriverAccount, DriverCar
from brazcar.rides.domain import AccountId, PlaceId
from brazcar.shared.domain.phone import PhoneNumber


class AccountDriverDirectory:
    def __init__(self, accounts: AccountRepository) -> None:
        self._accounts = accounts

    async def get(self, account_id: AccountId) -> DriverAccount | None:
        account = await self._accounts.get(account_id)
        return None if account is None else _driver_account(account)

    async def by_phone(self, phone: PhoneNumber) -> DriverAccount | None:
        account = await self._accounts.by_phone(phone)
        return None if account is None else _driver_account(account)


def _driver_account(account: Account) -> DriverAccount:
    return DriverAccount(
        id=account.id,
        display_name=account.display_name,
        phone=account.phone,
        cars=tuple(
            DriverCar(car_id=car.id, model=car.model, color=car.color, plate=car.plate)
            for car in account.cars
        ),
    )


class CatalogPlaceDirectory:
    def __init__(self, catalog: CatalogRepository) -> None:
        self._catalog = catalog

    async def labels(self) -> dict[PlaceId, str]:
        catalog = await self._catalog.load()
        return {place.id: place.name for place in catalog.places}
