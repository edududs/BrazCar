"""The invite that replaces open registration (D-159, D-166).

The owner issues it to one phone; the person opens its link, gives an e-mail, and the link sent to
that e-mail finishes the registration with the e-mail already confirmed (D-160). Only digests of
the two tokens are kept: the tokens themselves travel in the links and nowhere else.
"""

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Annotated, Literal, Self
from uuid import UUID, uuid4

from pydantic import EmailStr, Field, StringConstraints, model_validator

from brazcar.shared.domain.model import FrozenModel

from .account import AccountId
from .account_phone import AccountPhone
from .errors import (
    InviteAlreadyUsedError,
    InviteEmailMissingError,
    InviteExpiredError,
    InviteNotFoundError,
)

type InviteId = UUID
type TokenDigest = Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{64}$")]

_TOKEN_BYTES = 32


def token_digest(token: str) -> str:
    """The sha256 of a link's token, in hex: what is stored and what a lookup searches by."""
    return hashlib.sha256(token.encode()).hexdigest()


def _new_token() -> tuple[str, str]:
    token = secrets.token_urlsafe(_TOKEN_BYTES)
    return token, token_digest(token)


@dataclass(frozen=True, slots=True)
class InvitePolicy:
    lifetime: timedelta = timedelta(hours=4)
    """How long the invite's own link lasts, from issue."""
    email_link_lifetime: timedelta = timedelta(hours=2)
    """How long the e-mail's link lasts, from the moment the e-mail is given, past the invite's end."""


class InviteStatus(StrEnum):
    OPEN = "open"
    AWAITING_EMAIL_CONFIRMATION = "awaiting_email_confirmation"
    CONSUMED = "consumed"
    EXPIRED = "expired"
    SUPERSEDED = "superseded"


class Issued(FrozenModel):
    kind: Literal["issued"] = "issued"


class EmailGiven(FrozenModel):
    kind: Literal["email_given"] = "email_given"
    email: EmailStr
    email_digest: TokenDigest
    email_given_at: datetime
    email_expires_at: datetime

    @model_validator(mode="after")
    def _check(self) -> Self:
        if self.email_expires_at <= self.email_given_at:
            message = "the e-mail link expires before it was sent"
            raise ValueError(message)
        return self


class Consumed(FrozenModel):
    """Kept with the e-mail link's digest, so a second click on it reads "already used", not "unknown"."""

    kind: Literal["consumed"] = "consumed"
    account_id: AccountId
    consumed_at: datetime
    email: EmailStr
    email_digest: TokenDigest


type InviteProgress = Annotated[Issued | EmailGiven | Consumed, Field(discriminator="kind")]


class Invite(FrozenModel):
    """Single use, time-limited, bound to one phone. Expired and superseded are computed, never stored."""

    id: InviteId
    phone: AccountPhone
    invite_digest: TokenDigest
    issued_at: datetime
    expires_at: datetime
    progress: InviteProgress = Issued()
    version: Annotated[int, Field(ge=0)] = 0
    """Bumped by every change; the repository writes only over the version just before (optimistic)."""

    @model_validator(mode="after")
    def _check(self) -> Self:
        if self.expires_at <= self.issued_at:
            message = "the invite expires before it was issued"
            raise ValueError(message)
        match self.progress:
            case EmailGiven(email_given_at=at) | Consumed(consumed_at=at) if at < self.issued_at:
                message = "the invite moved on before it was issued"
                raise ValueError(message)
            case _:
                pass
        return self

    @classmethod
    def issue(cls, phone: AccountPhone, now: datetime, policy: InvitePolicy) -> tuple[Self, str]:
        """A new invite and the token for its link, in the clear, returned once and never stored."""
        token, digest = _new_token()
        invite = cls(
            id=uuid4(),
            phone=phone,
            invite_digest=digest,
            issued_at=now,
            expires_at=now + policy.lifetime,
        )
        return invite, token

    def status(self, now: datetime, *, latest: bool) -> InviteStatus:
        """Pure function of the progress, the clock and whether this is the phone's latest invite.

        Consumed wins everything; then a newer invite for the phone supersedes this one. The invite's
        deadline governs until the e-mail is given; from then on the e-mail link's deadline does,
        even past the invite's. A lapsed e-mail link with the invite still in time reads `open`
        again: the person gives the e-mail once more and gets a new link (D-166).
        """
        match self.progress:
            case Consumed():
                return InviteStatus.CONSUMED
            case _ if not latest:
                return InviteStatus.SUPERSEDED
            case EmailGiven(email_expires_at=link_deadline) if now <= link_deadline:
                return InviteStatus.AWAITING_EMAIL_CONFIRMATION
            case _ if now <= self.expires_at:
                return InviteStatus.OPEN
            case _:
                return InviteStatus.EXPIRED

    def give_email(self, email: str, now: datetime, policy: InvitePolicy) -> tuple[Self, str]:
        """Record the e-mail and a new token for its link. Giving it again replaces both: the old
        token dies. Only while the invite itself is in time."""
        if isinstance(self.progress, Consumed):
            raise InviteAlreadyUsedError
        if now > self.expires_at:
            raise InviteExpiredError
        token, digest = _new_token()
        progress = EmailGiven(
            email=email,
            email_digest=digest,
            email_given_at=now,
            email_expires_at=now + policy.email_link_lifetime,
        )
        return self.evolve(progress=progress, version=self.version + 1), token

    def consume(self, email_token: str, account_id: AccountId, now: datetime) -> Self:
        """Spend the invite on the account the e-mail link finished. Only the e-mail link's deadline
        counts here, never the invite's (D-166)."""
        match self.progress:
            case Consumed():
                raise InviteAlreadyUsedError
            case Issued():
                raise InviteEmailMissingError
            case EmailGiven() as given:
                if not hmac.compare_digest(token_digest(email_token), given.email_digest):
                    raise InviteNotFoundError
                if now > given.email_expires_at:
                    raise InviteExpiredError
                consumed = Consumed(
                    account_id=account_id,
                    consumed_at=now,
                    email=given.email,
                    email_digest=given.email_digest,
                )
                return self.evolve(progress=consumed, version=self.version + 1)
