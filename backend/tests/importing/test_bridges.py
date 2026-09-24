"""The stop resolver against the catalog: exact names and aliases, details in parentheses, pairs."""

from brazcar.importing.adapters.bridges import CatalogStopResolver
from brazcar.importing.domain import ResolvedStop
from brazcar.places.domain import Catalog, Place
from tests.places.fakes import InMemoryCatalogRepository

CATALOG = Catalog(
    places=(
        Place(id="brazlandia", name="Brazlândia", aliases=("Braz",)),
        Place(id="vila-sao-jose", name="Vila São José", aliases=("Vila",), parent_id="brazlandia"),
        Place(id="veredas", name="Veredas", parent_id="brazlandia"),
        Place(id="rodeador", name="Rodeador", parent_id="brazlandia"),
        Place(id="estrutural", name="Estrutural"),
    )
)


async def test_names_aliases_details_and_pairs_resolve_and_the_rest_stays_as_written() -> None:
    resolver = CatalogStopResolver(InMemoryCatalogRepository(CATALOG))

    resolved = await resolver.resolve(
        ("braz", "Veredas (até o CEF 01)", "Vila/Veredas", "Fassincra ou Rodeador", "33/34", "Esplanada")
    )

    assert resolved == (
        ResolvedStop(text="braz", place_id="brazlandia"),
        ResolvedStop(text="Veredas (até o CEF 01)", place_id="veredas"),
        ResolvedStop(text="Vila", place_id="vila-sao-jose"),
        ResolvedStop(text="Veredas", place_id="veredas"),
        ResolvedStop(text="Fassincra ou Rodeador", place_id=None),  # one half unknown: as written
        ResolvedStop(text="33/34", place_id=None),
        ResolvedStop(text="Esplanada", place_id=None),
    )
