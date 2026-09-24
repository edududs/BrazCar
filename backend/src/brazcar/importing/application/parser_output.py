"""The flat shape the interpreter fills, and how it becomes a judgement (D-115, ADR-0016).

Flat on purpose: a discriminated union in the JSON schema throws a small model off, so every field
is optional here and the domain's sum type is built afterwards. Values the model could get wrong
(a time it cannot format, a price it cannot spell) become "not said", never an error.
"""

from datetime import time
from decimal import Decimal, InvalidOperation
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from brazcar.importing.domain import Day, Judgement, Offer, OfferFare, Other, Request, Update

MAX_STOPS = 15  # a long route is real ("Brazlândia 🔁 Aeroporto" has ten); past this, the middle goes
MAX_SEATS = 8  # a car; more than that is a misreading ("26" is a quadra), so not said
MAX_FARES = MAX_STOPS  # one price per stop at most; the rest is noise


class StopFare(BaseModel):
    """One line of a price list: the words of a place and what it costs to reach it (D-131)."""

    model_config = ConfigDict(extra="ignore")

    stop: str = Field(description="the place this price is for, as written in the message")
    price: str = Field(description="price in reais to that place as 9.00")


class ParserOutput(BaseModel):
    """What the model answers. Also the JSON schema it is constrained to (`model_json_schema`)."""

    model_config = ConfigDict(extra="ignore")

    kind: Literal["offer", "request", "update", "other"] = Field(
        description="offer: a driver offering seats; request: a passenger asking; "
        "update: about an earlier offer (lotou, só 1 vaga, cancelei); other: anything else"
    )
    time: str | None = Field(default=None, description="departure clock time as HH:MM, or null")
    day: Literal["today", "tomorrow", "unknown"] = Field(
        default="unknown", description="which day the message means, if it says"
    )
    stops: list[str] = Field(default=[], description="the places named, in the order written, as written")
    seats: int | None = Field(default=None, description="seats offered, if a number is given")
    price: str | None = Field(default=None, description="price per person in reais as 7.00, or null")
    fares: list[StopFare] = Field(
        default=[], description="when the message prices each place apart, one entry per place"
    )
    payment_methods: list[Literal["cash", "pix"]] = Field(default=[])
    closed: bool = Field(default=False, description="for an update: the offer is closed or cancelled")


def to_judgement(output: ParserOutput) -> Judgement:
    match output.kind:
        case "offer":
            return Offer(
                at=_time(output.time),
                day=Day(output.day),
                stops=_stops(output.stops),
                seats=_seats(output.seats),
                price=_price(output.price),
                fares=_fares(output.fares),
                payment_methods=frozenset(output.payment_methods),
            )
        case "request":
            return Request()
        case "update":
            return Update(seats=_seats(output.seats), closed=output.closed)
        case "other":
            return Other()


def _time(value: str | None) -> time | None:
    if value is None:
        return None
    hour, _, minute = value.strip().partition(":")
    try:
        return time(int(hour), int(minute or 0))
    except ValueError:
        return None


def _seats(value: int | None) -> int | None:
    return value if value is not None and 0 <= value <= MAX_SEATS else None


def _price(value: str | None) -> Decimal | None:
    if value is None:
        return None
    try:
        price = Decimal(value.strip().replace(",", "."))
    except InvalidOperation:
        return None
    return price if 0 < price < 10_000 else None  # noqa: PLR2004 - a ride never costs that much


def _fares(values: list[StopFare]) -> tuple[OfferFare, ...]:
    """A line the model could not spell is dropped, like every other value it got wrong."""
    fares: list[OfferFare] = []
    for value in values[:MAX_FARES]:
        stop = " ".join(value.stop.split())[:60]
        price = _price(value.price)
        if stop and price is not None:
            fares.append(OfferFare(stop=stop, price=price))
    return tuple(fares)


def _stops(values: list[str]) -> tuple[str, ...]:
    seen: list[str] = []
    for value in values:
        stop = " ".join(value.split())[:60]
        if stop and stop.casefold() not in (s.casefold() for s in seen):
            seen.append(stop)
    if len(seen) > MAX_STOPS:  # never lose where it leaves from or where it goes
        seen = [*seen[: MAX_STOPS - 1], seen[-1]]
    return tuple(seen)
