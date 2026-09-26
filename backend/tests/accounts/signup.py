"""Signing up the one way there is (D-167): an invite, its e-mail, then the registration.

For every test that needs a signed-in account over HTTP. The invite comes from the owner's own use
case and the e-mail is given straight on the invite and its repository, so no message has to be
read back; the registration itself is the caller's, through the route, as the front does it.

`legacy_account` is the other kind: an account from before the invite, without a confirmed e-mail,
held until it confirms one (D-168).
"""

from asgiref.sync import async_to_sync
from django.utils import timezone

from brazcar.accounts.adapters.composition import issue_invite
from brazcar.accounts.adapters.credentials import DjangoCredentials
from brazcar.accounts.adapters.invite_repository import DjangoInviteRepository
from brazcar.accounts.adapters.repository import DjangoAccountRepository
from brazcar.accounts.domain import Account, InvitePolicy

PASSWORD = "correct horse battery"


async def email_token_for(phone: str, email: str) -> str:
    """A fresh invite for `phone` with `email` given: the token its e-mail link would carry."""
    invite, _ = await issue_invite()(phone=phone)
    waiting, email_token = invite.give_email(email, timezone.now(), InvitePolicy())
    await DjangoInviteRepository().save(waiting)
    return email_token


async def registration(
    *, phone: str, email: str, display_name: str = "Ana", password: str = PASSWORD
) -> dict[str, str | bool]:
    """The body of `POST /api/accounts/register`, for a fresh invite of `phone` and `email`."""
    return {
        "email_token": await email_token_for(phone, email),
        "display_name": display_name,
        "password": password,
        "accepts_terms": True,
    }


def registration_sync(*, phone: str, email: str, display_name: str = "Ana") -> dict[str, str | bool]:
    """`registration`, for a synchronous test (the contract fuzz, which talks to a live server)."""
    return async_to_sync(registration)(phone=phone, email=email, display_name=display_name)


async def legacy_account(*, phone: str, email: str | None = None, password: str = PASSWORD) -> Account:
    """An account from before the invite, stored through the ports with its password: log it in
    over HTTP to get a held session."""
    account = Account.register(
        phone=phone, display_name="Antiga", email=email, accepted_terms_at=timezone.now()
    )
    await DjangoAccountRepository().save(account)
    await DjangoCredentials().register(account.id, password)
    return account
