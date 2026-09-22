from hypothesis import given

from brazcar.places.application import CatalogRepository
from brazcar.places.domain import Catalog, Place
from tests.places.strategies import catalogs

from . import contract_settings

ACCENTED = Catalog(
    places=(
        Place(id="brazlandia", name="Brazlândia", aliases=("Braz", "Brazlândia DF")),
        Place(id="rodoviaria", name="Rodoviária do Plano", parent_id="plano-piloto"),
        Place(id="plano-piloto", name="Plano Piloto"),
    )
)


class CatalogRepositoryContract:
    """Subclass as `TestMyRepository` and implement `make_repository`."""

    def make_repository(self) -> CatalogRepository:
        raise NotImplementedError

    @contract_settings
    @given(catalog=catalogs())
    async def test_saved_catalog_loads_back_equal(self, catalog: Catalog) -> None:
        repository = self.make_repository()

        await repository.save(catalog)

        assert await repository.load() == catalog

    @contract_settings
    @given(first=catalogs(), second=catalogs())
    async def test_last_save_replaces_the_catalog_whole(self, first: Catalog, second: Catalog) -> None:
        repository = self.make_repository()

        await repository.save(first)
        await repository.save(second)

        assert await repository.load() == second

    async def test_nothing_saved_loads_as_an_empty_catalog(self) -> None:
        assert await self.make_repository().load() == Catalog()

    async def test_accents_and_alias_order_survive_storage(self) -> None:
        repository = self.make_repository()

        await repository.save(ACCENTED)
        loaded = await repository.load()

        assert loaded == ACCENTED
        assert loaded.search("brazlandia") == (ACCENTED.get("brazlandia"),)

    async def test_names_and_aliases_can_trade_places_in_one_save(self) -> None:
        repository = self.make_repository()
        one, other = Place(id="one", name="Um", aliases=("Primeiro",)), Place(id="other", name="Outro")
        traded = Catalog(
            places=(one.evolve(name="Outro", aliases=()), other.evolve(name="Um", aliases=("Primeiro",)))
        )

        await repository.save(Catalog(places=(one, other)))
        await repository.save(traded)

        assert await repository.load() == traded
