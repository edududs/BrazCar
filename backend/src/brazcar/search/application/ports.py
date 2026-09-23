from collections.abc import Collection
from typing import Protocol

from brazcar.search.domain import SearchDocument


class SearchIndex(Protocol):
    """A collection of documents findable by text. One index per kind of document."""

    async def put(self, document: SearchDocument) -> None:
        """Add the document, or replace the one with the same identifier."""
        ...

    async def remove(self, document_id: str) -> None:
        """Forget the document; unknown identifiers are ignored."""
        ...

    async def search(self, query: str, *, among: Collection[str] | None = None) -> frozenset[str]:
        """Identifiers of the documents that match `query` (see `matches`), within `among` if given."""
        ...
