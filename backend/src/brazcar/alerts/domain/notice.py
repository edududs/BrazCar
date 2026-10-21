"""The push payload an alert produces (D-178).

It carries the ride's route and time, never a person: no name, car, plate, phone, original
message or notes (D-171).
"""

from datetime import datetime, timedelta, tzinfo

from brazcar.shared.domain.model import FrozenModel

from .alert import AlertId, RideId, local_day

NOTICE_TITLE = "Apareceu carona"


class Notice(FrozenModel):
    title: str
    body: str
    tag: str  # the alert id: a second notice of the same alert replaces the first on the device
    url: str  # a path of the front, resolved against the origin of whoever opens it


def ride_found(  # noqa: PLR0913 - the ride's facts and the clock, by name
    alert_id: AlertId,
    *,
    ride_id: RideId,
    stops: tuple[str, ...],
    departure_at: datetime,
    now: datetime,
    zone: tzinfo,
) -> Notice:
    """E.g. "Rodoviária do Plano → Brazlândia, hoje às 14:30", the time in the board's zone."""
    departure = departure_at.astimezone(zone)
    today = local_day(now, zone)
    if departure.date() == today:
        when = "hoje"
    elif departure.date() == today + timedelta(days=1):
        when = "amanhã"
    else:
        when = departure.strftime("%d/%m")
    return Notice(
        title=NOTICE_TITLE,
        body=f"{stops[0]} → {stops[-1]}, {when} às {departure:%H:%M}",
        tag=str(alert_id),
        url=f"/caronas/{ride_id}",
    )
