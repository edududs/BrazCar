from enum import StrEnum
from typing import Annotated, Self

from pydantic import AfterValidator, StringConstraints, model_validator

from brazcar.shared.domain.model import FrozenModel

from .search_key import SearchKey, search_key


class PlaceKind(StrEnum):
    AREA = "area"
    POINT = "point"


def _searchable(text: str) -> str:
    if not search_key(text):
        message = "a place name needs at least one letter or digit to be searchable"
        raise ValueError(message)
    return text


# A stable slug: readable in the seed and in the board filter URL, untouched by a rename.
type PlaceId = Annotated[str, StringConstraints(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$", max_length=64)]
type PlaceName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=80),
    AfterValidator(_searchable),
]


class Place(FrozenModel):
    id: PlaceId
    name: PlaceName
    kind: PlaceKind = PlaceKind.AREA
    aliases: tuple[PlaceName, ...] = ()
    parent_id: PlaceId | None = None
    geometry: None = None  # reserved for the map; how to model an area is postponed (D-025)

    @model_validator(mode="after")
    def _check(self) -> Self:
        if self.parent_id == self.id:
            message = f"{self.id}: a place cannot be its own parent"
            raise ValueError(message)
        keys = self.search_keys
        if len(set(keys)) != len(keys):
            message = f"{self.id}: aliases repeat each other or the name"
            raise ValueError(message)
        return self

    @property
    def search_keys(self) -> tuple[SearchKey, ...]:
        """Keys of every way this place is written, the canonical name first."""
        return tuple(search_key(text) for text in (self.name, *self.aliases))
