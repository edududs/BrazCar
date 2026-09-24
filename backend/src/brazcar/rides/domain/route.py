"""A ride is a line of stops in order, never an origin and a destination (D-013)."""

from collections.abc import Sequence
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from brazcar.shared.domain.model import FrozenModel

type PlaceId = Annotated[str, StringConstraints(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$", max_length=64)]
type StopText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
type Fare = Annotated[Decimal, Field(gt=0, max_digits=6, decimal_places=2)]


class CatalogStop(FrozenModel):
    kind: Literal["catalog"] = "catalog"
    place_id: PlaceId  # a reference into `places`, never the place itself (D-024)
    fare: Fare | None = None  # what it costs to come this far from the origin (D-131)


class FreeTextStop(FrozenModel):
    """ "Other": a stop the catalog does not know. Never promoted into the catalog by itself."""

    kind: Literal["other"] = "other"
    text: StopText
    fare: Fare | None = None


type Stop = Annotated[CatalogStop | FreeTextStop, Field(discriminator="kind")]
type Route = Annotated[tuple[Stop, ...], Field(min_length=2)]


def fares_of(route: Sequence[Stop]) -> tuple[Decimal, ...]:
    """Every fare the route names, in order. No rule ties one fare to the next (D-131)."""
    return tuple(stop.fare for stop in route if stop.fare is not None)


def price_from(route: Sequence[Stop], typed: Decimal) -> Decimal:
    """With fares, the ride costs the cheapest of them and the price stops being typed (D-131)."""
    fares = fares_of(route)
    return min(fares) if fares else typed
