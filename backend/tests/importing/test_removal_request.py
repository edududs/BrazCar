"""The removal request without any adapter: what it holds, and how a decision is taken once (D-172)."""

from datetime import UTC, datetime, timedelta

import pytest
from hypothesis import given
from hypothesis import strategies as st
from pydantic import ValidationError

from brazcar.importing.domain import (
    NOTE_LIMIT,
    Approved,
    Pending,
    Refused,
    RemovalAlreadyDecidedError,
    RemovalRequest,
)
from brazcar.shared.domain.phone import PhoneNumber

ASKED = datetime(2026, 9, 26, 9, 0, tzinfo=UTC)
ZE = PhoneNumber.parse("(61) 99999-0009")

type Action = tuple[str, timedelta]
actions = st.lists(
    st.tuples(
        st.sampled_from(["approve", "refuse"]), st.integers(0, 10_000).map(lambda m: timedelta(minutes=m))
    ),
    max_size=6,
)


def asked(note: str | None = None) -> RemovalRequest:
    return RemovalRequest.open(phone=ZE, note=note, at=ASKED)


def apply(request: RemovalRequest, action: Action) -> RemovalRequest:
    verb, after = action
    now = ASKED + after
    return request.approve(now) if verb == "approve" else request.refuse(now)


def test_a_new_request_is_pending_with_its_note_trimmed() -> None:
    request = asked("  Não autorizei.  ")

    assert request.decision == Pending()
    assert request.is_pending
    assert request.note == "Não autorizei."
    assert request.requested_at == ASKED


@pytest.mark.parametrize("note", [None, "", "   \n"])
def test_a_blank_note_is_no_note(note: str | None) -> None:
    assert asked(note).note is None


def test_any_valid_number_is_taken_as_the_importing_takes_it() -> None:
    """A landline or a number from abroad: being in the group proves it has WhatsApp (D-137)."""
    for raw in ("+14155552671", "(61) 3333-4444"):
        assert RemovalRequest.open(phone=PhoneNumber.parse(raw), note=None, at=ASKED).phone.e164()


def test_the_note_has_a_ceiling_and_no_nul() -> None:
    assert asked("a" * NOTE_LIMIT).note == "a" * NOTE_LIMIT
    with pytest.raises(ValidationError):
        asked("a" * (NOTE_LIMIT + 1))
    with pytest.raises(ValidationError):
        asked("antes\x00depois")


def test_a_decision_never_precedes_the_request() -> None:
    with pytest.raises(ValidationError):
        asked().approve(ASKED - timedelta(minutes=1))


@given(actions)
def test_the_first_decision_stands(history: list[Action]) -> None:
    """Whatever comes after: the same decision again changes nothing, the opposite one is refused."""
    request = asked()
    first: RemovalRequest | None = None
    for action in history:
        if first is None:
            request = apply(request, action)
            first = request
            continue
        same = (action[0] == "approve") == isinstance(first.decision, Approved)
        if same:
            assert apply(request, action) == first
        else:
            with pytest.raises(RemovalAlreadyDecidedError):
                apply(request, action)
    if first is None:
        assert request.is_pending
    else:
        assert request == first
        assert isinstance(first.decision, Approved | Refused)
        assert first.decision.at == ASKED + history[0][1]
        assert (first.phone, first.id, first.note) == (ZE, request.id, request.note)
