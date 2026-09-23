"""What "matches" means, in one place, so every adapter answers the same.

A query matches a document when every one of its terms is contained in the document's text,
accents, case and extra spaces ignored: "incra 8" finds "Incra 8, portão da escola", and
"brazlan" finds "Brazlândia".
"""

import unicodedata
from dataclasses import dataclass


def fold(text: str) -> str:
    """The text with no accents, no case and single spaces."""
    decomposed = unicodedata.normalize("NFKD", text)
    unmarked = "".join(char for char in decomposed if not unicodedata.combining(char))
    return " ".join(unmarked.casefold().split())


def terms(query: str) -> tuple[str, ...]:
    """The folded words of a query. A blank query has none, and matches everything."""
    return tuple(fold(query).split())


def matches(query: str, folded_text: str) -> bool:
    return all(term in folded_text for term in terms(query))


@dataclass(frozen=True, slots=True)
class SearchDocument:
    """Something to be found: an identifier the caller owns and the texts it can be found by."""

    id: str
    texts: tuple[str, ...]

    @property
    def folded(self) -> str:
        return " ".join(folded for text in self.texts if (folded := fold(text)))
