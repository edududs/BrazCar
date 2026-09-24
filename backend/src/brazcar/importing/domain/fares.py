"""Which stop each "R$ 9,00 → Aeroporto" belongs to (D-131).

The interpreter returns pairs of words and value; tying a pair to a stop is code's job, like every
other anchoring in this context (ADR-0016). A pair is dropped when its words name no stop, name
more than one, land on the stop the ride leaves from, or carry a value the message never wrote:
a fare read wrong would price the whole ride wrong, and a ride with no fares still works.
"""

from decimal import Decimal

from .acceptance import ResolvedStop
from .judgement import OfferFare
from .text_key import digit_tokens, text_key


def attach_fares(
    stops: tuple[ResolvedStop, ...], fares: tuple[OfferFare, ...], text: str
) -> tuple[ResolvedStop, ...]:
    """The same stops, each with the fare the message gave it, when one can be tied to it for sure."""
    if not fares:
        return stops
    digits = digit_tokens(text)
    keys = [text_key(stop.text) for stop in stops]
    found: dict[int, Decimal] = {}
    for fare in fares:
        index = _only_stop(keys, text_key(fare.stop))
        # Index zero is where the ride leaves from, so it has no fare; a stop already taken by
        # another pair is ambiguous and both are left alone.
        if index is None or index == 0 or index in found:
            continue
        if not _written(digits, fare.price):
            continue
        found[index] = fare.price
    return tuple(
        stop if index not in found else stop.evolve(fare=found[index]) for index, stop in enumerate(stops)
    )


def _only_stop(keys: list[str], wanted: str) -> int | None:
    """The one stop those words name: the same words, or the only stop that contains them whole."""
    if not wanted:
        return None
    same = [index for index, key in enumerate(keys) if key == wanted]
    if same:
        return same[0] if len(same) == 1 else None
    within = [index for index, key in enumerate(keys) if f" {key} ".find(f" {wanted} ") >= 0]
    return within[0] if len(within) == 1 else None


def _written(digits: frozenset[str], price: Decimal) -> bool:
    """The reais of the value appear in the message, as written or zero-padded ("7" and "07")."""
    reais = int(price)
    return str(reais) in digits or f"{reais:02d}" in digits
