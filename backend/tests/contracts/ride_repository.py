from datetime import timedelta
from uuid import uuid4

from hypothesis import given
from hypothesis import strategies as st

from brazcar.rides.application import BoardRevision, RideRepository
from brazcar.rides.domain import AccountId, RideOffer
from tests.rides.strategies import published, rides

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
        ride = ride.evolve(driver_id=await self.driver())
        born = published(ride)
        before = await revision.current()

        await repository.save(ride, (born,))

        assert await repository.get(ride.id) == ride
        assert await repository.history(ride.id) == (born,)
        assert await revision.current() == before + 1

    @contract_settings
    @given(ride=rides(), seats=st.integers(0, 8))
    async def test_saving_again_replaces_the_state_and_appends_the_events(
        self, ride: RideOffer, seats: int
    ) -> None:
        repository, revision = self.make_repository(), self.make_revision()
        ride = ride.evolve(driver_id=await self.driver(), cancelled_at=None)
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
        ride = ride.evolve(driver_id=await self.driver())
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
        rides = [ride.evolve(driver_id=driver) for ride in rides]
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
