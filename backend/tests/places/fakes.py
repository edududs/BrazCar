from brazcar.places.domain import Catalog


class InMemoryCatalogRepository:
    """`CatalogRepository` for use-case tests. Held to the same contract as the real one."""

    def __init__(self, catalog: Catalog | None = None) -> None:
        self._catalog = catalog or Catalog()

    async def load(self) -> Catalog:
        return self._catalog

    async def save(self, catalog: Catalog) -> None:
        self._catalog = catalog
