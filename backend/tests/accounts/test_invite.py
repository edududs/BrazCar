"""The invite on its own: no Django, no database (D-166)."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from hypothesis import given
from hypothesis import strategies as st

from brazcar.accounts.domain import (
    Consumed,
    Invite,
    InviteAlreadyUsedError,
    InviteEmailMissingError,
    InviteExpiredError,
    InviteNotFoundError,
    InvitePolicy,
    InviteStatus,
    account_phone,
    token_digest,
)

from .strategies import POLICY, DrawnInvite, invites, within

ISSUED_AT = datetime(2026, 9, 25, 12, 0, tzinfo=UTC)
PHONE = account_phone("61 99999-0001")
LIFETIME, LINK_LIFETIME = POLICY.lifetime, POLICY.email_link_lifetime
MINUTE = timedelta(minutes=1)
around = st.timedeltas(min_value=timedelta(0), max_value=timedelta(hours=10))
"""An offset from the moment of issue, to well past every deadline."""


def issued() -> tuple[Invite, str]:
    return Invite.issue(PHONE, ISSUED_AT, POLICY)


def test_the_policy_is_four_hours_for_the_invite_and_two_for_the_email_link() -> None:
    assert InvitePolicy() == InvitePolicy(lifetime=timedelta(hours=4), email_link_lifetime=timedelta(hours=2))


def test_issue_keeps_only_the_digest_of_the_token() -> None:
    invite, token = issued()

    assert invite.invite_digest == token_digest(token)
    assert token not in invite.model_dump_json()
    assert invite.expires_at == ISSUED_AT + LIFETIME
    assert invite.version == 0
    assert invite.status(ISSUED_AT, latest=True) is InviteStatus.OPEN


def test_each_issue_draws_a_new_token() -> None:
    (_, one), (_, other) = issued(), issued()

    assert one != other


@given(offset=around)
def test_an_issued_invite_is_open_until_it_expires(offset: timedelta) -> None:
    invite, _ = issued()

    expected = InviteStatus.OPEN if offset <= LIFETIME else InviteStatus.EXPIRED
    assert invite.status(ISSUED_AT + offset, latest=True) is expected


@given(
    given_after=within(LIFETIME), waited=st.timedeltas(min_value=timedelta(0), max_value=timedelta(hours=5))
)
def test_the_email_link_lasts_two_hours_from_when_the_email_was_given(
    given_after: timedelta, waited: timedelta
) -> None:
    """Its own clock, past the invite's end if need be; once lapsed, the invite's clock is back."""
    invite, _ = issued()
    given_at = ISSUED_AT + given_after
    waiting, email_token = invite.give_email("ana@example.com", given_at, POLICY)
    now = given_at + waited

    if waited <= LINK_LIFETIME:
        assert waiting.status(now, latest=True) is InviteStatus.AWAITING_EMAIL_CONFIRMATION
        consumed = waiting.consume(email_token, uuid4(), now)
        assert consumed.status(now, latest=True) is InviteStatus.CONSUMED
    else:
        expected = InviteStatus.OPEN if now <= invite.expires_at else InviteStatus.EXPIRED
        assert waiting.status(now, latest=True) is expected
        with pytest.raises(InviteExpiredError):
            waiting.consume(email_token, uuid4(), now)


def test_an_email_given_just_before_the_invite_ends_still_confirms_after_it() -> None:
    invite, _ = issued()
    waiting, email_token = invite.give_email("ana@example.com", invite.expires_at - 5 * MINUTE, POLICY)
    now = invite.expires_at + 30 * MINUTE  # the invite is over; the e-mail link is not

    assert waiting.status(now, latest=True) is InviteStatus.AWAITING_EMAIL_CONFIRMATION
    consumed = waiting.consume(email_token, uuid4(), now)

    assert isinstance(consumed.progress, Consumed)
    assert consumed.progress.email == "ana@example.com"


def test_a_lapsed_email_link_reopens_an_invite_still_in_time() -> None:
    """The way out of a lost e-mail: give it again, for a new link, while the invite lasts (D-166)."""
    invite, _ = issued()
    waiting, stale_token = invite.give_email("ana@example.com", ISSUED_AT + MINUTE, POLICY)
    now = ISSUED_AT + MINUTE + LINK_LIFETIME + MINUTE  # past the e-mail link, before the invite's end

    assert waiting.status(now, latest=True) is InviteStatus.OPEN
    with pytest.raises(InviteExpiredError):
        waiting.consume(stale_token, uuid4(), now)

    again, fresh_token = waiting.give_email("ana@example.com", now, POLICY)
    assert again.consume(fresh_token, uuid4(), now).status(now, latest=True) is InviteStatus.CONSUMED


def test_the_email_cannot_be_given_once_the_invite_is_over() -> None:
    invite, _ = issued()
    waiting, _ = invite.give_email("ana@example.com", invite.expires_at - MINUTE, POLICY)
    later = invite.expires_at + MINUTE

    for current in (invite, waiting):  # awaiting its link or not, the invite's own clock says no
        with pytest.raises(InviteExpiredError):
            current.give_email("bia@example.com", later, POLICY)


def test_giving_the_email_again_kills_the_previous_link() -> None:
    invite, _ = issued()
    first, first_token = invite.give_email("ana@example.com", ISSUED_AT, POLICY)
    second, second_token = first.give_email("ana.paula@example.com", ISSUED_AT + MINUTE, POLICY)

    assert second_token != first_token
    with pytest.raises(InviteNotFoundError):
        second.consume(first_token, uuid4(), ISSUED_AT + MINUTE)
    consumed = second.consume(second_token, uuid4(), ISSUED_AT + MINUTE)
    assert isinstance(consumed.progress, Consumed)
    assert consumed.progress.email == "ana.paula@example.com"


def test_every_change_bumps_the_version() -> None:
    invite, _ = issued()
    first, _ = invite.give_email("ana@example.com", ISSUED_AT, POLICY)
    second, token = first.give_email("ana@example.com", ISSUED_AT, POLICY)
    consumed = second.consume(token, uuid4(), ISSUED_AT)

    assert [i.version for i in (invite, first, second, consumed)] == [0, 1, 2, 3]


def test_consuming_needs_the_email_first() -> None:
    invite, token = issued()

    with pytest.raises(InviteEmailMissingError):
        invite.consume(token, uuid4(), ISSUED_AT)


def test_the_token_is_stored_only_as_its_digest_after_the_email_too() -> None:
    invite, _ = issued()
    waiting, email_token = invite.give_email("ana@example.com", ISSUED_AT, POLICY)

    assert email_token not in waiting.model_dump_json()


@given(drawn=invites(("consumed",)), offset=around, latest=st.booleans())
def test_consumed_never_comes_back(drawn: DrawnInvite, offset: timedelta, *, latest: bool) -> None:
    invite, email_token = drawn.invite, drawn.email_token
    assert email_token is not None
    now = invite.issued_at + offset

    assert invite.status(now, latest=latest) is InviteStatus.CONSUMED
    with pytest.raises(InviteAlreadyUsedError):
        invite.give_email("bia@example.com", now, POLICY)
    with pytest.raises(InviteAlreadyUsedError):
        invite.consume(email_token, uuid4(), now)


@given(drawn=invites(), offset=around)
def test_an_invite_not_the_latest_of_its_phone_is_superseded(drawn: DrawnInvite, offset: timedelta) -> None:
    status = drawn.invite.status(drawn.invite.issued_at + offset, latest=False)

    consumed = isinstance(drawn.invite.progress, Consumed)
    assert status is (InviteStatus.CONSUMED if consumed else InviteStatus.SUPERSEDED)


@given(drawn=invites(), offset=around)
def test_the_status_says_what_the_invite_accepts(drawn: DrawnInvite, offset: timedelta) -> None:
    """For any moment the status is one, and it agrees with what the transitions allow."""
    invite = drawn.invite
    now = invite.issued_at + offset
    status = invite.status(now, latest=True)

    if drawn.email_token is not None:
        try:
            invite.consume(drawn.email_token, uuid4(), now)
        except InviteAlreadyUsedError, InviteExpiredError:
            assert status is not InviteStatus.AWAITING_EMAIL_CONFIRMATION
        else:
            assert status is InviteStatus.AWAITING_EMAIL_CONFIRMATION
    if status is InviteStatus.OPEN:
        invite.give_email("bia@example.com", now, POLICY)  # does not raise
    if status is InviteStatus.EXPIRED:
        with pytest.raises(InviteExpiredError):
            invite.give_email("bia@example.com", now, POLICY)
