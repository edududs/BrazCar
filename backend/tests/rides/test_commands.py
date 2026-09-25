from datetime import UTC, datetime
from io import StringIO

import pytest
from asgiref.sync import sync_to_async
from django.core.management import CommandError, call_command

from brazcar.accounts.adapters.repository import DjangoAccountRepository
from brazcar.accounts.domain import Account
from brazcar.rides.adapters.repository import DjangoContactRequests, DjangoRideRepository
from brazcar.rides.domain import RideId
from brazcar.shared.domain.phone import PhoneNumber
from tests.contracts.contact_requests import published_ride

PHONE = "+5561999990001"
ACCOUNT_PHONE = "+5561999990002"


async def _run(*args: str, out: StringIO | None = None) -> None:
    # The command opens a loop of its own, so it may not share this one's single thread executor.
    await sync_to_async(call_command, thread_sensitive=False)(
        "contact_requests", *args, stdout=out or StringIO()
    )


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
class TestContactRequestsCommand:
    async def _seed(self) -> RideId:
        """One requester with one contact request on a ride of its own; both phones known."""
        account = Account.register(
            phone=ACCOUNT_PHONE,
            display_name="Passageira",
            email=None,
            accepted_terms_at=datetime(2026, 9, 22, tzinfo=UTC),
        )
        await DjangoAccountRepository().save(account)
        ride = published_ride(account.id, now=datetime(2026, 9, 22, 12, tzinfo=UTC))
        await DjangoRideRepository().save(ride, ())
        await DjangoContactRequests().record(
            requester_id=account.id,
            ride_id=ride.id,
            phone_revealed=PhoneNumber.parse(PHONE),
            driver_kind="external",
            driver_account_id=None,
            at=datetime.now(UTC),
        )
        return ride.id

    async def test_by_account_lists_and_masks_the_phone_by_default(self) -> None:
        ride_id = await self._seed()
        out = StringIO()

        await _run("--account", ACCOUNT_PHONE, out=out)

        lines = out.getvalue().splitlines()
        assert str(ride_id) in lines[0]
        assert "+5561*****0001" in lines[0]
        assert PHONE not in lines[0]
        assert lines[-1] == "1 request(s) in the last 24h"

    async def test_by_phone_with_reveal_shows_the_whole_number(self) -> None:
        await self._seed()
        out = StringIO()

        await _run("--phone", PHONE, "--reveal", out=out)

        lines = out.getvalue().splitlines()
        assert PHONE in lines[0]

    async def test_neither_flag_is_refused(self) -> None:
        with pytest.raises(CommandError, match="exactly one"):
            await _run()

    async def test_both_flags_is_refused(self) -> None:
        with pytest.raises(CommandError, match="exactly one"):
            await _run("--account", ACCOUNT_PHONE, "--phone", PHONE)

    async def test_an_unknown_account_is_refused(self) -> None:
        with pytest.raises(CommandError, match="no account"):
            await _run("--account", "+5561999998888")

    async def test_a_ride_that_no_longer_exists_says_so(self) -> None:
        ride_id = await self._seed()
        await DjangoRideRepository().delete(ride_id)
        out = StringIO()

        await _run("--account", ACCOUNT_PHONE, out=out)

        assert "carona apagada" in out.getvalue()
