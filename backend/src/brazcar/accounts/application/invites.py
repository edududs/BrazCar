"""The invite's use cases that belong to this step: issuing it and spending it (D-166)."""

from dataclasses import dataclass, field

from brazcar.accounts.domain import (
    AccountId,
    Invite,
    InviteNotFoundError,
    InvitePolicy,
    InviteStatus,
    InviteSupersededError,
    PhoneAlreadyRegisteredError,
    account_phone,
)
from brazcar.shared.application.ports import Clock

from .ports import AccountRepository, InviteRepository


@dataclass(frozen=True, slots=True)
class IssueInvite:
    """The owner invites one phone. Issuing again for the same phone supersedes the earlier invite,
    by computation alone: the earlier one is never written again (ADR-0008)."""

    invites: InviteRepository
    accounts: AccountRepository
    clock: Clock
    policy: InvitePolicy = field(default_factory=InvitePolicy)

    async def __call__(self, *, phone: str) -> tuple[Invite, str]:
        normalized = account_phone(phone)
        if await self.accounts.by_phone(normalized) is not None:
            raise PhoneAlreadyRegisteredError(normalized)
        invite, token = Invite.issue(normalized, self.clock.now(), self.policy)
        await self.invites.save(invite)
        return invite, token


@dataclass(frozen=True, slots=True)
class ConsumeInvite:
    """Spend the invite whose e-mail link carries `email_token` on the account it finished."""

    invites: InviteRepository
    clock: Clock

    async def __call__(self, *, email_token: str, account_id: AccountId) -> Invite:
        invite = await self.invites.by_email_token(email_token)
        if invite is None:
            raise InviteNotFoundError
        latest = await self.invites.latest_for(invite.phone)
        is_latest = latest is not None and latest.id == invite.id
        now = self.clock.now()
        # Consumed outranks superseded, so a spent invite still answers "already used" below.
        if invite.status(now, latest=is_latest) is InviteStatus.SUPERSEDED:
            raise InviteSupersededError
        consumed = invite.consume(email_token, account_id, now)
        await self.invites.save(consumed)
        return consumed
