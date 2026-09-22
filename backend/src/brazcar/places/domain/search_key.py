"""The one definition of "the same text": no accents, no case, no stray whitespace."""

import unicodedata
from typing import NewType

SearchKey = NewType("SearchKey", str)


def search_key(text: str) -> SearchKey:
    decomposed = unicodedata.normalize("NFKD", text)
    unmarked = "".join(char for char in decomposed if not unicodedata.combining(char))
    return SearchKey(" ".join(unmarked.casefold().split()))
