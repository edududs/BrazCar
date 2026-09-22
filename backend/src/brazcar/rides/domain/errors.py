from uuid import UUID


class RideError(Exception):
    """Base of every rule of this context the API translates into a response."""


class RideNotFoundError(RideError, LookupError):
    def __init__(self, ride_id: UUID) -> None:
        super().__init__(f"no ride {ride_id}")
        self.ride_id = ride_id


class NotTheDriverError(RideError):
    def __init__(self) -> None:
        super().__init__("only the driver can change this ride")


class RideCancelledError(RideError):
    def __init__(self) -> None:
        super().__init__("a cancelled ride is final; repeat it instead")


class RideLockedError(RideError):
    def __init__(self) -> None:
        super().__init__("two hours past the original departure the ride can only be cancelled")


class DepartureChangeError(RideError):
    """One of three refusals of ADR-0004, named so the API can say which."""

    SAME_DAY = "the departure can only move within the same day"
    ONLY_LATER = "after departing, the ride can only be delayed"
    TOO_LATE = "a delay cannot go past two hours after the original departure"

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class NoCarError(RideError):
    def __init__(self) -> None:
        super().__init__("publishing needs a registered car")


class UnknownPlaceError(RideError):
    def __init__(self, place_id: str) -> None:
        super().__init__(f"no place {place_id} in the catalog")
        self.place_id = place_id


class RideNotOpenError(RideError):
    def __init__(self) -> None:
        super().__init__("this ride is not taking passengers now")


class ContactLimitError(RideError):
    def __init__(self) -> None:
        super().__init__("contact limit reached for now; try again later")
