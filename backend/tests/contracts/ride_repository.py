from datetime import UTC, datetime, time, timedelta
from uuid import uuid4

from hypothesis import given
from hypothesis import strategies as st

from brazcar.rides.application import BoardRevision, RideRepository
from brazcar.rides.domain import (
    MAX_SEATS,
    AccountId,
    CatalogStop,
    ExternalDriver,
    PaymentMethod,
    RegisteredDriver,
    RideOffer,
)
from brazcar.shared.domain.phone import PhoneNumber
from tests.rides.strategies import BRASILIA, car, imported_rides, published, registered, rides

from . import contract_settings


class RideRepositoryContract:
    """Subclass as `TestMyRepository`; implement `make_repository`, `make_revision` and `driver`.

    Ride identifiers are fresh per example, so no example collides with what an earlier one stored.
    The driver is the one thing a ride needs from outside: the implementation says how one exists.
    """

    def make_repository(self) -> RideRepository:
        raise NotImplementedError

    def make_revision(self) -> BoardRevision:
        """The counter the repository bumps; it may be the repository itself."""
        raise NotImplementedError

    async def driver(self) -> AccountId:
        """An account that may own rides. The fake takes any identifier; the adapter needs a row."""
        return uuid4()

    @contract_settings
    @given(ride=rides())
    async def test_saved_ride_loads_back_equal_with_its_events_and_bumps_the_board(
        self, ride: RideOffer
    ) -> None:
        repository, revision = self.make_repository(), self.make_revision()
        ride = ride.evolve(driver=registered(await self.driver()))
        born = published(ride)
        before = await revision.current()

        await repository.save(ride, (born,))

        assert await repository.get(ride.id) == ride
        assert await repository.history(ride.id) == (born,)
        assert await revision.current() == before + 1

    @contract_settings
    @given(ride=rides(), seats=st.integers(0, MAX_SEATS))
    async def test_saving_again_replaces_the_state_and_appends_the_events(
        self, ride: RideOffer, seats: int
    ) -> None:
        repository, revision = self.make_repository(), self.make_revision()
        ride = ride.evolve(driver=registered(await self.driver()), cancelled_at=None)
        await repository.save(ride, (published(ride),))
        changed = ride.change_seats(seats, ride.published_at + timedelta(minutes=1))
        before = await revision.current()

        await repository.save(changed.ride, changed.events)
        await repository.save(changed.ride, ())  # nothing happened: nothing appended, nothing bumped

        assert await repository.get(ride.id) == changed.ride
        history = await repository.history(ride.id)
        assert history == (published(ride), *changed.events)
        assert await revision.current() == before + (1 if changed.events else 0)

    @contract_settings
    @given(ride=rides())
    async def test_the_local_day_survives_the_round_trip(self, ride: RideOffer) -> None:
        """The same-day rule of ADR-0004 reads the date in the ride's own zone, not in UTC."""
        repository = self.make_repository()
        ride = ride.evolve(driver=registered(await self.driver()))
        await repository.save(ride, (published(ride),))

        loaded = await repository.get(ride.id)

        assert loaded is not None
        for name in ("departure_at", "original_departure_at", "published_at"):
            stored, wanted = getattr(loaded, name), getattr(ride, name)
            assert stored.utcoffset() == wanted.utcoffset(), name
            assert stored.date() == wanted.date(), name

    @contract_settings
    @given(rides=st.lists(rides(), min_size=1, max_size=4))
    async def test_upcoming_lists_what_is_not_cancelled_from_since_on_earliest_first(
        self, rides: list[RideOffer]
    ) -> None:
        repository = self.make_repository()
        driver = await self.driver()
        rides = [ride.evolve(driver=registered(driver)) for ride in rides]
        for ride in rides:
            await repository.save(ride, (published(ride),))
        since = min(ride.departure_at for ride in rides) + timedelta(hours=12)

        upcoming = await repository.upcoming(since)
        mine = await repository.by_driver(driver)

        listed = [ride for ride in upcoming if ride.id in {r.id for r in rides}]
        assert listed == sorted(
            (r for r in rides if r.cancelled_at is None and r.departure_at >= since),
            key=lambda r: (r.departure_at, r.published_at),
        )
        assert [r.departure_at for r in upcoming] == sorted(r.departure_at for r in upcoming)
        assert {r.id for r in mine} == {r.id for r in rides}
        assert [r.departure_at for r in mine] == sorted((r.departure_at for r in mine), reverse=True)

    async def test_unknown_ride_loads_as_none_with_no_history(self) -> None:
        repository = self.make_repository()

        assert await repository.get(uuid4()) is None
        assert await repository.history(uuid4()) == ()

    @contract_settings
    @given(
        ride=imported_rides(),
        number=st.sampled_from(("+1 415 555 2671", "+351 912 345 678", "(61) 3333-4444")),
    )
    async def test_a_group_may_carry_a_landline_or_a_number_from_abroad(
        self, ride: RideOffer, number: str
    ) -> None:
        """Any number WhatsApp carries is a driver (D-137); it comes back the same number."""
        repository = self.make_repository()
        ride = ride.evolve(driver=ExternalDriver(phone=PhoneNumber.parse(number), display_name="De fora"))
        await repository.save(ride, (published(ride),))

        assert await repository.get(ride.id) == ride
        assert await repository.find_imported(PhoneNumber.parse(number), ride.departure_at) == ride
        await repository.delete(ride.id)

    @contract_settings
    @given(ride=imported_rides())
    async def test_an_imported_ride_is_found_by_its_driver_and_departure_then_forgotten(
        self, ride: RideOffer
    ) -> None:
        """Repost joins by phone and departure (D-113); the purge deletes for good and bumps (D-119)."""
        repository, revision = self.make_repository(), self.make_revision()
        driver = ride.driver
        assert isinstance(driver, ExternalDriver)
        await repository.save(ride, (published(ride),))

        assert await repository.get(ride.id) == ride
        assert await repository.find_imported(driver.phone, ride.departure_at) == ride
        assert await repository.find_imported(driver.phone, ride.departure_at + timedelta(minutes=1)) is None
        assert await repository.find_imported(PhoneNumber.parse("+44 7911 123456"), ride.departure_at) is None

        assert ride.id in await repository.external_rides(phone=driver.phone)
        assert ride.id in await repository.external_rides(
            departed_before=ride.departure_at + timedelta(minutes=1)
        )
        assert ride.id not in await repository.external_rides(departed_before=ride.departure_at)

        before = await revision.current()
        await repository.delete(ride.id)
        await repository.delete(ride.id)  # gone already: nothing happens, nothing bumped

        assert await repository.get(ride.id) is None
        assert await repository.history(ride.id) == ()
        assert await repository.find_imported(driver.phone, ride.departure_at) is None
        assert await revision.current() == before + 1

    @contract_settings
    @given(ride=imported_rides())
    async def test_an_imported_ride_linked_to_an_account_is_found_by_the_account(
        self, ride: RideOffer
    ) -> None:
        repository = self.make_repository()
        account = await self.driver()
        ride = ride.evolve(driver=registered(account).evolve(car=None))
        await repository.save(ride, (published(ride),))

        loaded = await repository.get(ride.id)

        assert loaded == ride
        assert loaded is not None
        assert loaded.car is None
        assert await repository.find_imported(account, ride.departure_at) == ride

    async def test_from_time_keeps_only_rides_whose_local_hour_is_at_or_after_it(self) -> None:
        """The boundary of D-141: 17:59 local out, 18:00 local in, whichever database answers.

        `since` is pinned a minute before UTC midnight, so the query's own absolute lower bound
        crosses a UTC day right where the two rides sit — a wrong implementation that extracted the
        hour from the *UTC* instant, instead of the ride's local one (D-094), would see this.
        """
        repository = self.make_repository()
        driver = registered(await self.driver())
        day = datetime(2026, 9, 22, tzinfo=BRASILIA).date()
        before_bound = datetime.combine(day, time(17, 59), tzinfo=BRASILIA)
        at_bound = datetime.combine(day, time(18, 0), tzinfo=BRASILIA)
        since = before_bound.astimezone(UTC).replace(hour=23, minute=59, second=0, microsecond=0)
        since -= timedelta(days=1)  # a minute short of UTC midnight, the day before both rides
        early = _ride_at(driver, before_bound)
        late = _ride_at(driver, at_bound)
        await repository.save(early, (published(early),))
        await repository.save(late, (published(late),))

        found = await repository.upcoming(since, from_time=time(18, 0))

        found_ids = {ride.id for ride in found}
        assert early.id not in found_ids
        assert late.id in found_ids


def _ride_at(driver: RegisteredDriver, departure_at: datetime) -> RideOffer:
    """A minimal, valid, published ride, for the from-time boundary test."""
    return RideOffer.publish(
        driver_id=driver.account_id,
        car=car() if driver.car is None else driver.car,
        route=(CatalogStop(place_id="brazlandia"), CatalogStop(place_id="esplanada")),
        departure_at=departure_at,
        seats_available=1,
        payment_methods=frozenset({PaymentMethod.PIX}),
        now=departure_at - timedelta(hours=1),
    ).ride
