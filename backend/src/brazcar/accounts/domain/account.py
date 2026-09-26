from datetime import datetime
from typing import Annotated, Literal, Self
from uuid import UUID, uuid4

from pydantic import EmailStr, StringConstraints, model_validator

from brazcar.shared.domain.model import FrozenModel

from .account_phone import AccountPhone, account_phone
from .errors import CarNotFoundError, PlateAlreadyOnAccountError
from .license_plate import LicensePlate

type AccountId = UUID
type CarId = UUID
type ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
type RequiredAction = Literal["confirm_email"]
"""What an account must do before it changes anything else (D-168). One value for now."""


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
    email_confirmed_at: datetime | None = None
    """When the e-mail was proven to reach the owner. An account from before the invite may have none."""
    terms_accepted_at: datetime
    phone_verified_at: None = None  # foreseen, unused in the MVP (D-027)
    cars: tuple[Car, ...] = ()

    @model_validator(mode="after")
    def _check(self) -> Self:
        plates = [car.plate for car in self.cars]
        if len(set(plates)) != len(plates):
            message = "the same plate twice on one account"
            raise ValueError(message)
        if self.email_confirmed_at is not None and self.email is None:
            message = "a confirmed e-mail without an e-mail"
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
        """An account as it was before the invite: the e-mail, if any, never confirmed. The product
        signs up only through `register_from_invite` now (D-167); this stays for the seed and tests."""
        return cls(
            id=uuid4(),
            phone=account_phone(phone),
            display_name=display_name,
            email=email or None,
            terms_accepted_at=accepted_terms_at,
        )

    @classmethod
    def register_from_invite(
        cls, *, phone: AccountPhone, email: str, display_name: str, now: datetime
    ) -> Self:
        """The account an invite finishes (D-160, D-167): phone and e-mail come from the invite, and
        the e-mail is confirmed by the very link that opened this registration."""
        return cls(
            id=uuid4(),
            phone=phone,
            display_name=display_name,
            email=email,
            email_confirmed_at=now,
            terms_accepted_at=now,
        )

    @property
    def email_confirmed(self) -> bool:
        return self.email_confirmed_at is not None

    @property
    def required_action(self) -> RequiredAction | None:
        """Computed, never stored (D-168): an account without a confirmed e-mail is held until it
        confirms one, since the e-mail is what makes the account answerable (D-160)."""
        return None if self.email_confirmed else "confirm_email"

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

    def update_profile(self, *, display_name: str | None = None) -> Self:
        """The display name, the only personal data the account edits by itself (D-139, D-168).

        `None` leaves it as is; a blank one is refused here, by the same rule as registration. The
        e-mail changes only through a confirmed link (`confirm_email`); the phone stays out of reach
        until there is a way to prove it is still the same owner (D-027); the password has its own
        path (`ChangePassword`).
        """
        return self if display_name is None else self.evolve(display_name=display_name)

    def confirm_email(self, email: str, now: datetime) -> Self:
        """The address a link just proved reaches the owner (D-168): it replaces the current one,
        confirmed as of `now`."""
        return self.evolve(email=email, email_confirmed_at=now)
