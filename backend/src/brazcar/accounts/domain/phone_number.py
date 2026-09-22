"""A Brazilian mobile number, stored as E.164 (`+5561999999999`): the `wa.me` target."""

import re
from typing import Annotated

from pydantic import AfterValidator

_COUNTRY = "55"
_LOCAL_DIGITS = 11  # two-digit area code plus the nine-digit mobile number


def normalize_phone_number(raw: str) -> str:
    digits = re.sub(r"\D", "", raw)
    if digits.startswith(_COUNTRY) and len(digits) == len(_COUNTRY) + _LOCAL_DIGITS:
        digits = digits[len(_COUNTRY) :]
    if len(digits) != _LOCAL_DIGITS or digits[0] == "0" or digits[2] != "9":
        message = "expected a Brazilian mobile number with area code, like 61 99999-9999"
        raise ValueError(message)
    return f"+{_COUNTRY}{digits}"


type PhoneNumber = Annotated[str, AfterValidator(normalize_phone_number)]
