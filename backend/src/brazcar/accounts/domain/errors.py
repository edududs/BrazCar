from uuid import UUID


class AccountError(Exception):
    """Base of every rule of this context the API translates into a response."""


class PhoneAlreadyRegisteredError(AccountError):
    def __init__(self, phone: str) -> None:
        super().__init__(f"{phone} already has an account")
        self.phone = phone


class AccountNotFoundError(AccountError, LookupError):
    def __init__(self, account_id: UUID) -> None:
        super().__init__(f"no account {account_id}")
        self.account_id = account_id


class InvalidCredentialsError(AccountError):
    def __init__(self) -> None:
        super().__init__("phone or password is wrong")


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
