"""The flat shape the interpreter fills, and how it becomes a judgement (D-115, ADR-0016).

Flat on purpose: a discriminated union in the JSON schema throws a small model off, so every field
is optional here and the domain's sum type is built afterwards. Values the model could get wrong
(a time it cannot format, a price it cannot spell) become "not said", never an error.
"""

from datetime import time
from decimal import Decimal, InvalidOperation
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from brazcar.importing.domain import Day, Judgement, Offer, Other, Request, Update

MAX_STOPS = 8
MAX_SEATS = 8  # a car; more than that is a misreading ("26" is a quadra), so not said


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


def _stops(values: list[str]) -> tuple[str, ...]:
    seen: list[str] = []
    for value in values:
        stop = " ".join(value.split())[:60]
        if stop and stop.casefold() not in (s.casefold() for s in seen):
            seen.append(stop)
    return tuple(seen[:MAX_STOPS])
