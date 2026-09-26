"""Changing the e-mail by a link (D-168), through the ports only."""

from datetime import timedelta

import pytest
from pydantic import ValidationError

from brazcar.accounts.application import AccountLimits, ConfirmEmail, RequestEmailChange
from brazcar.accounts.domain import (
    EMAIL_LINK_LIFETIME,
    Account,
    EmailAlreadyRegisteredError,
    InvalidConfirmationLinkError,
    TooManyAttemptsError,
)
from tests.shared.fakes import InMemoryRateLimiter

from .fakes import FixedClock, InMemoryAccountRepository, InMemoryEmailConfirmationTokens, RecordingMailer

LINK = "https://app/confirmar-email?token={token}"


class Context:
    def __init__(self) -> None:
        self.accounts = InMemoryAccountRepository()
        self.tokens = InMemoryEmailConfirmationTokens()
        self.mailer = RecordingMailer()
        self.clock = FixedClock()
        self.limiter = InMemoryRateLimiter(self.clock)
        self.request = RequestEmailChange(
            self.accounts,
            self.tokens,
            self.mailer,
            self.limiter,
            self.clock,
            LINK,
            AccountLimits(email_change_requests=2),
        )
        self.confirm = ConfirmEmail(self.accounts, self.tokens, self.clock)

    async def legacy(self, *, phone: str = "61 99999-0001", email: str | None = None) -> Account:
        """An account from before the invite, saved straight through the port."""
        account = Account.register(
            phone=phone, display_name="Ana", email=email, accepted_terms_at=self.clock.now()
        )
        await self.accounts.save(account)
        return account

    def last_token(self) -> str:
        return list(self.tokens.issued)[-1]


@pytest.fixture
def ctx() -> Context:
    return Context()


async def test_the_link_goes_to_the_new_address_and_nothing_changes_before_it_is_opened(
    ctx: Context,
) -> None:
    account = await ctx.legacy(email="antigo@example.com")

    await ctx.request(account.id, email="nova@example.com")

    (to, subject, body), *_ = ctx.mailer.sent
    assert to == "nova@example.com"
    assert subject == "BrazCar: confirme seu e-mail"
    assert LINK.format(token=ctx.last_token()) in body
    assert "2 horas" in body
    assert await ctx.accounts.get(account.id) == account  # the old e-mail still stands


async def test_opening_the_link_confirms_the_address_and_clears_the_hold(ctx: Context) -> None:
    account = await ctx.legacy()
    assert account.required_action == "confirm_email"
    await ctx.request(account.id, email="ana@example.com")

    confirmed = await ctx.confirm(account.id, token=ctx.last_token())

    assert confirmed.email == "ana@example.com"
    assert confirmed.email_confirmed_at == ctx.clock.now()
    assert confirmed.required_action is None
    assert await ctx.accounts.get(account.id) == confirmed


async def test_an_address_that_is_not_one_is_refused_before_anything_counts(ctx: Context) -> None:
    account = await ctx.legacy()

    with pytest.raises(ValidationError):
        await ctx.request(account.id, email="not-an-email")

    assert ctx.mailer.sent == []
    assert not ctx.limiter.hits[f"email-change:{account.id}"]


async def test_an_address_of_another_account_is_refused_case_aside(ctx: Context) -> None:
    await ctx.legacy(phone="61 99999-0002", email="bia@example.com")
    account = await ctx.legacy()

    with pytest.raises(EmailAlreadyRegisteredError):
        await ctx.request(account.id, email="BIA@example.com")

    assert ctx.mailer.sent == []


async def test_asking_again_for_the_own_unconfirmed_address_is_fine(ctx: Context) -> None:
    account = await ctx.legacy(email="ana@example.com")

    await ctx.request(account.id, email="ana@example.com")

    assert len(ctx.mailer.sent) == 1


async def test_requests_are_limited_per_account(ctx: Context) -> None:
    account = await ctx.legacy()
    other = await ctx.legacy(phone="61 99999-0002")

    await ctx.request(account.id, email="um@example.com")
    await ctx.request(account.id, email="dois@example.com")
    with pytest.raises(TooManyAttemptsError):
        await ctx.request(account.id, email="tres@example.com")
    await ctx.request(other.id, email="outro@example.com")  # another account has its own count

    ctx.clock.at += timedelta(hours=1)
    await ctx.request(account.id, email="tres@example.com")  # the window moved on
    assert len(ctx.mailer.sent) == 4


async def test_another_accounts_link_is_refused(ctx: Context) -> None:
    ana = await ctx.legacy()
    bia = await ctx.legacy(phone="61 99999-0002")
    await ctx.request(ana.id, email="ana@example.com")

    with pytest.raises(InvalidConfirmationLinkError):
        await ctx.confirm(bia.id, token=ctx.last_token())

    assert await ctx.accounts.get(bia.id) == bia


async def test_an_unknown_or_lapsed_link_is_refused(ctx: Context) -> None:
    account = await ctx.legacy()
    await ctx.request(account.id, email="ana@example.com")

    with pytest.raises(InvalidConfirmationLinkError):
        await ctx.confirm(account.id, token="forged")
    ctx.clock.at += EMAIL_LINK_LIFETIME
    with pytest.raises(InvalidConfirmationLinkError):
        await ctx.confirm(account.id, token=ctx.last_token())


async def test_a_link_works_once(ctx: Context) -> None:
    account = await ctx.legacy()
    await ctx.request(account.id, email="ana@example.com")
    token = ctx.last_token()
    await ctx.confirm(account.id, token=token)

    with pytest.raises(InvalidConfirmationLinkError):
        await ctx.confirm(account.id, token=token)


async def test_an_address_taken_after_the_link_was_sent_is_refused_on_confirming(ctx: Context) -> None:
    account = await ctx.legacy()
    await ctx.request(account.id, email="ana@example.com")
    await ctx.legacy(phone="61 99999-0002", email="ANA@example.com")

    with pytest.raises(EmailAlreadyRegisteredError):
        await ctx.confirm(account.id, token=ctx.last_token())
