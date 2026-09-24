"""The data migrations of D-138: rows written before a WhatsApp address got its ninth digit back.

`PhoneNumber.from_jid_user` restores the digit on every way in; the phones stored before must agree
with it, or a repost, a block or a lookup by phone would miss them. Each context migrates its own
columns and asks this module which values change, so the rule stays the value object's.
"""

import logging
from collections.abc import Iterable
from dataclasses import dataclass

from brazcar.shared.domain.phone import InvalidPhoneNumberError, PhoneNumber

log = logging.getLogger("brazcar.migrations")


@dataclass(frozen=True, slots=True)
class Rewrite:
    changes: dict[str, str]  # stored value -> canonical value, only for the values that change
    unreadable: tuple[str, ...]  # stored values that are no phone at all: left alone, and reported


def canonical_jid_users(stored: Iterable[str]) -> Rewrite:
    changes: dict[str, str] = {}
    unreadable: list[str] = []
    for value in set(stored):
        try:
            canonical = PhoneNumber.from_jid_user(value).jid_user()
        except InvalidPhoneNumberError:
            unreadable.append(value)
            continue
        if canonical != value:
            changes[value] = canonical
    return Rewrite(changes=changes, unreadable=tuple(sorted(unreadable)))


def report(column: str, rewrite: Rewrite) -> None:
    """One line per column in the migration log, which the operator reads after a deploy."""
    log.warning(
        "ninth digit (D-138): %s: %d old address(es) found, %d unreadable",
        column,
        len(rewrite.changes),
        len(rewrite.unreadable),
    )
