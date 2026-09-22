from dataclasses import dataclass

from brazcar.places.domain import Catalog, Place, PlaceId, ResolvedPlace

from .ports import CatalogRepository


@dataclass(frozen=True, slots=True)
class SearchPlaces:
    catalog: CatalogRepository

    async def __call__(self, text: str = "") -> tuple[Place, ...]:
        return (await self.catalog.load()).search(text)


@dataclass(frozen=True, slots=True)
class ResolvePlace:
    catalog: CatalogRepository

    async def __call__(self, place_id: PlaceId) -> ResolvedPlace:
        return (await self.catalog.load()).resolve(place_id)


@dataclass(frozen=True, slots=True)
class SyncCatalog:
    catalog: CatalogRepository

    async def __call__(self, wanted: Catalog) -> bool:
        """Make the stored catalog equal to `wanted`. Tells whether anything had to change."""
        if await self.catalog.load() == wanted:
            return False
        await self.catalog.save(wanted)
        return True
