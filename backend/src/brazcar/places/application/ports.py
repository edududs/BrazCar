from typing import Protocol

from brazcar.places.domain import Catalog


class CatalogRepository(Protocol):
    async def load(self) -> Catalog:
        """The catalog as last saved; an empty one if nothing ever was."""
        ...

    async def save(self, catalog: Catalog) -> None:
        """Replace the stored catalog with this one, whole, or change nothing."""
        ...
