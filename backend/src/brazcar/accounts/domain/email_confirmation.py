"""Changing the e-mail by a link sent to the new address (D-168).

The link's token carries everything it proves, signed by the adapter, and nothing is stored while
it waits: the account, the new address, the deadline and the confirmation the account had when the
link was sent. A later confirmation of any address retires every link sent before it, so a link
works once.
"""

from datetime import datetime, timedelta
from typing import Self

from pydantic import EmailStr

from brazcar.shared.domain.model import FrozenModel

from .account import Account, AccountId
from .errors import InvalidConfirmationLinkError

EMAIL_LINK_LIFETIME = timedelta(hours=2)
"""How long the link sent to the new address lasts, from the moment it is asked for."""


class EmailConfirmation(FrozenModel):
    account_id: AccountId
    email: EmailStr
    expires_at: datetime
    previous_confirmation: datetime | None
    """The account's `email_confirmed_at` when the link was sent: once it changes, the link is spent."""

    @classmethod
    def ask(cls, account: Account, email: str, now: datetime) -> Self:
        """The link for `email`, the address `account` wants. Refuses one that is not an address."""
        return cls(
            account_id=account.id,
            email=email,
            expires_at=now + EMAIL_LINK_LIFETIME,
            previous_confirmation=account.email_confirmed_at,
        )

    def confirm(self, account: Account, now: datetime) -> Account:
        """`account` with this address, confirmed as of `now`.

        Raises `InvalidConfirmationLinkError` alike for another account's link, a lapsed one and one
        already spent: the answer never tells them apart.
        """
        valid = (
            self.account_id == account.id
            and now < self.expires_at
            and self.previous_confirmation == account.email_confirmed_at
        )
        if not valid:
            raise InvalidConfirmationLinkError
        return account.confirm_email(self.email, now)
