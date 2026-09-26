import asyncio
import re
from datetime import timedelta

import pytest
from pydantic import ValidationError

from brazcar.accounts.application import (
    GiveInviteEmail,
    InviteLimits,
    IssueInvite,
    OpenInvite,
    OpenSignup,
    RegisterFromInvite,
)
from brazcar.accounts.domain import (
    Account,
    Consumed,
    EmailAlreadyRegisteredError,
    EmailGiven,
    Invite,
    InviteAlreadyUsedError,
    InviteExpiredError,
    InviteNotFoundError,
    InvitePolicy,
    InviteStatus,
    InviteSupersededError,
    NotAMobilePhoneError,
    PhoneAlreadyRegisteredError,
    TooManyAttemptsError,
)
from brazcar.shared.domain.phone import InvalidPhoneNumberError, PhoneNumber
from tests.shared.fakes import InMemoryRateLimiter

from .fakes import (
    FixedClock,
    InMemoryAccountRepository,
    InMemoryCredentials,
    InMemoryInviteRepository,
    RecordingMailer,
)

PHONE = "61 99999-0001"
EMAIL = "ana@example.com"
PASSWORD = "correct horse battery"
POLICY = InvitePolicy()
SIGNUP_LINK = "https://app/cadastro?token={token}"


class Context:
    def __init__(self, accounts: InMemoryAccountRepository | None = None) -> None:
        self.invites = InMemoryInviteRepository()
        self.accounts = accounts or InMemoryAccountRepository()
        self.credentials = InMemoryCredentials(self.accounts)
        self.mailer = RecordingMailer()
        self.clock = FixedClock()
        self.limiter = InMemoryRateLimiter(self.clock)
        self.issue = IssueInvite(self.invites, self.accounts, self.clock)
        self.open_invite = OpenInvite(self.invites, self.accounts, self.clock)
        self.give_email = GiveInviteEmail(
            self.invites, self.accounts, self.mailer, self.limiter, self.clock, SIGNUP_LINK
        )
        self.open_signup = OpenSignup(self.invites, self.accounts, self.clock)
        self.register = RegisterFromInvite(self.invites, self.accounts, self.credentials, self.clock)

    async def invited(self, phone: str = PHONE) -> tuple[Invite, str]:
        return await self.issue(phone=phone)

    async def emailed(self, token: str, email: str = EMAIL) -> str:
        """Give the e-mail, and read the e-mail link's token back from the message, as the person would."""
        await self.give_email(token=token, email=email)
        match = re.search(r"token=([\w-]+)", self.mailer.sent[-1][2])
        assert match is not None
        return match.group(1)

    async def sign_up(self, email_token: str, display_name: str = "Ana") -> Account:
        return await self.register(email_token=email_token, display_name=display_name, password=PASSWORD)

    async def existing(self, phone: str = "61 99999-0009", email: str | None = None) -> Account:
        """An account that got in some other way: the seed, or before the invite."""
        account = Account.register(
            phone=phone, display_name="Bia", email=email, accepted_terms_at=self.clock.at
        )
        await self.accounts.save(account)
        return account

    def advance(self, by: timedelta) -> None:
        self.clock.at += by


@pytest.fixture
def ctx() -> Context:
    return Context()


# --- issuing ---------------------------------------------------------------------------------------


async def test_issue_stores_the_invite_found_by_its_token(ctx: Context) -> None:
    invite, token = await ctx.issue(phone="(61) 9 9999-0001")

    assert await ctx.invites.by_invite_token(token) == invite
    assert await ctx.invites.latest_for(invite.phone) == invite
    assert invite.expires_at == ctx.clock.at + timedelta(hours=4)


async def test_issue_refuses_a_phone_that_already_has_an_account(ctx: Context) -> None:
    await ctx.existing(phone=PHONE)

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


# --- the invite's link -------------------------------------------------------------------------


async def test_the_invite_opens_on_the_phone_and_then_on_the_email_waiting(ctx: Context) -> None:
    invite, token = await ctx.invited()

    opened = await ctx.open_invite(token=token)
    await ctx.emailed(token)
    waiting = await ctx.open_invite(token=token)

    assert (opened.status, opened.phone, opened.expires_at, opened.email) == (
        InviteStatus.OPEN,
        invite.phone,
        invite.expires_at,
        None,
    )
    assert (waiting.status, waiting.email) == (InviteStatus.AWAITING_EMAIL_CONFIRMATION, EMAIL)


async def test_an_unknown_invite_token_is_not_found(ctx: Context) -> None:
    with pytest.raises(InviteNotFoundError):
        await ctx.open_invite(token="nope")
    with pytest.raises(InviteNotFoundError):
        await ctx.give_email(token="nope", email=EMAIL)


