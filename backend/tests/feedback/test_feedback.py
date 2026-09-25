from uuid import uuid4

import pytest
from pydantic import ValidationError

from brazcar.feedback.domain import (
    MESSAGE_LIMIT,
    AboutSomeoneOutsideComplaintError,
    Feedback,
    FeedbackKind,
)
from brazcar.shared.domain.phone import PhoneNumber

from .fakes import NOW

PHONE = PhoneNumber.parse("+5561999990001")


def _send(
    *,
    kind: FeedbackKind = FeedbackKind.SUGGESTION,
    message: str = "Queria filtrar por quem aceita Pix.",
    about_phone: PhoneNumber | None = None,
) -> Feedback:
    return Feedback.send(
        author_id=uuid4(), kind=kind, message=message, about_phone=about_phone, web_version="0.20.2", at=NOW
    )


def test_an_opinion_keeps_what_was_written_trimmed() -> None:
    feedback = _send(message="  Gostei do mural.  ", kind=FeedbackKind.PRAISE)

    assert feedback.message == "Gostei do mural."
    assert feedback.kind is FeedbackKind.PRAISE
    assert feedback.about_phone is None


@pytest.mark.parametrize("message", ["", "   ", "x" * (MESSAGE_LIMIT + 1)])
def test_an_empty_or_too_long_message_is_refused(message: str) -> None:
    with pytest.raises(ValidationError):
        _send(message=message)


def test_the_message_may_reach_the_limit_exactly() -> None:
    assert len(_send(message="x" * MESSAGE_LIMIT).message) == MESSAGE_LIMIT


def test_a_complaint_may_name_someone_by_phone() -> None:
    feedback = _send(kind=FeedbackKind.COMPLAINT, about_phone=PHONE)

    assert feedback.about_phone == PHONE


@pytest.mark.parametrize("kind", [FeedbackKind.SUGGESTION, FeedbackKind.PRAISE])
def test_only_a_complaint_names_someone(kind: FeedbackKind) -> None:
    with pytest.raises(AboutSomeoneOutsideComplaintError):
        _send(kind=kind, about_phone=PHONE)


def test_the_invariant_holds_even_without_the_factory() -> None:
    feedback = _send()

    with pytest.raises(ValidationError):
        feedback.evolve(about_phone=PHONE)
