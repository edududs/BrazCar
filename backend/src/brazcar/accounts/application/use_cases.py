from dataclasses import dataclass
from datetime import timedelta

from brazcar.accounts.domain import (
    EMAIL_LINK_LIFETIME,
    Account,
    AccountId,
    AccountNotFoundError,
    CarId,
    EmailAlreadyRegisteredError,
    EmailConfirmation,
    InvalidConfirmationLinkError,
    InvalidCredentialsError,
    InvalidResetTokenError,
    TooManyAttemptsError,
    WrongCurrentPasswordError,
    account_phone,
)
from brazcar.shared.application.ports import Clock, Mailer, RateLimiter

from .ports import AccountRepository, Credentials, EmailConfirmationTokens, PasswordResetTokens
from .wording import in_hours


@dataclass(frozen=True, slots=True)
class AccountLimits:
    """How often one phone may try (D-064). Per phone, so a guess at one number cannot lock another;
    the e-mail change is per account, the one asking (D-168)."""

    login_attempts: int = 10
    login_window: timedelta = timedelta(minutes=15)
    reset_requests: int = 3
    reset_window: timedelta = timedelta(hours=1)
    email_change_requests: int = 5
    email_change_window: timedelta = timedelta(hours=1)


@dataclass(frozen=True, slots=True)
class LogIn:
    accounts: AccountRepository
    credentials: Credentials
    limiter: RateLimiter
    limits: AccountLimits = AccountLimits()

    async def __call__(self, *, phone: str, password: str) -> Account:
        try:
            normalized = account_phone(phone)
        except ValueError as error:
            raise InvalidCredentialsError from error
        allowed = await self.limiter.acquire(
            f"login:{normalized.e164()}", limit=self.limits.login_attempts, window=self.limits.login_window
        )
        if not allowed:
            raise TooManyAttemptsError
        account_id = await self.credentials.verify(normalized, password)
        account = await self.accounts.get(account_id) if account_id else None
        if account is None:
            raise InvalidCredentialsError
        return account


@dataclass(frozen=True, slots=True)
class UpdateProfile:
    """The display name, the only personal data the account edits by itself (D-139). The e-mail
    has its own path, by a link (`RequestEmailChange`, `ConfirmEmail`, D-168)."""

    accounts: AccountRepository

    async def __call__(self, account_id: AccountId, *, display_name: str | None = None) -> Account:
        account = await _require(self.accounts, account_id)
        changed = account.update_profile(display_name=display_name)
        if changed is not account:
            await self.accounts.save(changed)
        return changed


@dataclass(frozen=True, slots=True)
class RequestEmailChange:
    """Send the new address a link that confirms it (D-168). Nothing changes until the link is
    opened: the current e-mail keeps recovering the password meanwhile.

    Limited per account, so a session never becomes a way to mail strangers. The limit comes before
    the lookup, which tells the asker whether the address already has an account.
    """

    accounts: AccountRepository
    tokens: EmailConfirmationTokens
    mailer: Mailer
    limiter: RateLimiter
    clock: Clock
    confirm_link: str  # the front's page, with `{token}` where the link's token goes
    limits: AccountLimits = AccountLimits()

    async def __call__(self, account_id: AccountId, *, email: str) -> None:
        account = await _require(self.accounts, account_id)
        confirmation = EmailConfirmation.ask(account, email, self.clock.now())  # checks the address
        allowed = await self.limiter.acquire(
            f"email-change:{account.id}",
            limit=self.limits.email_change_requests,
            window=self.limits.email_change_window,
        )
        if not allowed:
            raise TooManyAttemptsError
        holder = await self.accounts.by_email(confirmation.email)
        if holder is not None and holder.id != account.id:
            raise EmailAlreadyRegisteredError
        token = await self.tokens.issue(confirmation)
        await self.mailer.send(
            to=confirmation.email,
            subject="BrazCar: confirme seu e-mail",
            body=(
                f"Olá, {account.display_name}.\n\n"
                "Para confirmar este e-mail na sua conta do BrazCar, abra o link abaixo:\n"
                f"{self.confirm_link.format(token=token)}\n\n"
                f"O link vale {in_hours(EMAIL_LINK_LIFETIME)}. "
                "Se você não pediu isso, ignore esta mensagem."
            ),
        )


