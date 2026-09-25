from datetime import timedelta
from uuid import UUID, uuid4

import pytest

from brazcar.feedback.application import FeedbackRules, ReadFeedback, SendFeedback
from brazcar.feedback.domain import FeedbackKind, FeedbackLimitError
from brazcar.shared.domain.phone import InvalidPhoneNumberError
from tests.shared.fakes import InMemoryRateLimiter

from .fakes import NOW, FixedClock, InMemoryFeedbackBox

RULES = FeedbackRules(limit=2, window=timedelta(hours=24))


def _send_feedback(clock: FixedClock | None = None) -> tuple[SendFeedback, InMemoryFeedbackBox, FixedClock]:
    clock = clock or FixedClock()
    box = InMemoryFeedbackBox()
    return SendFeedback(box, InMemoryRateLimiter(clock), clock, RULES), box, clock


async def test_a_complaint_keeps_the_phone_in_e164_as_typed() -> None:
    send, box, _ = _send_feedback()
    author = uuid4()

    kept = await send(
        author,
        kind=FeedbackKind.COMPLAINT,
        message="Cobrou mais do que o combinado.",
        about_phone="(61) 99999-0001",
        web_version="0.20.2",
    )

    assert box.kept == [kept]
    assert kept.author_id == author
    assert kept.at == NOW
    assert kept.about_phone is not None
    assert kept.about_phone.e164() == "+5561999990001"


async def test_a_phone_that_is_not_a_number_is_refused_and_nothing_is_kept() -> None:
    send, box, _ = _send_feedback()

    with pytest.raises(InvalidPhoneNumberError):
        await send(
            uuid4(),
            kind=FeedbackKind.COMPLAINT,
            message="Foi grosso.",
            about_phone="123",
            web_version="0.20.2",
        )

    assert box.kept == []


async def test_the_limit_is_per_account_and_a_mistake_does_not_spend_it() -> None:
    send, box, clock = _send_feedback()
    author, other = uuid4(), uuid4()

    async def one(account: UUID, phone: str | None = None) -> None:
        kind = FeedbackKind.COMPLAINT if phone else FeedbackKind.SUGGESTION
        await send(account, kind=kind, message="Uma ideia.", about_phone=phone, web_version="0.20.2")

    with pytest.raises(InvalidPhoneNumberError):
        await one(author, "abc")
    await one(author)
    await one(author)
    with pytest.raises(FeedbackLimitError):
        await one(author)
    await one(other)  # another account has its own window
    clock.at = NOW + RULES.window
    await one(author)  # and the window passes

    assert len(box.kept) == 4


async def test_reading_lists_what_was_sent_since_oldest_first() -> None:
    send, box, clock = _send_feedback()
    await send(uuid4(), kind=FeedbackKind.PRAISE, message="Antes.", about_phone=None, web_version="0.20.2")
    clock.at = NOW + timedelta(hours=1)
    await send(uuid4(), kind=FeedbackKind.PRAISE, message="Depois.", about_phone=None, web_version="0.20.2")

    everything = await ReadFeedback(box)(NOW)
    recent = await ReadFeedback(box)(NOW + timedelta(minutes=1))

    assert [f.message for f in everything] == ["Antes.", "Depois."]
    assert [f.message for f in recent] == ["Depois."]
