from asgiref.sync import sync_to_async
from django.db import transaction

from brazcar.places.domain import Catalog, Place, PlaceKind

from .models import PlaceAliasModel, PlaceModel


class DjangoCatalogRepository:
    """`CatalogRepository` over the ORM: one thread hop and one transaction per call (ADR-0008)."""

    async def load(self) -> Catalog:
        return await sync_to_async(_load)()

    async def save(self, catalog: Catalog) -> None:
        await sync_to_async(_save)(catalog)


def _load() -> Catalog:
    rows = PlaceModel.objects.prefetch_related("aliases")
    return Catalog(places=tuple(_to_entity(row) for row in rows))


@transaction.atomic
def _save(catalog: Catalog) -> None:
    # The aggregate is small and saved whole, so replacing every row is the simplest correct write:
    # no ordering puzzle when two places swap names or an alias moves from one place to another.
    PlaceAliasModel.objects.all().delete()
    PlaceModel.objects.update(parent=None)
    PlaceModel.objects.all().delete()
    PlaceModel.objects.bulk_create(_to_row(place) for place in catalog.places)
    children = [
        PlaceModel(id=place.id, parent_id=place.parent_id) for place in catalog.places if place.parent_id
    ]
    PlaceModel.objects.bulk_update(children, ["parent"])
    PlaceAliasModel.objects.bulk_create(
        PlaceAliasModel(place_id=place.id, text=alias, position=position)
        for place in catalog.places
        for position, alias in enumerate(place.aliases)
    )


def _to_entity(row: PlaceModel) -> Place:
    return Place(
        id=row.id,
        name=row.name,
        kind=PlaceKind(row.kind),
        aliases=tuple(alias.text for alias in row.aliases.all()),
        parent_id=row.parent_id,
    )


def _to_row(place: Place) -> PlaceModel:
    """The row without its parent: parents are linked once every place exists."""
    return PlaceModel(id=place.id, name=place.name, kind=place.kind.value)
