"""What `rides` asks the other contexts, through their own ports (D-006): never their tables."""

from brazcar.accounts.application import AccountRepository
from brazcar.places.application import CatalogRepository
from brazcar.rides.application import Driver, DriverCar
from brazcar.rides.domain import AccountId, PlaceId


class AccountDriverDirectory:
    def __init__(self, accounts: AccountRepository) -> None:
        self._accounts = accounts

    async def get(self, account_id: AccountId) -> Driver | None:
        account = await self._accounts.get(account_id)
        if account is None:
            return None
        return Driver(
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
