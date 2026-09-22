from dataclasses import dataclass
from datetime import timedelta

from brazcar.accounts.domain import (
    Account,
    AccountId,
    AccountNotFoundError,
    CarId,
    InvalidCredentialsError,
    InvalidResetTokenError,
    TooManyAttemptsError,
    normalize_phone_number,
)
from brazcar.shared.application.ports import Clock, Mailer, RateLimiter

from .ports import AccountRepository, Credentials, PasswordResetTokens


@dataclass(frozen=True, slots=True)
class AccountLimits:
    """How often one phone may try (D-064). Per phone, so a guess at one number cannot lock another."""

    login_attempts: int = 10
    login_window: timedelta = timedelta(minutes=15)
    reset_requests: int = 3
    reset_window: timedelta = timedelta(hours=1)


@dataclass(frozen=True, slots=True)
class RegisterAccount:
    accounts: AccountRepository
    credentials: Credentials
    clock: Clock

    async def __call__(
        self, *, phone: str, password: str, display_name: str, email: str | None = None
    ) -> Account:
        account = Account.register(
            phone=phone, display_name=display_name, email=email, accepted_terms_at=self.clock.now()
        )
        await self.accounts.save(account)
        await self.credentials.register(account.id, password)
        return account


@dataclass(frozen=True, slots=True)
class LogIn:
    accounts: AccountRepository
    credentials: Credentials
    limiter: RateLimiter
    limits: AccountLimits = AccountLimits()

    async def __call__(self, *, phone: str, password: str) -> Account:
        try:
            normalized = normalize_phone_number(phone)
        except ValueError as error:
            raise InvalidCredentialsError from error
        allowed = await self.limiter.acquire(
            f"login:{normalized}", limit=self.limits.login_attempts, window=self.limits.login_window
        )
        if not allowed:
            raise TooManyAttemptsError
        account_id = await self.credentials.verify(normalized, password)
        account = await self.accounts.get(account_id) if account_id else None
        if account is None:
            raise InvalidCredentialsError
        return account


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
            normalized = normalize_phone_number(phone)
        except ValueError:
            return
        allowed = await self.limiter.acquire(
            f"password-reset:{normalized}", limit=self.limits.reset_requests, window=self.limits.reset_window
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
