import pytest
from hypothesis import given
from hypothesis import strategies as st
from pydantic import ValidationError

from brazcar.places.domain import Catalog, Place, PlaceNotFoundError, search_key

from .strategies import catalogs

PLANO = Place(id="plano-piloto", name="Plano Piloto", aliases=("Plano",))
ESPLANADA = Place(
    id="esplanada", name="Esplanada", aliases=("Esplanada dos Ministérios",), parent_id=PLANO.id
)
RODOVIARIA = Place(id="rodoviaria", name="Rodoviária do Plano", parent_id=ESPLANADA.id)
BRAZLANDIA = Place(id="brazlandia", name="Brazlândia", aliases=("Braz",))
CATALOG = Catalog(places=(PLANO, ESPLANADA, RODOVIARIA, BRAZLANDIA))


def test_canonical_name_is_unique_whatever_the_accents() -> None:
    with pytest.raises(ValidationError, match="points to both"):
        Catalog(places=(BRAZLANDIA, Place(id="other", name="brazlandia")))


def test_an_alias_points_to_one_place_only() -> None:
    with pytest.raises(ValidationError, match="points to both"):
        Catalog(places=(BRAZLANDIA, Place(id="other", name="Outro", aliases=("BRAZ",))))


def test_an_alias_cannot_be_another_place_name() -> None:
    with pytest.raises(ValidationError, match="points to both"):
        Catalog(places=(BRAZLANDIA, Place(id="other", name="Outro", aliases=("Brazlândia",))))


def test_identifiers_are_unique() -> None:
    with pytest.raises(ValidationError, match="share an identifier"):
        Catalog(places=(BRAZLANDIA, BRAZLANDIA.evolve(name="Outra", aliases=())))


def test_parent_must_be_in_the_catalog() -> None:
    with pytest.raises(ValidationError, match="not in the catalog"):
        Catalog(places=(ESPLANADA,))


def test_filtering_by_a_place_reaches_every_level_beneath_it() -> None:
    resolved = CATALOG.resolve(PLANO.id)

    assert resolved.place == PLANO
    assert {place.id for place in resolved.descendants} == {ESPLANADA.id, RODOVIARIA.id}
    assert CATALOG.resolve(BRAZLANDIA.id).descendants == ()


def test_resolving_an_unknown_identifier_fails_loudly() -> None:
    with pytest.raises(PlaceNotFoundError):
        CATALOG.resolve("nowhere")


def test_search_finds_by_name_or_alias_without_accents() -> None:
    assert CATALOG.search("brazlandia") == (BRAZLANDIA,)
    assert CATALOG.search("MINISTERIOS") == (ESPLANADA,)
    assert CATALOG.search("xyz") == ()


def test_search_puts_the_best_match_first() -> None:
    assert CATALOG.search("plano") == (PLANO, RODOVIARIA)
    assert CATALOG.search("pla") == (PLANO, ESPLANADA, RODOVIARIA)


def test_blank_search_lists_the_whole_catalog_by_name() -> None:
    assert CATALOG.search("  ") == (BRAZLANDIA, ESPLANADA, PLANO, RODOVIARIA)


@given(catalog=catalogs(min_size=2), data=st.data())
def test_no_change_of_parent_can_close_a_loop(catalog: Catalog, data: st.DataObject) -> None:
    """Hanging a place under one of its own descendants is refused; anywhere else is accepted."""
    place = data.draw(st.sampled_from(catalog.places))
    new_parent = data.draw(st.sampled_from([other for other in catalog.places if other != place]))
    moved = tuple(p.evolve(parent_id=new_parent.id) if p == place else p for p in catalog.places)

    if new_parent in catalog.resolve(place.id).descendants:
        with pytest.raises(ValidationError, match="loops back"):
            Catalog(places=moved)
    else:
        assert place.id in {p.id for p in Catalog(places=moved).resolve(new_parent.id).descendants}


@given(catalog=catalogs())
def test_descendants_are_exactly_the_places_whose_ancestry_passes_here(catalog: Catalog) -> None:
    def ancestors(place: Place) -> set[str]:
        parent = catalog.get(place.parent_id) if place.parent_id else None
        return set() if parent is None else {parent.id} | ancestors(parent)

    for place in catalog.places:
        expected = {other.id for other in catalog.places if place.id in ancestors(other)}
        assert {found.id for found in catalog.resolve(place.id).descendants} == expected


@given(catalog=catalogs(min_size=1), data=st.data())
def test_every_name_and_alias_resolves_to_its_own_place(catalog: Catalog, data: st.DataObject) -> None:
    place = data.draw(st.sampled_from(catalog.places))
    text = data.draw(st.sampled_from([place.name, *place.aliases]))

    assert catalog.named(text) == place
    assert catalog.named(f"  {text.upper()} ") == place
    assert place in catalog.search(text)


@given(catalog=catalogs(), text=st.text(max_size=12))
def test_search_returns_exactly_the_places_with_a_matching_text(catalog: Catalog, text: str) -> None:
    wanted = search_key(text)

    found = catalog.search(text)

    matching = {p.id for p in catalog.places if any(wanted in key for key in p.search_keys)}
    assert {p.id for p in found} == matching
    assert len(found) == len(matching)


@given(catalog=catalogs())
def test_listing_order_does_not_matter(catalog: Catalog) -> None:
    assert Catalog(places=catalog.places[::-1]) == catalog
