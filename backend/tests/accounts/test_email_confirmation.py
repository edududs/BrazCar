"""The link that confirms a new e-mail (D-168): what it carries and when it still serves."""

from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from brazcar.accounts.domain import (
    EMAIL_LINK_LIFETIME,
    Account,
    EmailConfirmation,
    InvalidConfirmationLinkError,
    account_phone,
)

ASKED_AT = datetime(2026, 9, 26, 12, 0, tzinfo=UTC)


def legacy(email: str | None = None) -> Account:
    """An account from before the invite: no e-mail, or one never proven."""
    return Account.register(
        phone="61 99999-0001",
        display_name="Ana",
        email=email,
        accepted_terms_at=ASKED_AT - timedelta(days=90),
    )


def test_asking_carries_the_account_the_address_the_deadline_and_the_current_confirmation() -> None:
    account = Account.register_from_invite(
        phone=account_phone("61 99999-0001"), email="ana@example.com", display_name="Ana", now=ASKED_AT
    )

    link = EmailConfirmation.ask(account, "nova@example.com", ASKED_AT)

    assert link.account_id == account.id
    assert link.email == "nova@example.com"
    assert link.expires_at == ASKED_AT + EMAIL_LINK_LIFETIME == ASKED_AT + timedelta(hours=2)
    assert link.previous_confirmation == account.email_confirmed_at


def test_asking_refuses_an_address_that_is_not_one() -> None:
    with pytest.raises(ValidationError):
        EmailConfirmation.ask(legacy(), "not-an-email", ASKED_AT)


def test_the_link_confirms_the_new_address_within_its_deadline() -> None:
    account = legacy("antigo@example.com")
    link = EmailConfirmation.ask(account, "nova@example.com", ASKED_AT)
    opened_at = ASKED_AT + EMAIL_LINK_LIFETIME - timedelta(seconds=1)

    confirmed = link.confirm(account, opened_at)

    assert confirmed.email == "nova@example.com"
    assert confirmed.email_confirmed_at == opened_at
    assert confirmed.required_action is None


def test_a_lapsed_link_is_refused() -> None:
    account = legacy()
    link = EmailConfirmation.ask(account, "ana@example.com", ASKED_AT)

    with pytest.raises(InvalidConfirmationLinkError):
        link.confirm(account, ASKED_AT + EMAIL_LINK_LIFETIME)


def test_another_accounts_link_is_refused() -> None:
    link = EmailConfirmation.ask(legacy(), "ana@example.com", ASKED_AT)
    other = Account.register(
        phone="61 99999-0002", display_name="Bia", email=None, accepted_terms_at=ASKED_AT
    )

    with pytest.raises(InvalidConfirmationLinkError):
        link.confirm(other, ASKED_AT)


def test_a_link_works_once_and_a_confirmation_retires_every_earlier_link() -> None:
    account = legacy()
    first = EmailConfirmation.ask(account, "um@example.com", ASKED_AT)
    second = EmailConfirmation.ask(account, "dois@example.com", ASKED_AT)

    confirmed = second.confirm(account, ASKED_AT + timedelta(minutes=1))

    with pytest.raises(InvalidConfirmationLinkError):
        second.confirm(confirmed, ASKED_AT + timedelta(minutes=2))
    with pytest.raises(InvalidConfirmationLinkError):
        first.confirm(confirmed, ASKED_AT + timedelta(minutes=2))
