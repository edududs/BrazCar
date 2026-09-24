"""Two messages with the same key are the same posting (D-113): reposts differ only in noise."""

import unicodedata


def text_key(text: str) -> str:
    """No accents, no case, only letters, digits and single spaces. Emoji and punctuation are noise."""
    decomposed = unicodedata.normalize("NFKD", text)
    kept = (char if char.isalnum() else " " for char in decomposed if not unicodedata.combining(char))
    return " ".join("".join(kept).casefold().split())


def digit_tokens(text: str) -> frozenset[str]:
    """Every run of digits in the text, as written: "19:30" gives {"19", "30"}; "03" stays "03"."""
    return frozenset(token for token in text_key(text).replace("h", " ").split() if token.isdigit())
