from datetime import timedelta
from uuid import uuid4

import pytest

from brazcar.accounts.application import ConsumeInvite, IssueInvite
from brazcar.accounts.domain import (
    Account,
    Consumed,
    Invite,
    InviteAlreadyUsedError,
    InviteNotFoundError,
    InvitePolicy,
    InviteSupersededError,
    NotAMobilePhoneError,
    PhoneAlreadyRegisteredError,
)
from brazcar.shared.domain.phone import InvalidPhoneNumberError

from .fakes import FixedClock, InMemoryAccountRepository, InMemoryInviteRepository

PHONE = "61 99999-0001"
POLICY = InvitePolicy()


class Context:
    def __init__(self) -> None:
        self.invites = InMemoryInviteRepository()
        self.accounts = InMemoryAccountRepository()
        self.clock = FixedClock()
        self.issue = IssueInvite(self.invites, self.accounts, self.clock)
        self.consume = ConsumeInvite(self.invites, self.clock)

    async def give_email(self, invite: Invite, email: str = "ana@example.com") -> tuple[Invite, str]:
        """What the next step's `GiveInviteEmail` will do, straight on the invite, for these tests."""
        waiting, token = invite.give_email(email, self.clock.now(), POLICY)
        await self.invites.save(waiting)
        return waiting, token

    def advance(self, by: timedelta) -> None:
        self.clock.at += by


@pytest.fixture
def ctx() -> Context:
    return Context()


async def test_issue_stores_the_invite_found_by_its_token(ctx: Context) -> None:
    invite, token = await ctx.issue(phone="(61) 9 9999-0001")

    assert await ctx.invites.by_invite_token(token) == invite
    assert await ctx.invites.latest_for(invite.phone) == invite
    assert invite.expires_at == ctx.clock.at + timedelta(hours=4)


async def test_issue_refuses_a_phone_that_already_has_an_account(ctx: Context) -> None:
    account = Account.register(phone=PHONE, display_name="Ana", email=None, accepted_terms_at=ctx.clock.at)
    await ctx.accounts.save(account)

    with pytest.raises(PhoneAlreadyRegisteredError):
        await ctx.issue(phone="+55 61 99999-0001")


@pytest.mark.parametrize(
    ("phone", "error"), [("abc", InvalidPhoneNumberError), ("61 3333-4444", NotAMobilePhoneError)]
)
async def test_issue_checks_the_phone_like_registration(
    ctx: Context, phone: str, error: type[Exception]
) -> None:
    with pytest.raises(error):
        await ctx.issue(phone=phone)


async def test_consume_spends_the_invite_on_the_account(ctx: Context) -> None:
    invite, _ = await ctx.issue(phone=PHONE)
    _, email_token = await ctx.give_email(invite)
    account_id = uuid4()

    consumed = await ctx.consume(email_token=email_token, account_id=account_id)

    assert isinstance(consumed.progress, Consumed)
    assert consumed.progress.account_id == account_id
    assert await ctx.invites.by_email_token(email_token) == consumed


async def test_consuming_twice_fails_the_second_time(ctx: Context) -> None:
    invite, _ = await ctx.issue(phone=PHONE)
    _, email_token = await ctx.give_email(invite)
    await ctx.consume(email_token=email_token, account_id=uuid4())

    with pytest.raises(InviteAlreadyUsedError):
        await ctx.consume(email_token=email_token, account_id=uuid4())


async def test_issuing_again_supersedes_the_earlier_invite(ctx: Context) -> None:
    first, _ = await ctx.issue(phone=PHONE)
    _, first_email_token = await ctx.give_email(first)
    ctx.advance(timedelta(minutes=1))
    second, _ = await ctx.issue(phone=PHONE)

    with pytest.raises(InviteSupersededError):
        await ctx.consume(email_token=first_email_token, account_id=uuid4())

    _, second_email_token = await ctx.give_email(second)
    await ctx.consume(email_token=second_email_token, account_id=uuid4())


async def test_the_email_link_still_consumes_past_the_invite_deadline(ctx: Context) -> None:
    invite, _ = await ctx.issue(phone=PHONE)
    ctx.advance(POLICY.lifetime - timedelta(minutes=5))
    _, email_token = await ctx.give_email(invite)
    ctx.advance(timedelta(minutes=30))

    consumed = await ctx.consume(email_token=email_token, account_id=uuid4())

    assert isinstance(consumed.progress, Consumed)


async def test_an_unknown_email_token_is_not_found(ctx: Context) -> None:
    invite, invite_token = await ctx.issue(phone=PHONE)
    await ctx.give_email(invite)

    for token in ("nope", invite_token):  # the invite's own token is no e-mail link
        with pytest.raises(InviteNotFoundError):
            await ctx.consume(email_token=token, account_id=uuid4())
