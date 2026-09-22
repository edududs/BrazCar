"""The aggregate. Its rules span places, so the whole catalog is the consistency boundary."""

from functools import cached_property
from typing import Self

from pydantic import field_validator, model_validator

from brazcar.shared.domain.model import FrozenModel

from .errors import PlaceNotFoundError
from .place import Place, PlaceId
from .search_key import SearchKey, search_key

_EXACT, _PREFIX, _INSIDE = range(3)


class ResolvedPlace(FrozenModel):
    """A place with everything beneath it: filtering by "Plano Piloto" must find "Esplanada"."""

    place: Place
    descendants: tuple[Place, ...]


class Catalog(FrozenModel):
    places: tuple[Place, ...] = ()

    @field_validator("places")
    @classmethod
    def _in_canonical_order(cls, places: tuple[Place, ...]) -> tuple[Place, ...]:
        """A catalog is a set: two with the same places are equal, however they were listed."""
        return tuple(sorted(places, key=lambda place: place.id))

    @model_validator(mode="after")
    def _check(self) -> Self:
        if len(self._by_id) != len(self.places):
            message = "two places share an identifier"
            raise ValueError(message)
        self._check_each_text_points_to_one_place()
        for place in self.places:
            self._check_ancestry(place)
        return self

    def get(self, place_id: PlaceId) -> Place | None:
        return self._by_id.get(place_id)

    def named(self, text: str) -> Place | None:
        """The one place written exactly like `text`, by canonical name or alias."""
        return self._by_key.get(search_key(text))

    def search(self, text: str) -> tuple[Place, ...]:
        """Places whose name or an alias contains `text`, best match first. Blank text lists all."""
        wanted = search_key(text)
        ranked = [(rank, place) for place in self.places if (rank := _rank(place, wanted)) is not None]
        ranked.sort(key=lambda pair: (pair[0], search_key(pair[1].name)))
        return tuple(place for _, place in ranked)

    def resolve(self, place_id: PlaceId) -> ResolvedPlace:
        place = self.get(place_id)
        if place is None:
            raise PlaceNotFoundError(place_id)
        descendants: list[Place] = []
        frontier = [place.id]
        while frontier:
            children = [child for parent_id in frontier for child in self._children.get(parent_id, ())]
            descendants.extend(children)
            frontier = [child.id for child in children]
        return ResolvedPlace(place=place, descendants=tuple(descendants))

    @cached_property
    def _by_id(self) -> dict[PlaceId, Place]:
        return {place.id: place for place in self.places}

    @cached_property
    def _by_key(self) -> dict[SearchKey, Place]:
        return {key: place for place in self.places for key in place.search_keys}

    @cached_property
    def _children(self) -> dict[PlaceId, list[Place]]:
        children: dict[PlaceId, list[Place]] = {}
        for place in self.places:
            if place.parent_id is not None:
                children.setdefault(place.parent_id, []).append(place)
        return children

    def _check_each_text_points_to_one_place(self) -> None:
        owners: dict[SearchKey, PlaceId] = {}
        for place in self.places:
            for key in place.search_keys:
                owner = owners.setdefault(key, place.id)
                if owner != place.id:
                    message = f"{key!r} points to both {owner} and {place.id}"
                    raise ValueError(message)

    def _check_ancestry(self, place: Place) -> None:
        seen = {place.id}
        current = place
        while current.parent_id is not None:
            parent = self._by_id.get(current.parent_id)
            if parent is None:
                message = f"{current.id}: parent {current.parent_id} is not in the catalog"
                raise ValueError(message)
            if parent.id in seen:
                message = f"{place.id}: the hierarchy loops back through {parent.id}"
                raise ValueError(message)
            seen.add(parent.id)
            current = parent


def _rank(place: Place, wanted: SearchKey) -> int | None:
    ranks = [
        _EXACT if key == wanted else _PREFIX if key.startswith(wanted) else _INSIDE
        for key in place.search_keys
        if wanted in key
    ]
    return min(ranks, default=None)
