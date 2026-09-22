"""Public, read-only view of the catalog. Writing is not an API concern in this step."""

from http import HTTPStatus
from typing import Self

from django.http import HttpRequest
from ninja import Router, Schema
from ninja.errors import HttpError

from brazcar.places.application import CatalogRepository, ResolvePlace, SearchPlaces
from brazcar.places.domain import Place, PlaceKind, PlaceNotFoundError


class PlaceOut(Schema):
    """What the API promises about a place, stated apart from the entity so it changes on purpose."""

    id: str
    name: str
    kind: PlaceKind
    aliases: list[str]
    parent_id: str | None

    @classmethod
    def of(cls, place: Place) -> Self:
        return cls(
            id=place.id,
            name=place.name,
            kind=place.kind,
            aliases=list(place.aliases),
            parent_id=place.parent_id,
        )


class ResolvedPlaceOut(Schema):
    place: PlaceOut
    descendants: list[PlaceOut]


def build_router(catalog: CatalogRepository) -> Router:
    router = Router(tags=["places"])
    search_places = SearchPlaces(catalog)
    resolve_place = ResolvePlace(catalog)

    @router.get("", response=list[PlaceOut], operation_id="search_places")
    async def search(request: HttpRequest, q: str = "") -> list[PlaceOut]:
        """Places whose name or alias contains `q`, accents and case ignored. Blank lists all."""
        return [PlaceOut.of(place) for place in await search_places(q)]

    @router.get("/{place_id}", response=ResolvedPlaceOut, operation_id="resolve_place")
    async def resolve(request: HttpRequest, place_id: str) -> ResolvedPlaceOut:
        """One place and everything beneath it in the hierarchy."""
        try:
            resolved = await resolve_place(place_id)
        except PlaceNotFoundError as error:
            raise HttpError(HTTPStatus.NOT_FOUND, str(error)) from error
        return ResolvedPlaceOut(
            place=PlaceOut.of(resolved.place),
            descendants=[PlaceOut.of(place) for place in resolved.descendants],
        )

    return router
