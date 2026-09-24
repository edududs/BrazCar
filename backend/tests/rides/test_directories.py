"""`rides` finds an account by the phone of a group message through `accounts`' own port (D-127)."""

from datetime import UTC, datetime

import pytest

from brazcar.accounts.adapters.repository import DjangoAccountRepository
from brazcar.accounts.domain import Account
from brazcar.rides.adapters.directories import AccountDriverDirectory
from brazcar.shared.domain.phone import PhoneNumber

pytestmark = [
    pytest.mark.contract,
    pytest.mark.django_db(transaction=True),
    pytest.mark.usefixtures("worker_thread_connections_closed"),
]


@pytest.mark.parametrize("sender", ["5561999990001", "556199990001"])
async def test_a_sender_is_linked_to_the_account_with_or_without_the_ninth_digit(sender: str) -> None:
    """Before D-138 the old WhatsApp address `556199990001` never matched `+5561999990001`."""
    accounts = DjangoAccountRepository()
    ana = Account.register(
        phone="(61) 99999-0001", display_name="Ana", email=None, accepted_terms_at=datetime.now(tz=UTC)
    )
    await accounts.save(ana)

    found = await AccountDriverDirectory(accounts).by_phone(PhoneNumber.from_jid_user(sender))

    assert found is not None
    assert found.id == ana.id
    assert found.phone == ana.phone
