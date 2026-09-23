"""In-memory `SearchIndex`, held to the same contract as the Django one."""

from collections.abc import Collection

from brazcar.search.domain import SearchDocument, matches


class InMemorySearchIndex:
    def __init__(self) -> None:
        self.documents: dict[str, str] = {}

    async def put(self, document: SearchDocument) -> None:
        self.documents[document.id] = document.folded

    async def remove(self, document_id: str) -> None:
        self.documents.pop(document_id, None)

    async def search(self, query: str, *, among: Collection[str] | None = None) -> frozenset[str]:
        pool = self.documents if among is None else {i: t for i, t in self.documents.items() if i in among}
        return frozenset(i for i, text in pool.items() if matches(query, text))
