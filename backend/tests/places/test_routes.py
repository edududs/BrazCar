"""The routes against the real composition: ninja, use cases, ORM, database."""

from http import HTTPStatus

import pytest
from django.test.client import AsyncClient

from brazcar.places.adapters.repository import DjangoCatalogRepository
from brazcar.places.domain import Catalog, Place

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.usefixtures("worker_thread_connections_closed", "stored_catalog"),
]


def _payload(place_id: str, name: str, *aliases: str, parent_id: str | None = None) -> dict[str, object]:
    return {"id": place_id, "name": name, "kind": "area", "aliases": list(aliases), "parent_id": parent_id}


BRAZLANDIA = _payload("brazlandia", "Brazlândia", "Braz")
ESPLANADA = _payload("esplanada", "Esplanada", parent_id="plano-piloto")
PLANO = _payload("plano-piloto", "Plano Piloto")


@pytest.fixture
async def stored_catalog() -> None:
    places = (
        Place(id="brazlandia", name="Brazlândia", aliases=("Braz",)),
        Place(id="plano-piloto", name="Plano Piloto"),
        Place(id="esplanada", name="Esplanada", parent_id="plano-piloto"),
    )
    await DjangoCatalogRepository().save(Catalog(places=places))


async def test_listing_needs_no_login_and_shows_no_geometry() -> None:
    response = await AsyncClient().get("/api/places")

    assert response.status_code == HTTPStatus.OK
    assert response.json() == [BRAZLANDIA, ESPLANADA, PLANO]


async def test_search_ignores_accents_and_case() -> None:
    response = await AsyncClient().get("/api/places", {"q": "BRAZLANDIA"})

    assert response.json() == [BRAZLANDIA]


async def test_resolving_a_place_brings_what_is_beneath_it() -> None:
    response = await AsyncClient().get("/api/places/plano-piloto")

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {"place": PLANO, "descendants": [ESPLANADA]}


async def test_an_unknown_place_is_not_found() -> None:
    response = await AsyncClient().get("/api/places/nowhere")

    assert response.status_code == HTTPStatus.NOT_FOUND