async def test_an_expired_invite_is_refused_on_its_link_and_on_the_email_step(ctx: Context) -> None:
    _, token = await ctx.invited()
    ctx.advance(POLICY.lifetime + timedelta(minutes=1))

    with pytest.raises(InviteExpiredError):
        await ctx.open_invite(token=token)
    with pytest.raises(InviteExpiredError):
        await ctx.give_email(token=token, email=EMAIL)
    assert ctx.mailer.sent == []


# --- the e-mail step ---------------------------------------------------------------------------


async def test_giving_the_email_mails_its_link_in_portuguese(ctx: Context) -> None:
    _, token = await ctx.invited()

    email_token = await ctx.emailed(token)

    (to, subject, body), *_ = ctx.mailer.sent
    assert to == EMAIL
    assert subject == "BrazCar: confirme seu e-mail"
    assert f"https://app/cadastro?token={email_token}" in body
    assert "vale 2 horas" in body
    assert "Se você não pediu isso, ignore esta mensagem." in body


async def test_the_mail_says_the_lifetime_the_policy_gives(ctx: Context) -> None:
    policy = InvitePolicy(email_link_lifetime=timedelta(hours=1))
    give = GiveInviteEmail(ctx.invites, ctx.accounts, ctx.mailer, ctx.limiter, ctx.clock, SIGNUP_LINK, policy)
    _, token = await ctx.invited()

    await give(token=token, email=EMAIL)

    assert "vale 1 hora." in ctx.mailer.sent[0][2]


async def test_a_superseded_invite_sends_no_email(ctx: Context) -> None:
    _, first = await ctx.invited()
    ctx.advance(timedelta(minutes=1))
    await ctx.invited()

    with pytest.raises(InviteSupersededError):
        await ctx.give_email(token=first, email=EMAIL)
    with pytest.raises(InviteSupersededError):
        await ctx.open_invite(token=first)
    assert ctx.mailer.sent == []


async def test_the_email_step_is_limited_per_invite(ctx: Context) -> None:
    _, token = await ctx.invited()
    _, other = await ctx.invited(phone="61 99999-0002")

    for n in range(InviteLimits().email_requests):
        await ctx.give_email(token=token, email=f"ana{n}@example.com")
    with pytest.raises(TooManyAttemptsError):
        await ctx.give_email(token=token, email=EMAIL)
    await ctx.give_email(token=other, email=EMAIL)  # another invite has its own count

    assert len(ctx.mailer.sent) == InviteLimits().email_requests + 1


async def test_an_email_that_already_has_an_account_is_refused(ctx: Context) -> None:
    await ctx.existing(email=EMAIL)
    invite, token = await ctx.invited()

    with pytest.raises(EmailAlreadyRegisteredError):
        await ctx.give_email(token=token, email="ANA@example.com")

    assert ctx.mailer.sent == []
    assert await ctx.invites.by_invite_token(token) == invite  # nothing written


async def test_an_address_that_is_not_one_is_refused_before_counting(ctx: Context) -> None:
    _, token = await ctx.invited()

    with pytest.raises(ValidationError):
        await ctx.give_email(token=token, email="not-an-email")

    assert ctx.mailer.sent == []
    assert not any(ctx.limiter.hits.values())


async def test_typing_the_email_again_kills_the_earlier_link(ctx: Context) -> None:
    _, token = await ctx.invited()
    first = await ctx.emailed(token)

    second = await ctx.emailed(token, "outra@example.com")

    with pytest.raises(InviteNotFoundError):
        await ctx.sign_up(first)
    account = await ctx.sign_up(second)
    assert account.email == "outra@example.com"


# --- the e-mail's link and the registration -----------------------------------------------------


async def test_the_email_link_opens_on_the_phone_and_the_email(ctx: Context) -> None:
    invite, token = await ctx.invited()
    email_token = await ctx.emailed(token)

    signup = await ctx.open_signup(email_token=email_token)

    assert (signup.phone, signup.email) == (invite.phone, EMAIL)
    assert signup.email_expires_at == ctx.clock.at + POLICY.email_link_lifetime


async def test_registering_creates_the_account_with_the_email_confirmed_and_spends_the_invite(
    ctx: Context,
) -> None:
    _, token = await ctx.invited()
    email_token = await ctx.emailed(token)

    account = await ctx.sign_up(email_token)

    assert account.phone == PhoneNumber.parse("+5561999990001")
    assert account.email == EMAIL
    assert account.email_confirmed_at == ctx.clock.at == account.terms_accepted_at
    assert await ctx.accounts.get(account.id) == account
    assert ctx.credentials.passwords[account.id] == PASSWORD
    spent = await ctx.invites.by_email_token(email_token)
    assert spent is not None
    assert isinstance(spent.progress, Consumed)
    assert spent.progress.account_id == account.id


async def test_the_email_link_works_once(ctx: Context) -> None:
    _, token = await ctx.invited()
    email_token = await ctx.emailed(token)
    await ctx.sign_up(email_token)

    with pytest.raises(InviteAlreadyUsedError):
        await ctx.sign_up(email_token, "Outra")
    with pytest.raises(InviteAlreadyUsedError):
        await ctx.open_signup(email_token=email_token)
    with pytest.raises(InviteAlreadyUsedError):
        await ctx.open_invite(token=token)


