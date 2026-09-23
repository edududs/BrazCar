from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from urllib.parse import quote
from uuid import UUID

from brazcar.rides.domain import (
    DEFAULT_PRICE,
    AccountId,
    CarSnapshot,
    CatalogStop,
    ContactLimitError,
    NoCarError,
    NotTheDriverError,
    PaymentMethod,
    RideId,
    RideNotFoundError,
    RideNotOpenError,
    RideOffer,
    RideStatus,
    Route,
    UnknownPlaceError,
)
from brazcar.shared.application.ports import Clock, RateLimiter
from brazcar.shared.domain.model import FrozenModel

from .ports import (
    ContactRequests,
    Driver,
    DriverDirectory,
    PlaceDirectory,
    RideRepository,
    RideSearch,
)
from .read_model import BoardFilter, BoardRide, to_board_ride


@dataclass(frozen=True, slots=True)
class RideRules:
    """The knobs of the context, from configuration."""

    departure_tolerance: timedelta = timedelta(minutes=20)  # "already left" after this (D-017)
    contact_limit: int = 20  # contact requests per account per window (D-031, D-064)
    contact_window: timedelta = timedelta(hours=24)


@dataclass(frozen=True, slots=True)
class PublishRide:
    rides: RideRepository
    drivers: DriverDirectory
    places: PlaceDirectory
    search: RideSearch
    clock: Clock

    async def __call__(  # noqa: PLR0913 - the whole ride comes in at once
        self,
        driver_id: AccountId,
        *,
        car_id: UUID,
        route: Route,
        departure_at: datetime,
        seats_available: int,
        price: Decimal = DEFAULT_PRICE,
        payment_methods: frozenset[PaymentMethod],
    ) -> RideOffer:
        driver = await _require_driver(self.drivers, driver_id)
        car = _snapshot(driver, car_id)
        await _require_known_places(self.places, route)
        change = RideOffer.publish(
            driver_id=driver_id,
            car=car,
            route=route,
            departure_at=departure_at,
            seats_available=seats_available,
            price=price,
            payment_methods=payment_methods,
            now=self.clock.now(),
        )
        await self.rides.save(change.ride, change.events)
        await self.search.index(change.ride)
        return change.ride


@dataclass(frozen=True, slots=True)
class EditRide:
    rides: RideRepository
    places: PlaceDirectory
    search: RideSearch
    clock: Clock

    async def __call__(  # noqa: PLR0913 - one call edits every editable field at once
        self,
        driver_id: AccountId,
        ride_id: RideId,
        *,
        route: Route | None = None,
        departure_at: datetime | None = None,
        price: Decimal | None = None,
        payment_methods: frozenset[PaymentMethod] | None = None,
    ) -> RideOffer:
        ride = await _own_ride(self.rides, driver_id, ride_id)
        if route is not None:
            await _require_known_places(self.places, route)
        change = ride.edit(
            route=route,
            departure_at=departure_at,
            price=price,
            payment_methods=payment_methods,
            now=self.clock.now(),
        )
        await self.rides.save(change.ride, change.events)
        if route is not None:
            await self.search.index(change.ride)
        return change.ride


@dataclass(frozen=True, slots=True)
class ChangeSeats:
    rides: RideRepository
    clock: Clock

    async def __call__(self, driver_id: AccountId, ride_id: RideId, seats: int) -> RideOffer:
        ride = await _own_ride(self.rides, driver_id, ride_id)
        change = ride.change_seats(seats, self.clock.now())
        await self.rides.save(change.ride, change.events)
        return change.ride


@dataclass(frozen=True, slots=True)
class CancelRide:
    rides: RideRepository
    clock: Clock

    async def __call__(self, driver_id: AccountId, ride_id: RideId) -> RideOffer:
        ride = await _own_ride(self.rides, driver_id, ride_id)
        change = ride.cancel(self.clock.now())
        await self.rides.save(change.ride, change.events)
        return change.ride


@dataclass(frozen=True, slots=True)
class RepeatRide:
    rides: RideRepository
    drivers: DriverDirectory
    search: RideSearch
    clock: Clock

    async def __call__(self, driver_id: AccountId, ride_id: RideId, *, departure_at: datetime) -> RideOffer:
        ride = await _own_ride(self.rides, driver_id, ride_id)
        driver = await _require_driver(self.drivers, driver_id)
        car = _snapshot(driver, ride.car.car_id, fallback=True)
        change = ride.repeat(departure_at=departure_at, car=car, now=self.clock.now())
        await self.rides.save(change.ride, change.events)
        await self.search.index(change.ride)
        return change.ride


@dataclass(frozen=True, slots=True)
class ListBoard:
    """The public board: what is still to depart, filtered, with status and actions for the viewer."""

    rides: RideRepository
    drivers: DriverDirectory
    places: PlaceDirectory
    search: RideSearch
    clock: Clock
    rules: RideRules

    async def __call__(self, filters: BoardFilter, viewer: AccountId | None) -> tuple[BoardRide, ...]:
        now = self.clock.now()
        candidates = await self.rides.upcoming(now - self.rules.departure_tolerance)
        selected = [ride for ride in candidates if _matches(ride, filters)]
        if filters.text and filters.text.strip():
            found = await self.search.matching(filters.text, [ride.id for ride in selected])
            selected = [ride for ride in selected if ride.id in found]
        return await _project(self, selected, viewer, now)


