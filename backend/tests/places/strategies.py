"""Hypothesis strategies for the places domain. Every generated catalog is valid."""

from hypothesis import strategies as st

from brazcar.places.domain import Catalog, Place, PlaceKind, search_key

_SLUG_WORD = st.text("abcdefghijklmnopqrstuvwxyz0123456789", min_size=1, max_size=6)
place_ids = st.lists(_SLUG_WORD, min_size=1, max_size=3).map("-".join)

# Accents, mixed case and padding are the point: they must never change which place a text names.
place_names = (
    st.text("aáàãâcçeéêiíoóôõuúAÁÃCÇEÉIÍOÓÕUÚ bdfgz0123456789", min_size=1, max_size=24)
    .map(str.strip)
    .filter(search_key)
)


@st.composite
def catalogs(draw: st.DrawFn, *, min_size: int = 0, max_size: int = 8) -> Catalog:
    ids = draw(st.lists(place_ids, min_size=min_size, max_size=max_size, unique=True))
    texts = draw(
        st.lists(place_names, min_size=len(ids), max_size=len(ids) * 3, unique_by=search_key),
    )
    names, spare = texts[: len(ids)], texts[len(ids) :]
    alias_owner = [draw(st.integers(0, len(ids) - 1)) for _ in spare]
    places: list[Place] = []
    for index, (place_id, name) in enumerate(zip(ids, names, strict=True)):
        # A parent is always an earlier place, so the result is a forest: no loop can form.
        parent = draw(st.none() | st.sampled_from(ids[:index])) if index else None
        aliases = tuple(text for text, owner in zip(spare, alias_owner, strict=True) if owner == index)
        kind = draw(st.sampled_from(PlaceKind))
        places.append(Place(id=place_id, name=name, kind=kind, aliases=aliases, parent_id=parent))
    return Catalog(places=tuple(draw(st.permutations(places))))
