"""Storage of invites (D-166): one thread hop and one transaction per write (ADR-0008)."""

from asgiref.sync import sync_to_async
from django.db import IntegrityError, transaction

from brazcar.accounts.domain import Consumed, EmailGiven, Invite, InviteConflictError, Issued, token_digest
from brazcar.shared.domain.phone import PhoneNumber

from .models import InviteModel


class DjangoInviteRepository:
    """`InviteRepository` over the ORM. `save` writes the whole row, optimistic on `version`."""

    async def save(self, invite: Invite) -> None:
        await sync_to_async(_save)(invite)

    async def by_invite_token(self, token: str) -> Invite | None:
        return await sync_to_async(_by)(invite_digest=token_digest(token))

    async def by_email_token(self, token: str) -> Invite | None:
        return await sync_to_async(_by)(email_digest=token_digest(token))

    async def latest_for(self, phone: PhoneNumber) -> Invite | None:
        return await sync_to_async(_latest_for)(phone)


def _by(**lookup: str) -> Invite | None:
    row = InviteModel.objects.filter(**lookup).first()
    return None if row is None else _to_entity(row)


def _latest_for(phone: PhoneNumber) -> Invite | None:
    row = InviteModel.objects.filter(phone=phone.e164()).order_by("-issued_at", "-id").first()
    return None if row is None else _to_entity(row)


def _save(invite: Invite) -> None:
    """Write over the version just before this one; a brand new id inserts whatever version the
    invite already carries - a fresh aggregate may reach `save` past `version=0`, built in memory
    through several transitions before its first write (`InMemoryInviteRepository`'s own rule)."""
    fields = _row_fields(invite)
    try:
        # A savepoint keeps a conflict from poisoning the outer transaction, the same way the
        # account repository's unique violation does (`repository.py`).
        with transaction.atomic():
            updated = InviteModel.objects.filter(id=invite.id, version=invite.version - 1).update(
                version=invite.version, **fields
            )
            if updated == 0:
                InviteModel.objects.create(id=invite.id, version=invite.version, **fields)
    except IntegrityError as error:
        raise InviteConflictError(invite.id) from error


def _row_fields(invite: Invite) -> dict[str, object]:
    progress: dict[str, object] = {
        "email": None,
        "email_digest": None,
        "email_given_at": None,
        "email_expires_at": None,
        "account_id": None,
        "consumed_at": None,
    }
    match invite.progress:
        case EmailGiven(email=email, email_digest=digest, email_given_at=given_at, email_expires_at=expires):
            progress.update(
                email=email, email_digest=digest, email_given_at=given_at, email_expires_at=expires
            )
        case Consumed(account_id=account_id, consumed_at=consumed_at, email=email, email_digest=digest):
            progress.update(account_id=account_id, consumed_at=consumed_at, email=email, email_digest=digest)
        case Issued():
            pass
    return {
        "phone": invite.phone.e164(),
        "invite_digest": invite.invite_digest,
        "issued_at": invite.issued_at,
        "expires_at": invite.expires_at,
        "kind": invite.progress.kind,
        **progress,
    }


def _to_entity(row: InviteModel) -> Invite:
    return Invite(
        id=row.id,
        phone=PhoneNumber.parse(row.phone),
        invite_digest=row.invite_digest,
        issued_at=row.issued_at,
        expires_at=row.expires_at,
        progress=_to_progress(row),
        version=row.version,
    )


def _to_progress(row: InviteModel) -> Issued | EmailGiven | Consumed:
    if row.kind == "consumed":
        assert row.account_id is not None  # noqa: S101 - the check constraint guarantees it
        assert row.consumed_at is not None  # noqa: S101
        assert row.email is not None  # noqa: S101
        assert row.email_digest is not None  # noqa: S101
        return Consumed(
            account_id=row.account_id,
            consumed_at=row.consumed_at,
            email=row.email,
            email_digest=row.email_digest,
        )
    if row.kind == "email_given":
        assert row.email is not None  # noqa: S101
        assert row.email_digest is not None  # noqa: S101
        assert row.email_given_at is not None  # noqa: S101
        assert row.email_expires_at is not None  # noqa: S101
        return EmailGiven(
            email=row.email,
            email_digest=row.email_digest,
            email_given_at=row.email_given_at,
            email_expires_at=row.email_expires_at,
        )
    return Issued()
