"""`RideSearch` over the `search` context's index (D-100, D-101).

A ride is found by the text of its stops. A catalog stop brings its name, its aliases and the
names of every place above it, so "Plano Piloto" finds a ride through "Esplanada" and "Braz" finds
"Brazlândia"; an "other" stop brings its own text.
"""

from collections.abc import Collection
from uuid import UUID

from brazcar.places.application import CatalogRepository
from brazcar.places.domain import Catalog
from brazcar.rides.domain import CatalogStop, RideId, RideOffer
from brazcar.search.application import SearchIndex
from brazcar.search.domain import SearchDocument

NAMESPACE = "rides"


class IndexedRideSearch:
    def __init__(self, index: SearchIndex, catalog: CatalogRepository) -> None:
        self._index = index
        self._catalog = catalog

    async def index(self, ride: RideOffer) -> None:
        catalog = await self._catalog.load()
        texts: list[str] = []
        for stop in ride.route:
            if isinstance(stop, CatalogStop):
                texts.extend(_place_texts(catalog, stop.place_id))
            else:
                texts.append(stop.text)
        await self._index.put(SearchDocument(id=str(ride.id), texts=tuple(texts)))

    async def forget(self, ride_id: RideId) -> None:
        await self._index.remove(str(ride_id))

    async def matching(self, text: str, among: Collection[RideId]) -> frozenset[RideId]:
        found = await self._index.search(text, among=[str(ride_id) for ride_id in among])
        return frozenset(UUID(ride_id) for ride_id in found)


def _place_texts(catalog: Catalog, place_id: str) -> list[str]:
    """The place's own words and its ancestors' names; the identifier if the catalog lost it."""
    place = catalog.get(place_id)
    if place is None:
        return [place_id]
    texts = [place.name, *place.aliases]
    parent_id = place.parent_id
    while parent_id is not None and (parent := catalog.get(parent_id)) is not None:
        texts.append(parent.name)
        parent_id = parent.parent_id
    return texts
