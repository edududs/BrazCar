"""The accounts' answer to `shared`'s `WriteGate` (D-168): which signed-in account may not write yet.

The rule is `Account.required_action`; this adapter only reads it and puts it in the words of the
screen. Every context's composition hands it to `gated_session_auth` through `writer_auth`.
"""

from dataclasses import dataclass

from brazcar.accounts.application import AccountRepository
from brazcar.accounts.domain import AccountId, RequiredAction
from brazcar.shared.adapters.session_auth import Hold

HOLDS: dict[RequiredAction, str] = {"confirm_email": "confirme seu e-mail para continuar"}


@dataclass(frozen=True, slots=True)
class AccountWriteGate:
    accounts: AccountRepository

    async def hold(self, account_id: AccountId) -> Hold | None:
        """`None` for an account that is gone as well: the route itself answers for that."""
        account = await self.accounts.get(account_id)
        action = None if account is None else account.required_action
        return None if action is None else Hold(required_action=action, detail=HOLDS[action])
