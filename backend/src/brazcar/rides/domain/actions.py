"""What the viewer may do with a ride, computed here so the front only draws (ADR-0011)."""

from datetime import datetime, timedelta

from brazcar.shared.domain.model import FrozenModel

from .ride import AccountId, RideOffer, RideStatus


class Actions(FrozenModel):
    can_edit: bool = False
    can_change_seats: bool = False
    can_cancel: bool = False
    can_repeat: bool = False
    can_contact: bool = False
    delay_until: datetime | None = None  # the latest departure an edit may set, when editing


def allowed_actions(
    ride: RideOffer, viewer: AccountId | None, now: datetime, tolerance: timedelta
) -> Actions:
    status = ride.status(now, tolerance)
    if viewer != ride.driver_id:
        can_contact = viewer is not None and status in (RideStatus.OPEN, RideStatus.REOPENED)
        return Actions(can_contact=can_contact)
    if status is RideStatus.CANCELLED:
        return Actions(can_repeat=True)
    if ride.is_locked(now):
        return Actions(can_cancel=True, can_repeat=True)
    return Actions(
        can_edit=True,
        can_change_seats=True,
        can_cancel=True,
        can_repeat=True,
        delay_until=ride.locked_at if now > ride.departure_at else None,
    )
