"""What `alerts` asks of `rides`, answered by the use cases of `rides` (D-006, D-176)."""

from brazcar.alerts.application import RideSummary
from brazcar.alerts.domain import RideAlert, RideId
from brazcar.rides.application import BoardFilter, ShownOnBoard, ShowRide
from brazcar.rides.domain import RideNotFoundError


class RidesBoard:
    """`BoardRides` over `ShowRide` and `ShownOnBoard`.

    The ride is read as the anonymous view shows it (viewer `None`, D-171), so nothing that points at
    a person reaches an alert. Whether an alert matches is the board's own selection, never a second
    copy of it (D-176): the alert becomes the filter of the board, with seats.
    """

    def __init__(self, show: ShowRide, shown_on_board: ShownOnBoard) -> None:
        self._show = show
        self._shown_on_board = shown_on_board

    async def summary(self, ride_id: RideId) -> RideSummary | None:
        try:
            ride = await self._show(ride_id, None)
        except RideNotFoundError:
            return None
        return RideSummary(
            ride_id=ride.id,
            stops=tuple(stop.label for stop in ride.stops),
            departure_at=ride.departure_at,
        )

    async def shows(self, ride_id: RideId, alert: RideAlert) -> bool:
        filters = BoardFilter(
            day=alert.day,
            text=alert.text,
            with_seats=True,
            from_time=alert.from_time,
            until_time=alert.until_time,
        )
        return await self._shown_on_board(ride_id, filters)
