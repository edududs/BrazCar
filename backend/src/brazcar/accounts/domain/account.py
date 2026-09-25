from datetime import datetime
from typing import Annotated, Self
from uuid import UUID, uuid4

from pydantic import EmailStr, StringConstraints, model_validator

from brazcar.shared.domain.model import FrozenModel

from .account_phone import AccountPhone, account_phone
from .errors import CarNotFoundError, PlateAlreadyOnAccountError
from .license_plate import LicensePlate

type AccountId = UUID
type CarId = UUID
type ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


class Car(FrozenModel):
    id: CarId
    model: ShortText  # brand included, the way people say it: "Gol prata", "BYD cinza"
    color: ShortText
    plate: LicensePlate


class Account(FrozenModel):
    """One account serves passenger and driver alike. The password is not here: it is a credential
    of the adapter, never domain state."""

    id: AccountId
    phone: AccountPhone
    display_name: ShortText
    email: EmailStr | None = None
    terms_accepted_at: datetime
    phone_verified_at: None = None  # foreseen, unused in the MVP (D-027)
    cars: tuple[Car, ...] = ()

    @model_validator(mode="after")
    def _check(self) -> Self:
        plates = [car.plate for car in self.cars]
        if len(set(plates)) != len(plates):
            message = "the same plate twice on one account"
            raise ValueError(message)
        return self

    @classmethod
    def register(
        cls,
        *,
        phone: str,
        display_name: str,
        email: str | None,
        accepted_terms_at: datetime,
    ) -> Self:
        return cls(
            id=uuid4(),
            phone=account_phone(phone),
            display_name=display_name,
            email=email or None,
            terms_accepted_at=accepted_terms_at,
        )

    @property
    def can_drive(self) -> bool:
        """Publishing a ride needs a car (D-029). `rides` reads this, never the cars themselves."""
        return bool(self.cars)

    def add_car(self, *, model: str, color: str, plate: str) -> Self:
        car = Car(id=uuid4(), model=model, color=color, plate=plate)
        if any(existing.plate == car.plate for existing in self.cars):
            raise PlateAlreadyOnAccountError(car.plate)
        return self.evolve(cars=(*self.cars, car))

    def remove_car(self, car_id: CarId) -> Self:
        if all(car.id != car_id for car in self.cars):
            raise CarNotFoundError(car_id)
        return self.evolve(cars=tuple(car for car in self.cars if car.id != car_id))

    def update_profile(self, *, display_name: str | None = None, email: str | None = None) -> Self:
        """The only two fields the account edits about itself (D-139).

        `None` leaves a field as is; an absent `display_name` never happens over HTTP, since it is
        required, but a blank one is still refused here, by the same rule as registration. A blank
        `email` clears it. The phone stays out of reach until there is a way to prove it is still
        the same owner (D-027); the password has its own path (`ChangePassword`).
        """
        changes: dict[str, object] = {}
        if display_name is not None:
            changes["display_name"] = display_name
        if email is not None:
            changes["email"] = email or None
        return self if not changes else self.evolve(**changes)
