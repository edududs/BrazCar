from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from hypothesis import given
from hypothesis import strategies as st
from pydantic import ValidationError

from brazcar.rides.domain import (
    DELAY_LIMIT,
    Actions,
    CatalogStop,
    DepartureChangeError,
    FreeTextStop,
    PaymentMethod,
    RideCancelled,
    RideCancelledError,
    RideEdited,
    RideLockedError,
    RideOffer,
    RidePublished,
    RideReopened,
    RideStatus,
    SeatsChanged,
    allowed_actions,
)

from .strategies import BRASILIA, EPOCH, car, moments, rides

TOLERANCE = timedelta(minutes=20)
ROUTE = (CatalogStop(place_id="esplanada"), CatalogStop(place_id="estrutural"), FreeTextStop(text="Incra 8"))
DRIVER = uuid4()


def publish(departure: datetime = EPOCH + timedelta(hours=13), seats: int = 3) -> RideOffer:
    return RideOffer.publish(
        driver_id=DRIVER,
        car=car(),
        route=ROUTE,
        departure_at=departure,
        seats_available=seats,
        payment_methods=frozenset({PaymentMethod.CASH, PaymentMethod.PIX}),
        now=EPOCH,
    ).ride


# --- shape ---------------------------------------------------------------------------------


def test_publishing_records_the_original_departure_and_one_event() -> None:
    change = RideOffer.publish(
        driver_id=DRIVER,
        car=car(),
        route=ROUTE,
        departure_at=EPOCH + timedelta(hours=13),
        seats_available=3,
        payment_methods=frozenset({PaymentMethod.PIX}),
        now=EPOCH,
    )

    assert change.ride.original_departure_at == change.ride.departure_at
    assert change.ride.price == Decimal("7.00")
    assert change.events == (RidePublished(ride_id=change.ride.id, at=EPOCH),)


INVALID: list[dict[str, object]] = [
    {"route": (CatalogStop(place_id="esplanada"),)},
    {"seats_available": -1},
    {"seats_available": 9},
    {"price": Decimal(0)},
    {"payment_methods": frozenset[PaymentMethod]()},
    {"departure_at": datetime(2026, 9, 22, 19, 30)},  # noqa: DTZ001 - the naive datetime is the point
]


@pytest.mark.parametrize("bad", INVALID)
def test_invalid_rides_cannot_exist(bad: dict[str, object]) -> None:
    ride = publish()
    with pytest.raises(ValidationError):
        ride.evolve(**bad)


# --- status ----------------------------------------------------------------------------------


def test_status_reads_the_four_facts_in_order() -> None:
    ride = publish(seats=0)
    at = ride.departure_at

    assert ride.status(at, TOLERANCE) is RideStatus.FULL
    assert ride.evolve(reopened_at=EPOCH).status(at, TOLERANCE) is RideStatus.FULL
    assert ride.evolve(seats_available=1).status(at, TOLERANCE) is RideStatus.OPEN
    assert ride.evolve(seats_available=1, reopened_at=EPOCH).status(at, TOLERANCE) is RideStatus.REOPENED
    assert ride.status(at + TOLERANCE, TOLERANCE) is RideStatus.FULL
    assert ride.status(at + TOLERANCE + timedelta(seconds=1), TOLERANCE) is RideStatus.DEPARTED
    assert ride.evolve(cancelled_at=EPOCH).status(at + timedelta(days=1), TOLERANCE) is RideStatus.CANCELLED


@given(ride=rides(), now=moments)
def test_status_is_a_pure_function_of_the_four_facts(ride: RideOffer, now: datetime) -> None:
    expected = (
        RideStatus.CANCELLED
        if ride.cancelled_at is not None
        else RideStatus.DEPARTED
        if now > ride.departure_at + TOLERANCE
        else RideStatus.FULL
        if ride.seats_available == 0
        else RideStatus.REOPENED
        if ride.reopened_at is not None
        else RideStatus.OPEN
    )
    assert ride.status(now, TOLERANCE) is expected


# --- seats -----------------------------------------------------------------------------------


def test_zeroing_seats_closes_and_raising_them_reopens() -> None:
    ride = publish(seats=2)
    now = EPOCH + timedelta(hours=1)

    closed = ride.change_seats(0, now)
    reopened = closed.ride.change_seats(1, now + timedelta(minutes=5))
    adjusted = reopened.ride.change_seats(3, now + timedelta(minutes=9))

    assert closed.ride.status(now, TOLERANCE) is RideStatus.FULL
    assert closed.events == (SeatsChanged(ride_id=ride.id, at=now, seats_before=2, seats_after=0),)
    assert reopened.ride.reopened_at == now + timedelta(minutes=5)
    assert reopened.ride.status(now, TOLERANCE) is RideStatus.REOPENED
    assert [type(e) for e in reopened.events] == [SeatsChanged, RideReopened]
    assert [type(e) for e in adjusted.events] == [SeatsChanged]
    assert ride.change_seats(2, now).events == ()


# --- cancelling ------------------------------------------------------------------------------


def test_cancelled_is_final() -> None:
    ride = publish()
    now = EPOCH + timedelta(hours=1)

    cancelled = ride.cancel(now)

    assert cancelled.events == (RideCancelled(ride_id=ride.id, at=now),)
    with pytest.raises(RideCancelledError):
        cancelled.ride.cancel(now)
    with pytest.raises(RideCancelledError):
        cancelled.ride.change_seats(5, now)
    with pytest.raises(RideCancelledError):
        cancelled.ride.edit(price=Decimal(8), now=now)


# --- editing (ADR-0004) ----------------------------------------------------------------------


