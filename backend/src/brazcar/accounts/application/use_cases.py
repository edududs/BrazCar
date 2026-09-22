from dataclasses import dataclass

from brazcar.accounts.domain import (
    Account,
    AccountId,
    AccountNotFoundError,
    CarId,
    InvalidCredentialsError,
    InvalidResetTokenError,
    normalize_phone_number,
)
from brazcar.shared.application.ports import Clock, Mailer

from .ports import AccountRepository, Credentials, PasswordResetTokens


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

    async def __call__(self, *, phone: str, password: str) -> Account:
        try:
            normalized = normalize_phone_number(phone)
        except ValueError as error:
            raise InvalidCredentialsError from error
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
    reset_link: str  # the front's page, with `{token}` where the token goes

    async def __call__(self, *, phone: str) -> None:
        try:
            normalized = normalize_phone_number(phone)
        except ValueError:
            return
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
