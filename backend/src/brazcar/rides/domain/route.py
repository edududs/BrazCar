"""A ride is a line of stops in order, never an origin and a destination (D-013)."""

from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from brazcar.shared.domain.model import FrozenModel

type PlaceId = Annotated[str, StringConstraints(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$", max_length=64)]
type StopText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


class CatalogStop(FrozenModel):
    kind: Literal["catalog"] = "catalog"
    place_id: PlaceId  # a reference into `places`, never the place itself (D-024)


class FreeTextStop(FrozenModel):
    """ "Other": a stop the catalog does not know. Never promoted into the catalog by itself."""

    kind: Literal["other"] = "other"
    text: StopText


type Stop = Annotated[CatalogStop | FreeTextStop, Field(discriminator="kind")]
type Route = Annotated[tuple[Stop, ...], Field(min_length=2)]
