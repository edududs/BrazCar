import pytest

from brazcar.accounts.application import (
    AccountLimits,
    AddCar,
    ChangePassword,
    DeleteAccount,
    LogIn,
    RemoveCar,
    RequestPasswordReset,
    ResetPassword,
    UpdateProfile,
)
from brazcar.accounts.domain import (
    Account,
    AccountNotFoundError,
    InvalidCredentialsError,
    InvalidResetTokenError,
    TooManyAttemptsError,
    WrongCurrentPasswordError,
)
from tests.shared.fakes import InMemoryRateLimiter

from .fakes import (
    FixedClock,
    InMemoryAccountRepository,
    InMemoryCredentials,
    InMemoryResetTokens,
    RecordingMailer,
)

PHONE, PASSWORD = "61 99999-0001", "correct horse"


class Context:
    def __init__(self) -> None:
        self.accounts = InMemoryAccountRepository()
        self.credentials = InMemoryCredentials(self.accounts)
        self.tokens = InMemoryResetTokens()
        self.mailer = RecordingMailer()
        self.clock = FixedClock()
        self.limiter = InMemoryRateLimiter(self.clock)
        self.limits = AccountLimits(login_attempts=3, reset_requests=1)
        self.log_in = LogIn(self.accounts, self.credentials, self.limiter, self.limits)
        self.request_reset = RequestPasswordReset(
            self.accounts,
            self.tokens,
            self.mailer,
            self.limiter,
            "https://app/redefinir?token={token}",
            self.limits,
        )
        self.reset = ResetPassword(self.accounts, self.credentials, self.tokens)
        self.update_profile = UpdateProfile(self.accounts)
        self.change_password = ChangePassword(self.accounts, self.credentials, self.limiter, self.limits)

    async def register(
        self, *, phone: str, password: str, display_name: str, email: str | None = None
    ) -> Account:
        """An account straight through the ports: signing up itself is `test_invite_use_cases`'s."""
        account = Account.register(
            phone=phone, display_name=display_name, email=email, accepted_terms_at=self.clock.now()
        )
        await self.accounts.save(account)
        await self.credentials.register(account.id, password)
        return account


@pytest.fixture
def ctx() -> Context:
    return Context()


async def test_log_in_accepts_the_phone_however_it_is_typed(ctx: Context) -> None:
    account = await ctx.register(phone=PHONE, password=PASSWORD, display_name="Ana")

    assert await ctx.log_in(phone="(61) 9 9999-0001", password=PASSWORD) == account


@pytest.mark.parametrize(
    ("phone", "password"), [(PHONE, "wrong"), ("61 99999-0002", PASSWORD), ("abc", PASSWORD)]
)
async def test_log_in_fails_the_same_way_for_wrong_password_unknown_or_bad_phone(
    ctx: Context, phone: str, password: str
) -> None:
    await ctx.register(phone=PHONE, password=PASSWORD, display_name="Ana")

    with pytest.raises(InvalidCredentialsError):
        await ctx.log_in(phone=phone, password=password)


async def test_cars_are_added_and_removed_through_the_account(ctx: Context) -> None:
    account = await ctx.register(phone=PHONE, password=PASSWORD, display_name="Ana")

    driving = await AddCar(ctx.accounts)(account.id, model="Gol", color="prata", plate="abc1234")
    assert driving.can_drive
    walking = await RemoveCar(ctx.accounts)(account.id, driving.cars[0].id)

    assert await ctx.accounts.get(account.id) == walking
    assert not walking.can_drive


async def test_password_reset_mails_a_link_only_when_there_is_an_email(ctx: Context) -> None:
    await ctx.register(phone=PHONE, password=PASSWORD, display_name="Ana", email="ana@b.com")
    await ctx.register(phone="61 99999-0002", password=PASSWORD, display_name="Bia")

    await ctx.request_reset(phone="61 99999-0002")
    await ctx.request_reset(phone="61 99999-0003")
    await ctx.request_reset(phone="not a phone")
    assert ctx.mailer.sent == []

    await ctx.request_reset(phone=PHONE)
    (to, _, body), *_ = ctx.mailer.sent
    (token,) = ctx.tokens.issued
    assert to == "ana@b.com"
    assert f"https://app/redefinir?token={token}" in body