def test_before_departure_the_time_moves_only_within_the_day() -> None:
    ride = publish(departure=datetime(2026, 9, 22, 19, 30, tzinfo=BRASILIA))
    now = datetime(2026, 9, 22, 12, 0, tzinfo=BRASILIA)

    later = ride.edit(departure_at=datetime(2026, 9, 22, 23, 50, tzinfo=BRASILIA), now=now)
    earlier = ride.edit(departure_at=datetime(2026, 9, 22, 0, 10, tzinfo=BRASILIA), now=now)

    assert later.ride.departure_at.hour == 23
    assert earlier.ride.original_departure_at == ride.original_departure_at
    assert isinstance(later.events[0], RideEdited)
    with pytest.raises(DepartureChangeError, match="same day"):
        ride.edit(departure_at=datetime(2026, 9, 23, 0, 5, tzinfo=BRASILIA), now=now)


def test_same_day_is_judged_in_the_ride_timezone_not_utc() -> None:
    ride = publish(departure=datetime(2026, 9, 22, 22, 0, tzinfo=BRASILIA))  # 01:00 UTC next day
    now = datetime(2026, 9, 22, 12, 0, tzinfo=BRASILIA)

    same_local_day = ride.edit(departure_at=datetime(2026, 9, 22, 23, 30, tzinfo=BRASILIA), now=now)

    assert same_local_day.ride.departure_at.hour == 23


def test_after_departure_only_a_delay_up_to_two_hours_of_the_original() -> None:
    departure = datetime(2026, 9, 22, 19, 30, tzinfo=BRASILIA)
    ride = publish(departure=departure)
    now = departure + timedelta(minutes=10)

    delayed = ride.edit(departure_at=departure + timedelta(minutes=40), now=now)
    again = delayed.ride.edit(departure_at=departure + DELAY_LIMIT, now=now + timedelta(minutes=45))

    assert again.ride.departure_at == departure + DELAY_LIMIT
    with pytest.raises(DepartureChangeError, match="only be delayed"):
        ride.edit(departure_at=departure - timedelta(minutes=5), now=now)
    with pytest.raises(DepartureChangeError, match="two hours"):
        ride.edit(departure_at=departure + DELAY_LIMIT + timedelta(minutes=1), now=now)


def test_past_the_delay_limit_the_ride_only_cancels() -> None:
    ride = publish()
    now = ride.original_departure_at + DELAY_LIMIT + timedelta(seconds=1)

    with pytest.raises(RideLockedError):
        ride.edit(price=Decimal(8), now=now)
    with pytest.raises(RideLockedError):
        ride.change_seats(0, now)
    assert ride.cancel(now).ride.cancelled_at == now


def test_editing_other_fields_does_not_touch_the_departure() -> None:
    ride = publish()
    now = EPOCH + timedelta(hours=1)

    changed = ride.edit(price=Decimal("8.50"), payment_methods=frozenset({PaymentMethod.PIX}), now=now)

    assert changed.ride.departure_at == ride.departure_at
    assert changed.ride.price == Decimal("8.50")
    assert ride.edit(now=now).events == ()


@given(ride=rides(), minutes=st.integers(-24 * 60, 24 * 60), now=moments)
def test_no_sequence_of_delays_passes_two_hours_of_the_original(
    ride: RideOffer, minutes: int, now: datetime
) -> None:
    """Whatever the ride's past, any accepted change keeps departure within the original's window."""
    wanted = ride.departure_at + timedelta(minutes=minutes)
    try:
        changed = ride.edit(departure_at=wanted, now=now).ride
    except DepartureChangeError, RideCancelledError, RideLockedError:
        return
    assert changed.original_departure_at == ride.original_departure_at
    if minutes == 0:
        assert changed == ride
    elif now > ride.departure_at:
        assert ride.departure_at < changed.departure_at <= ride.original_departure_at + DELAY_LIMIT
    else:
        tz = ride.original_departure_at.tzinfo
        assert changed.departure_at.astimezone(tz).date() == ride.original_departure_at.astimezone(tz).date()


# --- repeat and actions ----------------------------------------------------------------------


def test_repeat_makes_a_new_ride_with_at_least_one_seat_and_todays_car() -> None:
    ride = publish(seats=0).cancel(EPOCH).ride
    new_car = car().evolve(model="BYD")

    repeated = ride.repeat(departure_at=EPOCH + timedelta(days=1), car=new_car, now=EPOCH)

    assert repeated.ride.id != ride.id
    assert repeated.ride.route == ride.route
    assert repeated.ride.seats_available == 1
    assert repeated.ride.car == new_car
    assert repeated.ride.cancelled_at is None


def test_actions_depend_on_who_looks_and_when() -> None:
    ride = publish()
    before = EPOCH + timedelta(hours=1)
    after = ride.departure_at + timedelta(minutes=10)
    locked = ride.locked_at + timedelta(seconds=1)

    driver_before = allowed_actions(ride, DRIVER, before, TOLERANCE)
    driver_after = allowed_actions(ride, DRIVER, after, TOLERANCE)
    driver_locked = allowed_actions(ride, DRIVER, locked, TOLERANCE)
    passenger = allowed_actions(ride, uuid4(), before, TOLERANCE)
    anonymous = allowed_actions(ride, None, before, TOLERANCE)
    cancelled = allowed_actions(ride.cancel(before).ride, DRIVER, before, TOLERANCE)

    assert driver_before == Actions(can_edit=True, can_change_seats=True, can_cancel=True, can_repeat=True)
    assert driver_after == driver_before.evolve(delay_until=ride.locked_at)
    assert driver_locked == Actions(can_cancel=True, can_repeat=True)
    assert passenger == Actions(can_contact=True)
    assert anonymous == Actions()
    assert cancelled == Actions(can_repeat=True)
