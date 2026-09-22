import pytest

from brazcar.places.application import ResolvePlace, SearchPlaces, SyncCatalog
from brazcar.places.domain import Catalog, Place, PlaceNotFoundError

from .fakes import InMemoryCatalogRepository

PLANO = Place(id="plano-piloto", name="Plano Piloto")
ESPLANADA = Place(id="esplanada", name="Esplanada", parent_id=PLANO.id)
CATALOG = Catalog(places=(PLANO, ESPLANADA))


class SpyCatalogRepository(InMemoryCatalogRepository):
    saves = 0

    async def save(self, catalog: Catalog) -> None:
        self.saves += 1
        await super().save(catalog)


async def test_search_answers_from_the_stored_catalog() -> None:
    search = SearchPlaces(InMemoryCatalogRepository(CATALOG))

    assert await search("espla") == (ESPLANADA,)
    assert await search() == (ESPLANADA, PLANO)


async def test_resolve_brings_the_descendants() -> None:
    resolved = await ResolvePlace(InMemoryCatalogRepository(CATALOG))(PLANO.id)

    assert resolved.descendants == (ESPLANADA,)


async def test_resolve_of_an_unknown_place_is_an_error() -> None:
    with pytest.raises(PlaceNotFoundError):
        await ResolvePlace(InMemoryCatalogRepository(CATALOG))("nowhere")


async def test_sync_writes_once_and_then_has_nothing_to_do() -> None:
    repository = SpyCatalogRepository()
    sync = SyncCatalog(repository)

    assert await sync(CATALOG) is True
    assert await sync(CATALOG) is False
    assert await repository.load() == CATALOG
    assert repository.saves == 1