@dataclass(frozen=True, slots=True)
class MyRides:
    rides: RideRepository
    drivers: DriverDirectory
    places: PlaceDirectory
    clock: Clock
    rules: RideRules

    async def __call__(self, driver_id: AccountId) -> tuple[BoardRide, ...]:
        mine = await self.rides.by_driver(driver_id)
        return await _project(self, list(mine), driver_id, self.clock.now())


@dataclass(frozen=True, slots=True)
class ShowRide:
    """One ride as the board would show it, whatever its status: the detail page and the owner's edit."""

    rides: RideRepository
    drivers: DriverDirectory
    places: PlaceDirectory
    clock: Clock
    rules: RideRules

    async def __call__(self, ride_id: RideId, viewer: AccountId | None) -> BoardRide:
        ride = await self.rides.get(ride_id)
        if ride is None:
            raise RideNotFoundError(ride_id)
        (shown,) = await _project(self, [ride], viewer, self.clock.now())
        return shown


class Contact(FrozenModel):
    """What the contact route hands back: the only way the phone and the plate leave (ADR-0006)."""

    whatsapp_url: str
    plate: str


@dataclass(frozen=True, slots=True)
class RequestContact:
    rides: RideRepository
    drivers: DriverDirectory
    contacts: ContactRequests
    limiter: RateLimiter
    clock: Clock
    rules: RideRules

    async def __call__(self, requester_id: AccountId, ride_id: RideId) -> Contact:
        ride = await self.rides.get(ride_id)
        if ride is None:
            raise RideNotFoundError(ride_id)
        now = self.clock.now()
        if ride.status(now, self.rules.departure_tolerance) not in (RideStatus.OPEN, RideStatus.REOPENED):
            raise RideNotOpenError
        driver = await _require_driver(self.drivers, ride.driver_id)
        allowed = await self.limiter.acquire(
            f"contact:{requester_id}", limit=self.rules.contact_limit, window=self.rules.contact_window
        )
        if not allowed:
            raise ContactLimitError
        await self.contacts.record(requester_id=requester_id, ride_id=ride.id, at=now)
        return Contact(whatsapp_url=_whatsapp_link(driver, ride), plate=ride.car.plate)


# --- helpers -------------------------------------------------------------------------------------


async def _require_driver(drivers: DriverDirectory, driver_id: AccountId) -> Driver:
    driver = await drivers.get(driver_id)
    if driver is None:
        raise NotTheDriverError
    return driver


async def _own_ride(rides: RideRepository, driver_id: AccountId, ride_id: RideId) -> RideOffer:
    ride = await rides.get(ride_id)
    if ride is None:
        raise RideNotFoundError(ride_id)
    if ride.driver_id != driver_id:
        raise NotTheDriverError
    return ride


async def _require_known_places(places: PlaceDirectory, route: Route) -> None:
    """A catalog stop points at a place that exists (D-013); free text is checked by nobody."""
    known = await places.labels()
    for stop in route:
        if isinstance(stop, CatalogStop) and stop.place_id not in known:
            raise UnknownPlaceError(stop.place_id)


def _snapshot(driver: Driver, car_id: UUID, *, fallback: bool = False) -> CarSnapshot:
    """The driver's car as it is now (D-023). With `fallback`, any car of theirs will do."""
    cars = [car for car in driver.cars if car.car_id == car_id] or (list(driver.cars) if fallback else [])
    if not cars:
        raise NoCarError
    car = cars[0]
    return CarSnapshot(car_id=car.car_id, model=car.model, color=car.color, plate=car.plate)


def _matches(ride: RideOffer, filters: BoardFilter) -> bool:
    # The day is the ride's own local day: the repository hands datetimes back in the board's zone.
    if filters.day is not None and ride.departure_at.date() != filters.day:
        return False
    if filters.with_seats and ride.seats_available == 0:
        return False
    return filters.max_price is None or ride.price <= filters.max_price


async def _project(
    lister: ListBoard | MyRides | ShowRide,
    rides: list[RideOffer],
    viewer: AccountId | None,
    now: datetime,
) -> tuple[BoardRide, ...]:
    labels = await lister.places.labels()
    names: dict[AccountId, str] = {}
    for ride in rides:
        if ride.driver_id not in names:
            driver = await lister.drivers.get(ride.driver_id)
            names[ride.driver_id] = driver.display_name if driver else "Motorista"
    return tuple(
        to_board_ride(
            ride,
            driver_name=names[ride.driver_id],
            labels=labels,
            viewer=viewer,
            now=now,
            tolerance=lister.rules.departure_tolerance,
        )
        for ride in rides
    )


def _whatsapp_link(driver: Driver, ride: RideOffer) -> str:
    when = ride.departure_at.strftime("%H:%M")
    text = f"Oi, {driver.display_name}! Vi sua carona das {when} no BrazCar. Ainda tem vaga?"
    return f"https://wa.me/{driver.phone.lstrip('+')}?text={quote(text)}"
