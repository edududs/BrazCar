"""Spotting a phone, an e-mail or a plate inside free text, in one place for every rule (D-128, D-129).

The importing redacts what it found in a group message before the words reach the board; the
publishing form refuses the same things so the phone only ever leaves by the contact route (D-031).
Both read this module, so they never disagree on what personal data looks like.
"""

import re

MASK = "[…]"

_PHONE = re.compile(
    r"(?<![\d.,:])"  # not the tail of a price, a time or a longer number
    r"(?:\+?55[\s.-]?)?"  # country code, optional
    r"\(?\d{2}\)?[\s.-]?"  # area code, with or without parentheses
    r"9?[\s.-]?\d{4}[\s.-]?\d{4}"  # eight or nine digits, in the usual groupings
    r"(?![\d.,:])"
)
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", re.UNICODE)
_PLATE = re.compile(r"(?<![A-Za-z0-9])[A-Za-z]{3}[\s-]?\d[A-Za-z0-9]\d{2}(?![A-Za-z0-9])")
_CPF = re.compile(r"(?<!\d)\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d)")

_PATTERNS = (_EMAIL, _CPF, _PHONE, _PLATE)


def has_personal_data(text: str) -> bool:
    return any(pattern.search(text) for pattern in _PATTERNS)


def redact_personal_data(text: str, mask: str = MASK) -> str:
    """The same text with every phone, e-mail, CPF and plate replaced by `mask`."""
    for pattern in _PATTERNS:
        text = pattern.sub(mask, text)
    return text
