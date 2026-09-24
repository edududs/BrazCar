"""What the interpreter says a message is (D-115). Only an offer can become a ride (D-009)."""

from datetime import time
from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from brazcar.shared.domain.model import FrozenModel

type StopText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
type Payment = Literal["cash", "pix"]


class Day(StrEnum):
    """Which day the offer means, as the message says it; the code turns it into a date."""

    TODAY = "today"
    TOMORROW = "tomorrow"
    UNKNOWN = "unknown"


class Offer(FrozenModel):
    """A driver offering seats. Everything but the stops may be missing; the message often is."""

    kind: Literal["offer"] = "offer"
    at: time | None = None  # the clock time as written; the day and the date are resolved apart
    day: Day = Day.UNKNOWN
    stops: tuple[StopText, ...] = ()  # in the order written: the first is where it leaves from
    seats: Annotated[int, Field(ge=0, le=8)] | None = None
    price: Annotated[Decimal, Field(gt=0, max_digits=6, decimal_places=2)] | None = None
    payment_methods: frozenset[Payment] = frozenset()


class Request(FrozenModel):
    """A passenger asking for a seat (D-010 keeps it out of the board)."""

    kind: Literal["request"] = "request"


class Update(FrozenModel):
    """ "Lotou", "só 1 vaga", "cancelei": about an earlier offer, kept without effect (D-118)."""

    kind: Literal["update"] = "update"
    seats: Annotated[int, Field(ge=0, le=8)] | None = None
    closed: bool = False


class Other(FrozenModel):
    """Everything else: greetings, questions, ads, group rules."""

    kind: Literal["other"] = "other"


type Judgement = Annotated[Offer | Request | Update | Other, Field(discriminator="kind")]
