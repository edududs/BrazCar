from collections.abc import Collection
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
    ExternalDriver,
    NoCarError,
    NotTheDriverError,
    PaymentMethod,
    RegisteredDriver,
    RideId,
    RideNotFoundError,
    RideNotOpenError,
    RideOffer,
    RideStatus,
    Route,
    UnknownPlaceError,
    WhatsAppOrigin,
)
from brazcar.shared.application.ports import Clock, RateLimiter
from brazcar.shared.domain.model import FrozenModel
from brazcar.shared.domain.phone import PhoneNumber

from .ports import (
    ContactRequests,
    DriverAccount,
    DriverDirectory,
    PlaceDirectory,
    RideRepository,
    RideSearch,
)
from .read_model import BoardFilter, BoardRide, to_board_ride


@dataclass(frozen=True, slots=True)
class RideRules:
    """The knobs of the context, from configuration."""

    departure_tolerance: timedelta = timedelta(minutes=10)  # "already left" after this (D-017, D-121)
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
        notes: str | None = None,
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
            notes=notes,
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
        notes: str | None = None,
    ) -> RideOffer:
        ride = await _own_ride(self.rides, driver_id, ride_id)
        if route is not None:
            await _require_known_places(self.places, route)
        change = ride.edit(
            route=route,
            departure_at=departure_at,
            price=price,
            payment_methods=payment_methods,
            notes=notes,
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
        car = _snapshot(driver, None if ride.car is None else ride.car.car_id, fallback=True)
        change = ride.repeat(departure_at=departure_at, car=car, now=self.clock.now())
        await self.rides.save(change.ride, change.events)
        await self.search.index(change.ride)
        return change.ride


class Imported(FrozenModel):
    ride: RideOffer
    created: bool  # false when the same driver already had a ride at that departure (D-113)


@dataclass(frozen=True, slots=True)
class ImportRide:
    """A ride read from a WhatsApp group by `importing` (ADR-0015).

    The sender's phone decides the driver: the account registered with it, without a car (D-127),
    or an external driver. A second post for the same departure joins the first ride instead of
    making another (D-113)."""

    rides: RideRepository
    drivers: DriverDirectory
    places: PlaceDirectory
    search: RideSearch
    clock: Clock

    async def __call__(  # noqa: PLR0913 - the whole ride comes in at once
        self,
        *,
        sender_phone: PhoneNumber,
        sender_name: str,
        origin: WhatsAppOrigin,
        route: Route,
        departure_at: datetime,
        seats_available: int,
        price: Decimal,
        payment_methods: frozenset[PaymentMethod],
    ) -> Imported:
        account = await self.drivers.by_phone(sender_phone)
        driver: RegisteredDriver | ExternalDriver = (
            RegisteredDriver(account_id=account.id, car=None)
            if account is not None
            else ExternalDriver(phone=sender_phone, display_name=sender_name)
        )
        existing = await self.rides.find_imported(
            account.id if account is not None else sender_phone, departure_at
        )
        if existing is not None:
            return Imported(ride=existing, created=False)
        await _require_known_places(self.places, route)
        change = RideOffer.import_offer(
            driver=driver,
            origin=origin,
            route=route,
            departure_at=departure_at,
            seats_available=seats_available,
            price=price,
            payment_methods=payment_methods,
            now=self.clock.now(),
        )
        await self.rides.save(change.ride, change.events)
        await self.search.index(change.ride)
        return Imported(ride=change.ride, created=True)


@dataclass(frozen=True, slots=True)
class ForgetRides:
    """Delete imported rides for good (D-119). A registered driver's ride is never forgotten here."""

    rides: RideRepository
    search: RideSearch

    async def __call__(self, ride_ids: Collection[RideId]) -> int:
        forgotten = 0
        for ride_id in ride_ids:
            ride = await self.rides.get(ride_id)
            if ride is None or ride.driver_id is not None:
                continue
            await self.rides.delete(ride_id)
            await self.search.forget(ride_id)
            forgotten += 1
        return forgotten


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
        candidates = await self.rides.upcoming(
            now - self.rules.departure_tolerance, from_time=filters.from_time
        )
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
    phone: PhoneNumber  # shown next to the link, so it can be saved or called (D-137)
    plate: str | None  # none for an external driver: the platform never saw a car


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
        if isinstance(ride.driver, ExternalDriver):
            name, phone, plate = ride.driver.display_name, ride.driver.phone, None
            driver_account_id = None
        else:
            driver = await _require_driver(self.drivers, ride.driver.account_id)
            car = ride.driver.car
            name, phone, plate = driver.display_name, driver.phone, None if car is None else car.plate
            driver_account_id = driver.id
        allowed = await self.limiter.acquire(
            f"contact:{requester_id}", limit=self.rules.contact_limit, window=self.rules.contact_window
        )
        if not allowed:
            raise ContactLimitError
        await self.contacts.record(
            requester_id=requester_id,
            ride_id=ride.id,
            phone_revealed=phone,
            driver_kind=ride.driver.kind,
            driver_account_id=driver_account_id,
            at=now,
        )
        return Contact(whatsapp_url=_whatsapp_link(name, phone, ride), phone=phone, plate=plate)


# --- helpers -------------------------------------------------------------------------------------


async def _require_driver(drivers: DriverDirectory, driver_id: AccountId) -> DriverAccount:
    driver = await drivers.get(driver_id)
    if driver is None:
        raise NotTheDriverError
    return driver


async def _own_ride(rides: RideRepository, driver_id: AccountId, ride_id: RideId) -> RideOffer:
    ride = await rides.get(ride_id)
    if ride is None:
        raise RideNotFoundError(ride_id)
    if not ride.is_owned_by(driver_id):
        raise NotTheDriverError
    return ride


async def _require_known_places(places: PlaceDirectory, route: Route) -> None:
    """A catalog stop points at a place that exists (D-013); free text is checked by nobody."""
    known = await places.labels()
    for stop in route:
        if isinstance(stop, CatalogStop) and stop.place_id not in known:
            raise UnknownPlaceError(stop.place_id)


def _snapshot(driver: DriverAccount, car_id: UUID | None, *, fallback: bool = False) -> CarSnapshot:
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
    """Board, detail and "my rides" alike; without a session, the anonymous view (D-171)."""
    labels = await lister.places.labels()
    names: dict[AccountId, str] = {}
    for ride in rides:
        account_id = ride.driver_id
        if account_id is not None and account_id not in names:
            driver = await lister.drivers.get(account_id)
            names[account_id] = driver.display_name if driver else "Motorista"
    shown = (
        to_board_ride(
            ride,
            driver_name=_driver_name(ride, names),
            labels=labels,
            viewer=viewer,
            now=now,
            tolerance=lister.rules.departure_tolerance,
        )
        for ride in rides
    )
    return tuple(shown if viewer is not None else (ride.anonymized() for ride in shown))


def _driver_name(ride: RideOffer, names: dict[AccountId, str]) -> str:
    if isinstance(ride.driver, ExternalDriver):
        return ride.driver.display_name
    return names[ride.driver.account_id]


def _whatsapp_link(name: str, phone: PhoneNumber, ride: RideOffer) -> str:
    when = ride.departure_at.strftime("%H:%M")
    text = f"Oi, {name}! Vi sua carona das {when} no BrazCar. Ainda tem vaga?"
    return f"https://wa.me/{phone.jid_user()}?text={quote(text)}"
