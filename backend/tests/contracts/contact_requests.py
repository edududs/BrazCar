from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

from hypothesis import given
from hypothesis import strategies as st

from brazcar.rides.application import ContactRequests, DriverKind
from brazcar.rides.domain import AccountId, CarSnapshot, CatalogStop, PaymentMethod, RideId, RideOffer
from brazcar.shared.domain.phone import PhoneNumber
from tests.shared.phone_strategies import brazilian_mobiles

from . import contract_settings

ROUTE = (CatalogStop(place_id="brazlandia"), CatalogStop(place_id="esplanada"))
KINDS: tuple[DriverKind, ...] = ("registered", "external")


class ContactRequestsContract:
    """Subclass as `TestMyContactRequests`; implement `make_contacts`, `requester` and `ride`.

    Every account and ride is fresh per example, so no Hypothesis example collides with another.
    """

    def make_contacts(self) -> ContactRequests:
        raise NotImplementedError

    async def requester(self) -> AccountId:
        """An account that may ask for contact. The fake takes any identifier; the adapter needs a row."""
        return uuid4()

    async def ride(self) -> RideId:
        """A ride the record may point at. The fake takes any identifier; the adapter needs a row."""
        return uuid4()

    @contract_settings
    @given(phone=brazilian_mobiles, kind=st.sampled_from(KINDS))
    async def test_a_recorded_request_is_found_by_account_and_by_phone_within_the_window(
        self, phone: PhoneNumber, kind: DriverKind
    ) -> None:
        contacts = self.make_contacts()
        requester, ride_id = await self.requester(), await self.ride()
        at = datetime.now(UTC)
        driver_account_id = requester if kind == "registered" else None

        await contacts.record(
            requester_id=requester,
            ride_id=ride_id,
            phone_revealed=phone,
            driver_kind=kind,
            driver_account_id=driver_account_id,
            at=at,
        )

        by_account = await contacts.by_account(requester, since=at - timedelta(minutes=1))
        by_phone = await contacts.by_phone(phone, since=at - timedelta(minutes=1))
        count = await contacts.count_by_account(requester, since=at - timedelta(minutes=1))
        outside = await contacts.by_account(requester, since=at + timedelta(seconds=1))

        (found,) = [r for r in by_account if r.ride_id == ride_id]
        assert found.requester_id == requester
        assert found.phone_revealed == phone
        assert found.driver_kind == kind
        assert found.driver_account_id == driver_account_id
        assert any(r.ride_id == ride_id for r in by_phone)
        assert count >= 1
        assert not any(r.ride_id == ride_id for r in outside)

    @contract_settings
    @given(phone=brazilian_mobiles)
    async def test_a_request_of_another_account_or_phone_is_left_out(self, phone: PhoneNumber) -> None:
        contacts = self.make_contacts()
        requester, ride_id = await self.requester(), await self.ride()
        at = datetime.now(UTC)

        await contacts.record(
            requester_id=requester,
            ride_id=ride_id,
            phone_revealed=phone,
            driver_kind="external",
            driver_account_id=None,
            at=at,
        )

        someone_else = await contacts.by_account(uuid4(), since=at - timedelta(minutes=1))
        another_number = await contacts.by_phone(
            PhoneNumber.parse("+1 415 555 2671"), since=at - timedelta(minutes=1)
        )

        assert not any(r.ride_id == ride_id for r in someone_else)
        assert not any(r.ride_id == ride_id for r in another_number)

    async def test_an_account_with_no_requests_counts_zero(self) -> None:
        contacts = self.make_contacts()

        assert await contacts.count_by_account(uuid4(), since=datetime.now(UTC) - timedelta(hours=1)) == 0
        assert await contacts.by_account(uuid4(), since=datetime.now(UTC) - timedelta(hours=1)) == ()


def published_ride(driver_id: AccountId, *, now: datetime) -> RideOffer:
    """A minimal, valid ride, for the adapter's `ride()` to store and hand back an identifier."""
    return RideOffer.publish(
        driver_id=driver_id,
        car=CarSnapshot(car_id=uuid4(), model="Gol", color="prata", plate="ABC1234"),
        route=ROUTE,
        departure_at=now + timedelta(hours=1),
        seats_available=2,
        price=Decimal("7.00"),
        payment_methods=frozenset({PaymentMethod.PIX}),
        now=now,
    ).ride
