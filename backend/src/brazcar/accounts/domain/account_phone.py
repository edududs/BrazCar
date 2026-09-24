"""Which phones may own an account: a Brazilian mobile, for now (D-137).

The contact is a `wa.me` link, so a landline would lead nowhere; other countries come in by a
decision that changes this rule, not the `PhoneNumber` underneath it.
"""

from typing import Annotated

from pydantic import AfterValidator

from brazcar.shared.domain.phone import BRAZIL, PhoneNumber

from .errors import ForeignPhoneNumberError, NotAMobilePhoneError

ACCEPTED_COUNTRY = BRAZIL


def accept_account_phone(phone: PhoneNumber) -> PhoneNumber:
    if phone.country != ACCEPTED_COUNTRY:
        raise ForeignPhoneNumberError(phone)
    if not phone.is_mobile:
        raise NotAMobilePhoneError(phone)
    return phone


def account_phone(raw: str) -> PhoneNumber:
    """What a person typed, read and checked: raises `InvalidPhoneNumberError` or the two above."""
    return accept_account_phone(PhoneNumber.parse(raw, default_country=ACCEPTED_COUNTRY))


type AccountPhone = Annotated[PhoneNumber, AfterValidator(accept_account_phone)]
