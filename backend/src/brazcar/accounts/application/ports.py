from typing import Protocol

from brazcar.accounts.domain import Account, AccountId, Invite
from brazcar.shared.domain.phone import PhoneNumber


class AccountRepository(Protocol):
    async def get(self, account_id: AccountId) -> Account | None: ...

    async def by_phone(self, phone: PhoneNumber) -> Account | None: ...

    async def by_email(self, email: str) -> Account | None:
        """The account with this e-mail, case aside: the same reading the uniqueness uses (D-167)."""
        ...

    async def save(self, account: Account) -> None:
        """Insert or replace the account and its cars, whole (ADR-0008).

        Raises `PhoneAlreadyRegisteredError` when another account owns the phone, and
        `EmailAlreadyRegisteredError` when another account owns the e-mail, case aside.
        """
        ...

    async def erase(self, account_id: AccountId) -> None:
        """Anonymize: phone, name, e-mail and cars go; the identifier stays for ride history (D-033)."""
        ...


class Credentials(Protocol):
    """The password lives here, never in the domain."""

    async def register(self, account_id: AccountId, password: str) -> None: ...

    async def verify(self, phone: PhoneNumber, password: str) -> AccountId | None: ...

    async def change(self, account_id: AccountId, password: str) -> None: ...


class PasswordResetTokens(Protocol):
    async def issue(self, account_id: AccountId) -> str: ...

    async def redeem(self, token: str) -> AccountId | None:
        """The account the token was issued for, once, while it is still valid."""
        ...


class InviteRepository(Protocol):
    """Invites by the digest of either link's token; the tokens themselves are never stored (D-166)."""

    async def save(self, invite: Invite) -> None:
        """Write the invite whole (ADR-0008): insert it when new, or else only over the version just
        before `invite.version`.

        Raises `InviteConflictError` when another write got there first.
        """
        ...

    async def by_invite_token(self, token: str) -> Invite | None:
        """The invite whose own link carries `token`, looked up by `token_digest`."""
        ...

    async def by_email_token(self, token: str) -> Invite | None:
        """The invite whose e-mail link carries `token`, looked up by `token_digest`; also once consumed."""
        ...

    async def latest_for(self, phone: PhoneNumber) -> Invite | None:
        """The phone's most recent invite by `issued_at`, the greater id breaking a tie: the one valid."""
        ...