@dataclass(frozen=True, slots=True)
class ConfirmEmail:
    """The link sent by `RequestEmailChange`, opened by the account it was sent for (D-168)."""

    accounts: AccountRepository
    tokens: EmailConfirmationTokens
    clock: Clock

    async def __call__(self, account_id: AccountId, *, token: str) -> Account:
        """Raises `InvalidConfirmationLinkError`, or `EmailAlreadyRegisteredError` when the address
        got an account after the link was sent."""
        account = await _require(self.accounts, account_id)
        confirmation = await self.tokens.read(token)
        if confirmation is None:
            raise InvalidConfirmationLinkError
        confirmed = confirmation.confirm(account, self.clock.now())
        await self.accounts.save(confirmed)
        return confirmed


@dataclass(frozen=True, slots=True)
class ChangePassword:
    """The password's own path, separate from the profile (D-139): it needs the current one.

    Goes through the same rate limit as `LogIn`, under the same key, so a stolen session cannot
    use this route to brute-force the password once login itself is capped (D-097).
    """

    accounts: AccountRepository
    credentials: Credentials
    limiter: RateLimiter
    limits: AccountLimits = AccountLimits()

    async def __call__(self, account_id: AccountId, *, current_password: str, new_password: str) -> None:
        account = await _require(self.accounts, account_id)
        allowed = await self.limiter.acquire(
            f"login:{account.phone.e164()}", limit=self.limits.login_attempts, window=self.limits.login_window
        )
        if not allowed:
            raise TooManyAttemptsError
        verified = await self.credentials.verify(account.phone, current_password)
        if verified != account.id:
            raise WrongCurrentPasswordError
        await self.credentials.change(account.id, new_password)


@dataclass(frozen=True, slots=True)
class AddCar:
    accounts: AccountRepository

    async def __call__(self, account_id: AccountId, *, model: str, color: str, plate: str) -> Account:
        account = await _require(self.accounts, account_id)
        changed = account.add_car(model=model, color=color, plate=plate)
        await self.accounts.save(changed)
        return changed


@dataclass(frozen=True, slots=True)
class RemoveCar:
    accounts: AccountRepository

    async def __call__(self, account_id: AccountId, car_id: CarId) -> Account:
        account = await _require(self.accounts, account_id)
        changed = account.remove_car(car_id)
        await self.accounts.save(changed)
        return changed


@dataclass(frozen=True, slots=True)
class RequestPasswordReset:
    """Answers the same whether or not the phone has an account or an e-mail: nothing leaks."""

    accounts: AccountRepository
    tokens: PasswordResetTokens
    mailer: Mailer
    limiter: RateLimiter
    reset_link: str  # the front's page, with `{token}` where the token goes
    limits: AccountLimits = AccountLimits()

    async def __call__(self, *, phone: str) -> None:
        try:
            normalized = account_phone(phone)
        except ValueError:
            return
        allowed = await self.limiter.acquire(
            f"password-reset:{normalized.e164()}",
            limit=self.limits.reset_requests,
            window=self.limits.reset_window,
        )
        if not allowed:
            return  # silently, like an unknown phone: the answer never says why
        account = await self.accounts.by_phone(normalized)
        if account is None or account.email is None:
            return
        token = await self.tokens.issue(account.id)
        await self.mailer.send(
            to=account.email,
            subject="BrazCar: redefinir senha",
            body=(
                f"Olá, {account.display_name}.\n\n"
                "Para escolher uma senha nova, abra o link abaixo:\n"
                f"{self.reset_link.format(token=token)}\n\n"
                "Se você não pediu isso, ignore esta mensagem."
            ),
        )


@dataclass(frozen=True, slots=True)
class ResetPassword:
    accounts: AccountRepository
    credentials: Credentials
    tokens: PasswordResetTokens

    async def __call__(self, *, token: str, password: str) -> None:
        account_id = await self.tokens.redeem(token)
        if account_id is None or await self.accounts.get(account_id) is None:
            raise InvalidResetTokenError
        await self.credentials.change(account_id, password)


@dataclass(frozen=True, slots=True)
class DeleteAccount:
    accounts: AccountRepository

    async def __call__(self, account_id: AccountId) -> None:
        await _require(self.accounts, account_id)
        await self.accounts.erase(account_id)


async def _require(accounts: AccountRepository, account_id: AccountId) -> Account:
    account = await accounts.get(account_id)
    if account is None:
        raise AccountNotFoundError(account_id)
    return account
