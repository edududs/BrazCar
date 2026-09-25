from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from brazcar.accounts.adapters.repository import DjangoAccountRepository
from brazcar.accounts.domain import Account
from brazcar.rides.adapters.repository import DjangoContactRequests, DjangoRideRepository
from brazcar.rides.application import ContactRequests
from brazcar.rides.domain import AccountId, RideId
from brazcar.shared.domain.phone import PhoneNumber
from tests.contracts.contact_requests import ContactRequestsContract, published_ride

from .fakes import RecordingContacts


class TestInMemoryContactRequests(ContactRequestsContract):
    def make_contacts(self) -> ContactRequests:
        return RecordingContacts()


@pytest.mark.contract
@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
class TestDjangoContactRequests(ContactRequestsContract):
    def make_contacts(self) -> ContactRequests:
        return DjangoContactRequests()

    async def requester(self) -> AccountId:
        digits = uuid4().int % 10**8
        account = Account.register(
            phone=f"+55619{digits:08d}",
            display_name="Passageiro",
            email=None,
            accepted_terms_at=datetime(2026, 9, 22, tzinfo=UTC),
        )
        await DjangoAccountRepository().save(account)
        return account.id

    async def ride(self) -> RideId:
        driver_id = await self.requester()
        ride = published_ride(driver_id, now=datetime(2026, 9, 22, 12, tzinfo=UTC))
        await DjangoRideRepository().save(ride, ())
        return ride.id

    async def test_forgetting_the_ride_keeps_the_request_with_no_ride(self) -> None:
        """`ForgetRides` deletes the ride (D-119); the contact history survives it (D-140)."""
        contacts, rides = self.make_contacts(), DjangoRideRepository()
        requester = await self.requester()
        ride_id = await self.ride()
        at = datetime.now(UTC)
        await contacts.record(
            requester_id=requester,
            ride_id=ride_id,
            phone_revealed=PhoneNumber.parse("+5561999990001"),
            driver_kind="external",
            driver_account_id=None,
            at=at,
        )

        await rides.delete(ride_id)

        (found,) = await contacts.by_account(requester, since=at - timedelta(minutes=1))
        assert found.ride_id is None
        assert found.phone_revealed == PhoneNumber.parse("+5561999990001")
