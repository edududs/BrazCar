import pytest
from pydantic import ValidationError

from brazcar.places.domain import Place, PlaceKind, search_key


def test_search_key_ignores_accents_case_and_spacing() -> None:
    assert search_key("  Brazlândia ") == search_key("BRAZLANDIA") == "brazlandia"
    assert search_key("Rodoviária   do Plano") == "rodoviaria do plano"


def test_a_place_is_an_area_without_aliases_parent_or_geometry_by_default() -> None:
    place = Place(id="esplanada", name="Esplanada")

    assert place.kind is PlaceKind.AREA
    assert place.aliases == ()
    assert place.parent_id is None
    assert place.geometry is None


def test_name_is_trimmed() -> None:
    assert Place(id="esplanada", name="  Esplanada ").name == "Esplanada"


@pytest.mark.parametrize("bad_id", ["", "Esplanada", "plano piloto", "-plano", "plano--piloto", "ação"])
def test_identifier_must_be_a_slug(bad_id: str) -> None:
    with pytest.raises(ValidationError):
        Place(id=bad_id, name="Esplanada")


@pytest.mark.parametrize("bad_name", ["", "   ", "́́", "x" * 81])
def test_name_must_be_searchable_text_of_sane_length(bad_name: str) -> None:
    with pytest.raises(ValidationError):
        Place(id="esplanada", name=bad_name)


@pytest.mark.parametrize("aliases", [("Braz", "braz"), ("Brazlandia",), ("",)])
def test_aliases_must_add_something(aliases: tuple[str, ...]) -> None:
    with pytest.raises(ValidationError):
        Place(id="brazlandia", name="Brazlândia", aliases=aliases)


def test_a_place_cannot_be_its_own_parent() -> None:
    with pytest.raises(ValidationError):
        Place(id="esplanada", name="Esplanada", parent_id="esplanada")


def test_geometry_has_no_representable_value_yet() -> None:
    with pytest.raises(ValidationError):
        Place.model_validate({"id": "esplanada", "name": "Esplanada", "geometry": {"lat": -15.8}})
