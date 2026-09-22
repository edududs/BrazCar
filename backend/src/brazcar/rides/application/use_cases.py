from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from urllib.parse import quote

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
    RideOffer,
    RideStatus,
    Route,
)
from brazcar.shared.application.ports import Clock
from brazcar.shared.domain.model import FrozenModel

from .ports import (
    ContactRequests,
    Driver,
    DriverDirectory,
    PlaceDirectory,
    RideRepository,
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
    clock: Clock

    async def __call__(  # noqa: PLR0913 - the whole ride comes in at once
        self,
        driver_id: AccountId,
        *,
        car_id: object,
        route: Route,
        departure_at: datetime,
        seats_available: int,
        price: Decimal = DEFAULT_PRICE,
        payment_methods: frozenset[PaymentMethod],
    ) -> RideOffer:
        driver = await _require_driver(self.drivers, driver_id)
        car = _snapshot(driver, car_id)
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
        return change.ride


@dataclass(frozen=True, slots=True)
class EditRide:
    rides: RideRepository
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
        change = ride.edit(
            route=route,
            departure_at=departure_at,
            price=price,
            payment_methods=payment_methods,
            now=self.clock.now(),
        )
        await self.rides.save(change.ride, change.events)
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
    clock: Clock

    async def __call__(self, driver_id: AccountId, ride_id: RideId, *, departure_at: datetime) -> RideOffer:
        ride = await _own_ride(self.rides, driver_id, ride_id)
        driver = await _require_driver(self.drivers, driver_id)
        car = _snapshot(driver, ride.car.car_id, fallback=True)
        change = ride.repeat(departure_at=departure_at, car=car, now=self.clock.now())
        await self.rides.save(change.ride, change.events)
        return change.ride


@dataclass(frozen=True, slots=True)
class ListBoard:
    """The public board: what is still to depart, filtered, with status and actions for the viewer."""

    rides: RideRepository
    drivers: DriverDirectory
    places: PlaceDirectory
    clock: Clock
    rules: RideRules

    async def __call__(self, filters: BoardFilter, viewer: AccountId | None) -> tuple[BoardRide, ...]:
        now = self.clock.now()
        candidates = await self.rides.upcoming(now - self.rules.departure_tolerance)
        wanted_places = await self.places.with_descendants(filters.place_id) if filters.place_id else None
        selected = [ride for ride in candidates if _matches(ride, filters, wanted_places)]
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


class Contact(FrozenModel):
    """What the contact route hands back: the only way the phone and the plate leave (ADR-0006)."""

    whatsapp_url: str
    plate: str


@dataclass(frozen=True, slots=True)
class RequestContact:
    rides: RideRepository
    drivers: DriverDirectory
    contacts: ContactRequests
    clock: Clock
    rules: RideRules

    async def __call__(self, requester_id: AccountId, ride_id: RideId) -> Contact:
        ride = await self.rides.get(ride_id)
        if ride is None:
            raise RideNotFoundError(ride_id)
        now = self.clock.now()
        if ride.status(now, self.rules.departure_tolerance) not in (RideStatus.OPEN, RideStatus.REOPENED):
            raise RideNotFoundError(ride_id)
        recent = await self.contacts.count_since(requester_id, now - self.rules.contact_window)
        if recent >= self.rules.contact_limit:
            raise ContactLimitError
        driver = await _require_driver(self.drivers, ride.driver_id)
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


def _snapshot(driver: Driver, car_id: object, *, fallback: bool = False) -> CarSnapshot:
    """The driver's car as it is now (D-023). With `fallback`, any car of theirs will do."""
    cars = [car for car in driver.cars if car.car_id == car_id] or (list(driver.cars) if fallback else [])
    if not cars:
        raise NoCarError
    car = cars[0]
    return CarSnapshot(car_id=car.car_id, model=car.model, color=car.color, plate=car.plate)


def _matches(ride: RideOffer, filters: BoardFilter, wanted_places: frozenset[str] | None) -> bool:
    if (
        filters.day is not None
        and ride.departure_at.astimezone(ride.departure_at.tzinfo).date() != filters.day
    ):
        return False
    if filters.with_seats and ride.seats_available == 0:
        return False
    if filters.max_price is not None and ride.price > filters.max_price:
        return False
    if wanted_places is not None:
        stops = {stop.place_id for stop in ride.route if isinstance(stop, CatalogStop)}
        if not stops & wanted_places:
            return False
    return True


async def _project(
    lister: ListBoard | MyRides, rides: list[RideOffer], viewer: AccountId | None, now: datetime
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
