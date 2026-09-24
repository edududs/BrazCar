"""The one door to `phonenumbers`, the port of Google's libphonenumber (D-136).

Parsing, validity, number type and the place behind an area code are the library's knowledge, kept
current by its releases; nothing else in the code imports it. Pure computation, like pydantic, so no
port: the functions speak plain strings and ints, and know nothing of `PhoneNumber`.
"""

from dataclasses import dataclass

import phonenumbers
from phonenumbers import PhoneNumberFormat, PhoneNumberType, geocoder

_MOBILE = frozenset({PhoneNumberType.MOBILE, PhoneNumberType.FIXED_LINE_OR_MOBILE})
_LANGUAGE = "pt"


@dataclass(frozen=True, slots=True)
class Parts:
    """A valid number split the way the numbering plan of its country splits it."""

    country: int
    area: str  # empty where the plan has no area code
    subscriber: str


def decode(raw: str, default_region: str) -> Parts:
    """Split a valid number. `default_region` (ISO 3166, like "BR") reads a number without `+`.

    Raises `ValueError` for anything the numbering plan does not allow.
    """
    try:
        number = phonenumbers.parse(raw, default_region)
    except phonenumbers.NumberParseException as error:
        raise ValueError(str(error)) from error
    if not phonenumbers.is_valid_number(number):
        message = f"{raw!r} is not a valid phone number"
        raise ValueError(message)
    national = phonenumbers.national_significant_number(number)
    area_length = phonenumbers.length_of_national_destination_code(number)
    country = number.country_code
    assert country is not None  # noqa: S101 - a parsed number always has one
    return Parts(country=country, area=national[:area_length], subscriber=national[area_length:])


def region_code(country: int) -> str:
    """The main ISO 3166 region of a country calling code: 55 is "BR"."""
    return phonenumbers.region_code_for_country_code(country)


def national(e164: str) -> str:
    return phonenumbers.format_number(phonenumbers.parse(e164), PhoneNumberFormat.NATIONAL)


def international(e164: str) -> str:
    return phonenumbers.format_number(phonenumbers.parse(e164), PhoneNumberFormat.INTERNATIONAL)


def is_mobile(e164: str) -> bool:
    """Fixed-line-or-mobile counts: some plans (the US one) cannot tell, and WhatsApp runs on both."""
    return phonenumbers.number_type(phonenumbers.parse(e164)) in _MOBILE


def place(e164: str) -> str:
    """Where the area code is, in Portuguese: the state for a mobile, the city for a landline."""
    return geocoder.description_for_number(phonenumbers.parse(e164), _LANGUAGE)
