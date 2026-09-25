"""A phone number made of parts that know what they are: country, area code, subscriber (D-135).

It is the one definition of a phone for every context. What a context accepts (a country, a mobile)
is that context's rule on top of this, never a flag in here (D-137). It is written and read as E.164,
so a field typed `PhoneNumber` takes `"+5561999999999"` and gives it back.
"""

import re
from typing import Annotated, Self

from pydantic import Field, StringConstraints, model_serializer, model_validator

from brazcar.shared.domain.model import FrozenModel

from . import codec


class InvalidPhoneNumberError(ValueError):
    def __init__(self, raw: str) -> None:
        super().__init__(f"{raw!r} is not a valid phone number")
        self.raw = raw


class CountryCode(FrozenModel):
    """The calling code, `55` for Brazil."""

    value: Annotated[int, Field(ge=1, le=999)]

    def display(self) -> str:
        return f"+{self.value}"


BRAZIL = CountryCode(value=55)


class AreaCode(FrozenModel):
    """The national destination code: the DDD in Brazil, `61` for the Federal District."""

    value: Annotated[str, StringConstraints(pattern=r"^[0-9]{1,5}$")]

    def display(self) -> str:
        return f"({self.value})"


class SubscriberNumber(FrozenModel):
    """What is left after the area code: nine digits for a Brazilian mobile."""

    value: Annotated[str, StringConstraints(pattern=r"^[0-9]{4,14}$")]

    def display(self) -> str:
        return f"{self.value[:-4]}-{self.value[-4:]}"


_LEGACY_BRAZILIAN_MOBILE = re.compile(r"^55([1-9]{2})([6-9][0-9]{7})$")
"""An old WhatsApp account keeps the address it had before the ninth digit (D-138)."""


_VISIBLE_PREFIX = 5  # "+" and the country and area codes of a Brazilian mobile
_VISIBLE_SUFFIX = 4  # the last four digits


class PhoneNumber(FrozenModel):
    """Valid by construction: the parts together must be a number the numbering plan allows."""

    country: CountryCode
    area: AreaCode | None  # some plans have none; Brazil always has one
    subscriber: SubscriberNumber

    @classmethod
    def parse(cls, raw: str, *, default_country: CountryCode = BRAZIL) -> Self:
        """What a person types: `"+55 (61) 9 9999-9999"`, `"61999999999"`, with or without country."""
        return cls.model_validate(_fields(raw, default_country))

    @classmethod
    def from_jid_user(cls, user: str) -> Self:
        """The user part of a WhatsApp address: digits, country first, no `+`.

        A Brazilian mobile from before the ninth digit gets it back, so the same person is one
        number whether WhatsApp says `556199998888` or `5561999998888` (D-138).
        """
        if not user.isdigit():
            raise InvalidPhoneNumberError(user)
        legacy = _LEGACY_BRAZILIAN_MOBILE.match(user)
        digits = f"55{legacy[1]}9{legacy[2]}" if legacy else user
        return cls.parse(f"+{digits}")

    @model_validator(mode="before")
    @classmethod
    def _from_text(cls, data: object) -> object:
        """A string is read as `parse` reads it: how the database and the API hand a phone over."""
        return _fields(data, BRAZIL) if isinstance(data, str) else data

    @model_validator(mode="after")
    def _allowed_by_the_plan(self) -> Self:
        try:
            parts = codec.decode(self.e164(), codec.region_code(self.country.value))
        except ValueError as error:
            raise InvalidPhoneNumberError(self.e164()) from error
        if (parts.area, parts.subscriber) != (self.area.value if self.area else "", self.subscriber.value):
            raise InvalidPhoneNumberError(self.e164())  # right digits, wrong split
        return self

    @model_serializer
    def _as_e164(self) -> str:
        return self.e164()

    def __hash__(self) -> int:  # pydantic hashes frozen models already; this tells the type checker
        return hash(self.e164())

    def e164(self) -> str:
        """`+5561999999999`: what accounts store and what identifies the number anywhere."""
        return f"+{self.country.value}{self.area.value if self.area else ''}{self.subscriber.value}"

    def jid_user(self) -> str:
        """`5561999999999`: how WhatsApp addresses the number, and what `wa.me` takes."""
        return self.e164().removeprefix("+")

    def display(self, home: CountryCode = BRAZIL) -> str:
        """`(61) 99999-9999` at home; a number from abroad keeps its country: `+1 415-555-2671`."""
        return codec.national(self.e164()) if self.country == home else self.international()

    def international(self) -> str:
        """`+55 61 99999-9999`."""
        return codec.international(self.e164())

    def masked(self) -> str:
        """`+5561*****0001`: country and area open, the last four closed, for lists read over ssh."""
        e164 = self.e164()
        hidden = len(e164) - _VISIBLE_PREFIX - _VISIBLE_SUFFIX
        if hidden <= 0:  # too short to have a safe middle to hide
            return e164
        return f"{e164[:_VISIBLE_PREFIX]}{'*' * hidden}{e164[-_VISIBLE_SUFFIX:]}"

    def region(self) -> str | None:
        """Where the area code is: `Distrito Federal` for a mobile of 61; `None` when unknown."""
        return codec.place(self.e164()) or None

    @property
    def is_mobile(self) -> bool:
        return codec.is_mobile(self.e164())


def _fields(raw: str, default_country: CountryCode) -> dict[str, object]:
    try:
        parts = codec.decode(raw, codec.region_code(default_country.value))
    except ValueError as error:
        raise InvalidPhoneNumberError(raw) from error
    return {
        "country": {"value": parts.country},
        "area": {"value": parts.area} if parts.area else None,
        "subscriber": {"value": parts.subscriber},
    }
