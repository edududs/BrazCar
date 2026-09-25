"""Whether a judged candidate becomes a ride, and with what (D-116). Pure: no clock, no catalog."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from brazcar.shared.domain.model import FrozenModel

from .candidate import Rejected, RejectReason
from .checks import Checks
from .judgement import Judgement, Offer, Payment

DEFAULT_SEATS = 2
DEFAULT_PRICE = Decimal("7.00")
DEFAULT_PAYMENT: frozenset[Payment] = frozenset({"cash", "pix"})
RIDE_SEAT_CAP = 4  # mirrors `rides.domain.ride.MAX_SEATS` (D-142). Duplicated, not imported: a
# context only imports `shared` (D-075); a message may still say more, so the accepted ride clamps.

type PlaceId = Annotated[str, StringConstraints(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$", max_length=64)]
type StopText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


class ResolvedStop(FrozenModel):
    """A stop as the catalog saw it: a place it knows, or the words as written (D-013)."""

    text: StopText
    place_id: PlaceId | None = None
    fare: Annotated[Decimal, Field(gt=0, max_digits=6, decimal_places=2)] | None = None

    @property
    def known(self) -> bool:
        return self.place_id is not None


class RideDraft(FrozenModel):
    """What `importing` hands to `rides`; the adapter turns it into that context's types."""

    stops: Annotated[tuple[ResolvedStop, ...], Field(min_length=2)]
    departure_at: datetime
    seats: Annotated[int, Field(ge=1, le=RIDE_SEAT_CAP)]
    price: Annotated[Decimal, Field(gt=0)]
    payment_methods: Annotated[frozenset[Payment], Field(min_length=1)]


class Accept(FrozenModel):
    kind: Literal["accept"] = "accept"
    draft: RideDraft
    confidence: float


type Decision = Accept | Rejected


def decide(
    judgement: Judgement,
    *,
    departure_at: datetime | None,
    stops: tuple[ResolvedStop, ...],
    checks: Checks | None,
    threshold: float,
) -> Decision:
    """`departure_at`, `stops` and `checks` were resolved by the caller from an `Offer`; None otherwise."""
    if not isinstance(judgement, Offer) or checks is None:
        return Rejected(reason=RejectReason.NOT_AN_OFFER)
    confidence = checks.confidence
    if departure_at is None:
        return Rejected(reason=RejectReason.NO_TIME, confidence=confidence)
    if judgement.seats == 0:
        return Rejected(reason=RejectReason.NO_SEATS, confidence=confidence)
    if len(stops) < 2:  # noqa: PLR2004 - where it leaves from and where it goes (D-013)
        return Rejected(reason=RejectReason.FEW_STOPS, confidence=confidence)
    if confidence < threshold:
        return Rejected(reason=RejectReason.LOW_CONFIDENCE, confidence=confidence)
    seats = judgement.seats if judgement.seats is not None else DEFAULT_SEATS
    return Accept(
        draft=RideDraft(
            stops=stops,
            departure_at=departure_at,
            seats=min(seats, RIDE_SEAT_CAP),  # a passenger car has no fifth seat (D-142)
            price=_price(stops, judgement.price),
            payment_methods=judgement.payment_methods or DEFAULT_PAYMENT,
        ),
        confidence=confidence,
    )


def _price(stops: tuple[ResolvedStop, ...], said: Decimal | None) -> Decimal:
    """The cheapest fare the stops carry; failing that, what the message said; failing that, R$ 7,00."""
    fares = [stop.fare for stop in stops if stop.fare is not None]
    if fares:
        return min(fares)
    return said if said is not None else DEFAULT_PRICE
