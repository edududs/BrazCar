"""Confidence is ours, not the model's (D-115): each extracted value must be backed by the words.

A field the message did not give counts as backed: there was nothing to hallucinate. What is
checked is what the model claims it read.
"""

from typing import Annotated

from pydantic import Field

from brazcar.shared.domain.model import FrozenModel

from .judgement import Offer
from .text_key import digit_tokens, text_key

type Share = Annotated[float, Field(ge=0.0, le=1.0)]


class Checks(FrozenModel):
    time_in_text: bool
    seats_in_text: bool
    price_in_text: bool
    stops_in_text: Share  # the share of extracted stops whose words appear in the message
    catalog_stops: Annotated[int, Field(ge=0)]  # how many of them the catalog recognised

    @property
    def confidence(self) -> float:
        """Weights are a judgement call, fixed here so the threshold means the same everywhere."""
        return round(
            0.35 * self.time_in_text
            + 0.15 * self.seats_in_text
            + 0.15 * self.price_in_text
            + 0.35 * self.stops_in_text,
            3,
        )


def check(offer: Offer, text: str, *, resolved: tuple[bool, ...]) -> Checks:
    """`resolved[i]` says whether the catalog knew `offer.stops[i]`."""
    digits = digit_tokens(text)
    folded = text_key(text)
    stops = offer.stops
    return Checks(
        time_in_text=offer.at is None or _number_in(digits, offer.at.hour),
        seats_in_text=offer.seats is None or _number_in(digits, offer.seats),
        price_in_text=offer.price is None or _number_in(digits, int(offer.price)),
        stops_in_text=(1.0 if not stops else sum(text_key(stop) in folded for stop in stops) / len(stops)),
        catalog_stops=sum(resolved),
    )


def _number_in(digits: frozenset[str], value: int) -> bool:
    """As written or zero-padded: "7" and "07" are both the seventh hour."""
    return str(value) in digits or f"{value:02d}" in digits