async def test_an_unknown_email_token_is_not_found(ctx: Context) -> None:
    _, token = await ctx.invited()
    await ctx.emailed(token)

    for wrong in ("nope", token):  # the invite's own token is no e-mail link
        with pytest.raises(InviteNotFoundError):
            await ctx.sign_up(wrong)
        with pytest.raises(InviteNotFoundError):
            await ctx.open_signup(email_token=wrong)


async def test_the_email_link_still_registers_past_the_invite_deadline(ctx: Context) -> None:
    _, token = await ctx.invited()
    ctx.advance(POLICY.lifetime - timedelta(minutes=5))
    email_token = await ctx.emailed(token)
    ctx.advance(timedelta(minutes=30))

    account = await ctx.sign_up(email_token)

    assert account.email_confirmed


@pytest.mark.parametrize(
    "wait",
    [
        POLICY.email_link_lifetime + timedelta(minutes=1),  # the invite still in time: it reads open
        POLICY.lifetime + timedelta(minutes=1),  # both gone
    ],
)
async def test_a_lapsed_email_link_is_expired(ctx: Context, wait: timedelta) -> None:
    _, token = await ctx.invited()
    email_token = await ctx.emailed(token)
    ctx.advance(wait)

    with pytest.raises(InviteExpiredError):
        await ctx.open_signup(email_token=email_token)
    with pytest.raises(InviteExpiredError):
        await ctx.sign_up(email_token)


async def test_issuing_again_supersedes_the_email_link_of_the_earlier_invite(ctx: Context) -> None:
    _, first = await ctx.invited()
    first_email_token = await ctx.emailed(first)
    ctx.advance(timedelta(minutes=1))
    _, second = await ctx.invited()

    with pytest.raises(InviteSupersededError):
        await ctx.sign_up(first_email_token)

    await ctx.sign_up(await ctx.emailed(second))


async def test_a_phone_that_got_an_account_elsewhere_ends_the_invite_everywhere(ctx: Context) -> None:
    """Terminal, never "open": one phone, one account, however the account came to be (D-167)."""
    _, token = await ctx.invited()
    email_token = await ctx.emailed(token)
    await ctx.existing(phone=PHONE)

    with pytest.raises(PhoneAlreadyRegisteredError):
        await ctx.open_invite(token=token)
    with pytest.raises(PhoneAlreadyRegisteredError):
        await ctx.give_email(token=token, email="outra@example.com")
    with pytest.raises(PhoneAlreadyRegisteredError):
        await ctx.open_signup(email_token=email_token)
    with pytest.raises(PhoneAlreadyRegisteredError):
        await ctx.sign_up(email_token)
    assert len(ctx.mailer.sent) == 1  # only the first, from before the account


async def test_an_email_that_got_an_account_meanwhile_stops_the_registration(ctx: Context) -> None:
    _, token = await ctx.invited()
    email_token = await ctx.emailed(token)
    await ctx.existing(email="Ana@Example.com")

    with pytest.raises(EmailAlreadyRegisteredError):
        await ctx.sign_up(email_token)


async def test_a_blank_display_name_writes_nothing(ctx: Context) -> None:
    _, token = await ctx.invited()
    email_token = await ctx.emailed(token)

    with pytest.raises(ValidationError):
        await ctx.sign_up(email_token, "   ")

    assert await ctx.accounts.by_email(EMAIL) is None
    waiting = await ctx.invites.by_email_token(email_token)
    assert waiting is not None
    assert isinstance(waiting.progress, EmailGiven)


class ReadTogether(InMemoryAccountRepository):
    """Once armed, holds the first phone lookup of each registration until both got there: the two
    read the invite as unused, and only then does either write."""

    def __init__(self) -> None:
        super().__init__()
        self.barrier = asyncio.Barrier(2)
        self.armed = False
        self.held = 0

    async def by_phone(self, phone: PhoneNumber) -> Account | None:
        if self.armed and self.held < self.barrier.parties:
            self.held += 1
            await self.barrier.wait()
        return await super().by_phone(phone)


async def test_two_registrations_racing_on_one_email_link_make_one_account() -> None:
    accounts = ReadTogether()
    ctx = Context(accounts)
    _, token = await ctx.invited()
    email_token = await ctx.emailed(token)
    accounts.armed = True

    results = await asyncio.gather(
        ctx.sign_up(email_token, "Ana"), ctx.sign_up(email_token, "Outra"), return_exceptions=True
    )

    created = [result for result in results if isinstance(result, Account)]
    refusals = [result for result in results if isinstance(result, BaseException)]
    assert len(created) == 1
    assert [type(refusal) for refusal in refusals] == [PhoneAlreadyRegisteredError]  # the first lock
    assert await accounts.by_phone(created[0].phone) == created[0]
