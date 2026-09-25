from uuid import UUID

from brazcar.shared.domain.phone import PhoneNumber


class AccountError(Exception):
    """Base of every rule of this context the API translates into a response."""


class PhoneAlreadyRegisteredError(AccountError):
    def __init__(self, phone: PhoneNumber) -> None:
        super().__init__(f"{phone.e164()} already has an account")
        self.phone = phone


class ForeignPhoneNumberError(AccountError, ValueError):
    """A valid number of another country: accounts are Brazilian for now (D-137)."""

    def __init__(self, phone: PhoneNumber) -> None:
        super().__init__(f"{phone.e164()} is not a Brazilian number")
        self.phone = phone


class NotAMobilePhoneError(AccountError, ValueError):
    """A landline: the contact goes by WhatsApp, so an account needs a mobile (D-137)."""

    def __init__(self, phone: PhoneNumber) -> None:
        super().__init__(f"{phone.e164()} is not a mobile number")
        self.phone = phone


class AccountNotFoundError(AccountError, LookupError):
    def __init__(self, account_id: UUID) -> None:
        super().__init__(f"no account {account_id}")
        self.account_id = account_id


class InvalidCredentialsError(AccountError):
    def __init__(self) -> None:
        super().__init__("phone or password is wrong")


class WrongCurrentPasswordError(AccountError):
    """`ChangePassword` needs the current password, to keep a stolen session from resetting it
    without anyone typing it once."""

    def __init__(self) -> None:
        super().__init__("current password is wrong")


class PlateAlreadyOnAccountError(AccountError):
    def __init__(self, plate: str) -> None:
        super().__init__(f"plate {plate} is already on this account")
        self.plate = plate


class CarNotFoundError(AccountError, LookupError):
    def __init__(self, car_id: UUID) -> None:
        super().__init__(f"no car {car_id} on this account")
        self.car_id = car_id


class InvalidResetTokenError(AccountError):
    def __init__(self) -> None:
        super().__init__("the password reset link is invalid or expired")


class TooManyAttemptsError(AccountError):
    def __init__(self) -> None:
        super().__init__("too many attempts for now; try again later")
