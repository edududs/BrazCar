from uuid import uuid4

from hypothesis import given
from hypothesis import strategies as st

from brazcar.search.application import SearchIndex
from brazcar.search.domain import SearchDocument, fold, matches

from . import contract_settings

words = st.sampled_from(["Brazlândia", "Incra 8", "Esplanada", "Rodoviária", "portão da escola", "UnB"])


def fresh(*texts: str) -> SearchDocument:
    """A document nobody else stored: examples do not get a clean index."""
    return SearchDocument(id=uuid4().hex, texts=texts)


class SearchIndexContract:
    """Subclass as `TestMyIndex` and implement `make_index`."""

    def make_index(self) -> SearchIndex:
        raise NotImplementedError

    async def test_terms_are_found_anywhere_ignoring_accents_and_case(self) -> None:
        index = self.make_index()
        braz, incra = fresh("Brazlândia", "Braz"), fresh("Incra 8, portão da escola")
        await index.put(braz)
        await index.put(incra)
        among = [braz.id, incra.id]

        assert await index.search("BRAZLANDIA", among=among) == {braz.id}
        assert await index.search("brazlan", among=among) == {braz.id}
        assert await index.search("portao incra", among=among) == {incra.id}
        assert await index.search("incra brazlandia", among=among) == frozenset()
        assert await index.search("  ", among=among) == {braz.id, incra.id}

    async def test_put_replaces_and_remove_forgets(self) -> None:
        index = self.make_index()
        document = fresh("Esplanada")
        await index.put(document)
        await index.put(SearchDocument(id=document.id, texts=("Rodoviária",)))

        assert await index.search("esplanada", among=[document.id]) == frozenset()
        assert await index.search("rodoviaria", among=[document.id]) == {document.id}
        await index.remove(document.id)
        await index.remove(document.id)  # twice is fine
        assert await index.search("", among=[document.id]) == frozenset()

    async def test_among_limits_the_answer(self) -> None:
        index = self.make_index()
        one, other = fresh("UnB"), fresh("UnB")
        await index.put(one)
        await index.put(other)

        assert await index.search("unb", among=[one.id]) == {one.id}
        assert await index.search("unb", among=[]) == frozenset()
        assert {one.id, other.id} <= await index.search("unb")

    @contract_settings
    @given(texts=st.lists(words, min_size=1, max_size=3), query=st.lists(words, max_size=2))
    async def test_the_index_agrees_with_the_domain_rule(self, texts: list[str], query: list[str]) -> None:
        index = self.make_index()
        document = fresh(*texts)
        await index.put(document)
        wanted = " ".join(query)

        found = await index.search(wanted, among=[document.id])

        assert (document.id in found) == matches(wanted, document.folded)
        assert document.folded == " ".join(fold(t) for t in texts)
