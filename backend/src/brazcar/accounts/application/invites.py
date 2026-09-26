"""The invite's use cases (D-166, D-167): the owner issues it, the person opens its link, gives an
e-mail, and the link sent to that e-mail finishes the registration. Registration exists only here."""

from dataclasses import dataclass, field
from datetime import datetime, timedelta

from brazcar.accounts.domain import (
    Account,
    EmailAlreadyRegisteredError,
    EmailGiven,
    Invite,
    InviteAlreadyUsedError,
    InviteExpiredError,
    InviteNotFoundError,
    InvitePolicy,
    InviteStatus,
    InviteSupersededError,
    PhoneAlreadyRegisteredError,
    TooManyAttemptsError,
    account_phone,
)
from brazcar.shared.application.ports import Clock, Mailer, RateLimiter
from brazcar.shared.domain.phone import PhoneNumber

from .ports import AccountRepository, Credentials, InviteRepository
from .wording import in_hours


@dataclass(frozen=True, slots=True)
class InviteLimits:
    """How often one invite may send its e-mail (D-167). Per invite, so an invite never becomes a
    way to mail strangers; the window is the invite's own lifetime."""

    email_requests: int = 5
    email_window: timedelta = timedelta(hours=4)


@dataclass(frozen=True, slots=True)
class InviteView:
    """What the invite's own link shows. Only `open` and `awaiting_email_confirmation` get here;
    every other status is refused with its own error. The route masks phone and e-mail."""

    status: InviteStatus
    phone: PhoneNumber
    expires_at: datetime
    email: str | None
    """The e-mail given, while its link is still good; `None` when there is none to confirm."""


@dataclass(frozen=True, slots=True)
class SignupView:
    """What the e-mail link shows before the rest of the registration: phone and e-mail, fixed."""

    phone: PhoneNumber
    email: str
    email_expires_at: datetime


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
class OpenInvite:
    """What the invite's link opens on: the invite, while it can still lead to an account."""

    invites: InviteRepository
    accounts: AccountRepository
    clock: Clock

    async def __call__(self, *, token: str) -> InviteView:
        invite = await self.invites.by_invite_token(token)
        if invite is None:
            raise InviteNotFoundError
        status = await _usable(self.invites, self.accounts, invite, self.clock.now())
        awaiting = status is InviteStatus.AWAITING_EMAIL_CONFIRMATION
        return InviteView(
            status=status,
            phone=invite.phone,
            expires_at=invite.expires_at,
            email=invite.email if awaiting else None,
        )


@dataclass(frozen=True, slots=True)
class GiveInviteEmail:
    """The person types the e-mail on the invite's page; its link goes to that e-mail (D-167).

    Typing it again replaces the link, and the old one dies. The e-mail is refused when it already
    has an account, which tells whoever holds a valid invite that the address exists: an accepted
    risk, since only the owner hands invites out.
    """

    invites: InviteRepository
    accounts: AccountRepository
    mailer: Mailer
    limiter: RateLimiter
    clock: Clock
    signup_link: str  # the front's page, with `{token}` where the e-mail link's token goes
    policy: InvitePolicy = field(default_factory=InvitePolicy)
    limits: InviteLimits = field(default_factory=InviteLimits)

    async def __call__(self, *, token: str, email: str) -> None:
        invite = await self.invites.by_invite_token(token)
        if invite is None:
            raise InviteNotFoundError
        now = self.clock.now()
        await _usable(self.invites, self.accounts, invite, now)  # superseded before any e-mail goes
        waiting, email_token = invite.give_email(email, now, self.policy)  # checks address and deadline
        allowed = await self.limiter.acquire(
            f"invite-email:{invite.id}", limit=self.limits.email_requests, window=self.limits.email_window
        )
        if not allowed:
            raise TooManyAttemptsError
        if await self.accounts.by_email(email) is not None:
            raise EmailAlreadyRegisteredError
        await self.invites.save(waiting)
        await self.mailer.send(
            to=email,
            subject="BrazCar: confirme seu e-mail",
            body=(
                "Olá.\n\n"
                "Para confirmar este e-mail e terminar seu cadastro no BrazCar, abra o link abaixo:\n"
                f"{self.signup_link.format(token=email_token)}\n\n"
                f"O link vale {in_hours(self.policy.email_link_lifetime)}. "
                "Se você não pediu isso, ignore esta mensagem."
            ),
        )


@dataclass(frozen=True, slots=True)
class OpenSignup:
    """What the e-mail link opens on: the phone and the e-mail the account will have."""

    invites: InviteRepository
    accounts: AccountRepository
    clock: Clock

    async def __call__(self, *, email_token: str) -> SignupView:
        invite = await _by_email_token(self.invites, email_token)
        given = await _awaiting_confirmation(self.invites, self.accounts, invite, self.clock.now())
        return SignupView(phone=invite.phone, email=given.email, email_expires_at=given.email_expires_at)


@dataclass(frozen=True, slots=True)
class RegisterFromInvite:
    """The only way to sign up (D-159, D-167): the e-mail link finishes the account, phone and
    e-mail taken from the invite, the e-mail already confirmed.

    Three writes and no unit of work (ADR-0008), in this order: the account, whose unique phone is
    the first lock; the password; then the invite, consumed over its version, the second lock.
    Stopping anywhere in between is harmless: once the phone has an account the invite can no
    longer be used, and the account already reaches its confirmed e-mail, which recovers the password.
    """

    invites: InviteRepository
    accounts: AccountRepository
    credentials: Credentials
    clock: Clock

    async def __call__(self, *, email_token: str, display_name: str, password: str) -> Account:
        invite = await _by_email_token(self.invites, email_token)
        now = self.clock.now()
        given = await _awaiting_confirmation(self.invites, self.accounts, invite, now)
        account = Account.register_from_invite(
            phone=invite.phone, email=given.email, display_name=display_name, now=now
        )
        await self.accounts.save(account)
        await self.credentials.register(account.id, password)
        await self.invites.save(invite.consume(email_token, account.id, now))
        return account


async def _by_email_token(invites: InviteRepository, email_token: str) -> Invite:
    invite = await invites.by_email_token(email_token)
    if invite is None:
        raise InviteNotFoundError
    return invite


async def _usable(
    invites: InviteRepository, accounts: AccountRepository, invite: Invite, now: datetime
) -> InviteStatus:
    """The status of an invite that can still lead to an account; every other one is raised, in the
    order that names it best: spent, superseded, a phone that got an account some other way (as
    final as spent: one phone, one account), then expired."""
    latest = await invites.latest_for(invite.phone)
    status = invite.status(now, latest=latest is not None and latest.id == invite.id)
    if status is InviteStatus.CONSUMED:
        raise InviteAlreadyUsedError
    if status is InviteStatus.SUPERSEDED:
        raise InviteSupersededError
    if await accounts.by_phone(invite.phone) is not None:
        raise PhoneAlreadyRegisteredError(invite.phone)
    if status is InviteStatus.EXPIRED:
        raise InviteExpiredError
    return status


async def _awaiting_confirmation(
    invites: InviteRepository, accounts: AccountRepository, invite: Invite, now: datetime
) -> EmailGiven:
    status = await _usable(invites, accounts, invite, now)
    match invite.progress:
        case EmailGiven() as given if status is InviteStatus.AWAITING_EMAIL_CONFIRMATION:
            return given
        case _:  # the e-mail link lapsed, and the invite reads open again (D-166)
            raise InviteExpiredError