async def test_password_reset_changes_the_password_once_per_token(ctx: Context) -> None:
    account = await ctx.register(phone=PHONE, password=PASSWORD, display_name="Ana", email="a@b.com")
    token = await ctx.tokens.issue(account.id)

    await ctx.reset(token=token, password="new one")

    assert await ctx.log_in(phone=PHONE, password="new one") == account
    with pytest.raises(InvalidResetTokenError):
        await ctx.reset(token=token, password="again")


async def test_delete_erases_the_account(ctx: Context) -> None:
    account = await ctx.register(phone=PHONE, password=PASSWORD, display_name="Ana")

    await DeleteAccount(ctx.accounts)(account.id)

    assert await ctx.accounts.get(account.id) is None
    with pytest.raises(AccountNotFoundError):
        await DeleteAccount(ctx.accounts)(account.id)


async def test_update_profile_saves_the_change_and_leaves_absent_fields_alone(ctx: Context) -> None:
    account = await ctx.register(phone=PHONE, password=PASSWORD, display_name="Ana", email="a@b.com")

    renamed = await ctx.update_profile(account.id, display_name="Ana Paula")

    assert renamed.display_name == "Ana Paula"
    assert renamed.email == "a@b.com"
    assert await ctx.accounts.get(account.id) == renamed


async def test_update_profile_blank_email_clears_it(ctx: Context) -> None:
    account = await ctx.register(phone=PHONE, password=PASSWORD, display_name="Ana", email="a@b.com")

    cleared = await ctx.update_profile(account.id, email="")

    assert cleared.email is None
    assert await ctx.accounts.get(account.id) == cleared


async def test_change_password_needs_the_current_one_and_then_takes_hold(ctx: Context) -> None:
    account = await ctx.register(phone=PHONE, password=PASSWORD, display_name="Ana")

    with pytest.raises(WrongCurrentPasswordError):
        await ctx.change_password(account.id, current_password="wrong", new_password="a new one")
    await ctx.change_password(account.id, current_password=PASSWORD, new_password="a new one")

    # Not through `log_in` again: it shares the very bucket this change just spent from (D-097),
    # and the point here is the change itself, not a second proof already covered below.
    assert ctx.credentials.passwords[account.id] == "a new one"


async def test_change_password_shares_the_login_rate_limit(ctx: Context) -> None:
    """A wrong current password counts against the same bucket as a wrong login (D-097)."""
    account = await ctx.register(phone=PHONE, password=PASSWORD, display_name="Ana")

    for _ in range(3):
        with pytest.raises(WrongCurrentPasswordError):
            await ctx.change_password(account.id, current_password="wrong", new_password="a new one")
    with pytest.raises(TooManyAttemptsError):
        await ctx.change_password(account.id, current_password=PASSWORD, new_password="a new one")
    with pytest.raises(TooManyAttemptsError):  # the login bucket is the very same one, already spent
        await ctx.log_in(phone=PHONE, password=PASSWORD)


async def test_login_attempts_and_reset_requests_are_limited_per_phone(ctx: Context) -> None:
    await ctx.register(phone=PHONE, password=PASSWORD, display_name="Ana", email="a@b.com")

    for _ in range(3):
        with pytest.raises(InvalidCredentialsError):
            await ctx.log_in(phone=PHONE, password="wrong")
    with pytest.raises(TooManyAttemptsError):
        await ctx.log_in(phone=PHONE, password=PASSWORD)
    with pytest.raises(InvalidCredentialsError):  # another phone has its own count
        await ctx.log_in(phone="61 99999-0009", password="wrong")

    await ctx.request_reset(phone=PHONE)
    await ctx.request_reset(phone=PHONE)

    assert len(ctx.mailer.sent) == 1  # the second request went nowhere, silently
