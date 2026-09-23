"""`SearchIndex` over a table: folded text and one `contains` per term, the same on every database."""

from collections.abc import Collection

from asgiref.sync import sync_to_async
from django.db import transaction

from brazcar.search.domain import SearchDocument, terms

from .models import SearchEntryModel


class DjangoSearchIndex:
    def __init__(self, namespace: str) -> None:
        self._namespace = namespace

    async def put(self, document: SearchDocument) -> None:
        await sync_to_async(_put)(self._namespace, document)

    async def remove(self, document_id: str) -> None:
        await SearchEntryModel.objects.filter(namespace=self._namespace, document_id=document_id).adelete()

    async def search(self, query: str, *, among: Collection[str] | None = None) -> frozenset[str]:
        return await sync_to_async(_search)(self._namespace, query, among)


@transaction.atomic
def _put(namespace: str, document: SearchDocument) -> None:
    SearchEntryModel.objects.update_or_create(
        namespace=namespace, document_id=document.id, defaults={"text": document.folded}
    )


def _search(namespace: str, query: str, among: Collection[str] | None) -> frozenset[str]:
    entries = SearchEntryModel.objects.filter(namespace=namespace)
    if among is not None:
        entries = entries.filter(document_id__in=list(among))
    for term in terms(query):  # both sides folded, so a plain `contains` is accent and case blind
        entries = entries.filter(text__contains=term)
    return frozenset(entries.values_list("document_id", flat=True))
