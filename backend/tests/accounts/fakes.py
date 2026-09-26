"""In-memory adapters for the use-case tests. The repository is held to the port contract."""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from brazcar.accounts.domain import (
    Account,
    AccountId,
    Invite,
    InviteConflictError,
    InviteId,
    Issued,
    PhoneAlreadyRegisteredError,
    token_digest,
)
from brazcar.shared.domain.phone import PhoneNumber


class InMemoryAccountRepository:
    def __init__(self) -> None:
        self._accounts: dict[AccountId, Account] = {}

    async def get(self, account_id: AccountId) -> Account | None:
        return self._accounts.get(account_id)

    async def by_phone(self, phone: PhoneNumber) -> Account | None:
        return next((a for a in self._accounts.values() if a.phone == phone), None)

    async def save(self, account: Account) -> None:
        owner = await self.by_phone(account.phone)
        if owner is not None and owner.id != account.id:
            raise PhoneAlreadyRegisteredError(account.phone)
        self._accounts[account.id] = account

    async def erase(self, account_id: AccountId) -> None:
        self._accounts.pop(account_id, None)


class InMemoryInviteRepository:
    def __init__(self) -> None:
        self._invites: dict[InviteId, Invite] = {}

    async def save(self, invite: Invite) -> None:
        stored = self._invites.get(invite.id)
        if stored is not None and stored.version != invite.version - 1:
            raise InviteConflictError(invite.id)
        self._invites[invite.id] = invite

    async def by_invite_token(self, token: str) -> Invite | None:
        digest = token_digest(token)
        return next((i for i in self._invites.values() if i.invite_digest == digest), None)

    async def by_email_token(self, token: str) -> Invite | None:
        digest = token_digest(token)
        return next(
            (
                i
                for i in self._invites.values()
                if not isinstance(i.progress, Issued) and i.progress.email_digest == digest
            ),
            None,
        )

    async def latest_for(self, phone: PhoneNumber) -> Invite | None:
        own = [i for i in self._invites.values() if i.phone == phone]
        return max(own, key=lambda i: (i.issued_at, i.id), default=None)


class InMemoryCredentials:
    def __init__(self, accounts: InMemoryAccountRepository) -> None:
        self.accounts = accounts
        self.passwords: dict[AccountId, str] = {}

    async def register(self, account_id: AccountId, password: str) -> None:
        self.passwords[account_id] = password

    async def verify(self, phone: PhoneNumber, password: str) -> AccountId | None:
        account = await self.accounts.by_phone(phone)
        if account is None or self.passwords.get(account.id) != password:
            return None
        return account.id

    async def change(self, account_id: AccountId, password: str) -> None:
        self.passwords[account_id] = password


class InMemoryResetTokens:
    def __init__(self) -> None:
        self.issued: dict[str, AccountId] = {}

    async def issue(self, account_id: AccountId) -> str:
        token = uuid4().hex
        self.issued[token] = account_id
        return token

    async def redeem(self, token: str) -> UUID | None:
        return self.issued.pop(token, None)


class RecordingMailer:
    def __init__(self) -> None:
        self.sent: list[tuple[str, str, str]] = []

    async def send(self, *, to: str, subject: str, body: str) -> None:
        self.sent.append((to, subject, body))


class FixedClock:
    def __init__(self, at: datetime = datetime(2026, 9, 22, 12, 0, tzinfo=UTC)) -> None:
        self.at = at

    def now(self) -> datetime:
        return self.at
