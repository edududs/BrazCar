from uuid import UUID

from brazcar.shared.domain.phone import PhoneNumber


class AccountError(Exception):
    """Base of every rule of this context the API translates into a response."""


class PhoneAlreadyRegisteredError(AccountError):
    def __init__(self, phone: PhoneNumber) -> None:
        super().__init__(f"{phone.e164()} already has an account")
        self.phone = phone


class EmailAlreadyRegisteredError(AccountError):
    """An e-mail belongs to one account, case aside (D-167). The address stays out of the message:
    it is personal data, and a message may end up in a log."""

    def __init__(self) -> None:
        super().__init__("the e-mail already has an account")


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


class InvalidConfirmationLinkError(AccountError):
    """The e-mail link does not serve this account now: forged, another account's, lapsed or spent."""

    def __init__(self) -> None:
        super().__init__("the e-mail confirmation link is invalid or expired")


class TooManyAttemptsError(AccountError):
    def __init__(self) -> None:
        super().__init__("too many attempts for now; try again later")


class InviteNotFoundError(AccountError, LookupError):
    """No invite answers to this link: unknown, or an e-mail link replaced by a newer one."""

    def __init__(self) -> None:
        super().__init__("no invite for this link")


class InviteExpiredError(AccountError):
    def __init__(self) -> None:
        super().__init__("the invite or its e-mail link has expired")


class InviteSupersededError(AccountError):
    """A newer invite was issued to the same phone: only the latest one is valid (D-166)."""

    def __init__(self) -> None:
        super().__init__("a newer invite replaced this one")


class InviteAlreadyUsedError(AccountError):
    def __init__(self) -> None:
        super().__init__("the invite was already used")


class InviteEmailMissingError(AccountError):
    """Consuming needs the e-mail link, and there is none before the e-mail is given."""

    def __init__(self) -> None:
        super().__init__("the invite has no e-mail yet")


class InviteConflictError(AccountError):
    """Another write reached the invite first: what keeps it single use under a race."""

    def __init__(self, invite_id: UUID) -> None:
        super().__init__(f"invite {invite_id} changed since it was read")
        self.invite_id = invite_id
