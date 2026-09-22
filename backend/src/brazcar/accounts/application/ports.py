from typing import Protocol

from brazcar.accounts.domain import Account, AccountId


class AccountRepository(Protocol):
    async def get(self, account_id: AccountId) -> Account | None: ...

    async def by_phone(self, phone: str) -> Account | None:
        """`phone` already normalized (E.164)."""
        ...

    async def save(self, account: Account) -> None:
        """Insert or replace the account and its cars, whole (ADR-0008).

        Raises `PhoneAlreadyRegisteredError` when another account owns the phone.
        """
        ...

    async def erase(self, account_id: AccountId) -> None:
        """Anonymize: phone, name, e-mail and cars go; the identifier stays for ride history (D-033)."""
        ...


class Credentials(Protocol):
    """The password lives here, never in the domain."""

    async def register(self, account_id: AccountId, password: str) -> None: ...

    async def verify(self, phone: str, password: str) -> AccountId | None: ...

    async def change(self, account_id: AccountId, password: str) -> None: ...


class PasswordResetTokens(Protocol):
    async def issue(self, account_id: AccountId) -> str: ...

    async def redeem(self, token: str) -> AccountId | None:
        """The account the token was issued for, once, while it is still valid."""
        ...
