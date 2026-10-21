from datetime import date, datetime
from uuid import UUID

from asgiref.sync import sync_to_async
from django.db import IntegrityError, transaction
from django.db.models import Q

from brazcar.alerts.domain import AccountId, AlertId, RideAlert, RideId

from .models import NoticeModel, RideAlertModel


class DjangoAlertRepository:
    """`AlertRepository` over the ORM: one row per alert, its notices hanging from it.

    An erased account keeps its row (D-090), so its alerts are skipped on read and swept by `purge` (D-179).
    """

    async def add(self, alert: RideAlert) -> None:
        await RideAlertModel.objects.acreate(
            id=alert.id,
            owner_id=alert.owner_id,
            text=alert.text or "",
            day=alert.day,
            from_time=alert.from_time,
            until_time=alert.until_time,
            created_at=alert.created_at,
        )

    async def get(self, alert_id: AlertId) -> RideAlert | None:
        row = await RideAlertModel.objects.filter(id=alert_id).afirst()
        return None if row is None else _to_entity(row)

    async def remove(self, alert_id: AlertId) -> None:
        await RideAlertModel.objects.filter(id=alert_id).adelete()  # the notices go by CASCADE

    async def of_owner(self, owner_id: AccountId, *, since: date) -> tuple[RideAlert, ...]:
        return await sync_to_async(_of_owner)(owner_id, since)

    async def on_day(self, day: date) -> tuple[RideAlert, ...]:
        return await sync_to_async(_on_day)(day)

    async def purge(self, *, before: date) -> int:
        """Deletes the alerts of past days and those of erased accounts, however far off their day (D-179)."""
        return await sync_to_async(_purge)(before)


class DjangoNoticeLog:
    """`NoticeLog` over the ORM: the unique pair (alert, ride) is what makes a claim happen once."""

    async def claim(self, alert_id: AlertId, ride_id: RideId, *, at: datetime) -> bool:
        """Inserts the pair; a repeated pair is refused by the database and answers False (D-178)."""
        return await sync_to_async(_claim)(alert_id, ride_id, at)


def _of_owner(owner_id: AccountId, since: date) -> tuple[RideAlert, ...]:
    rows = RideAlertModel.objects.filter(owner_id=owner_id, owner__erased_at=None, day__gte=since)
    return tuple(_to_entity(row) for row in rows.order_by("day", "created_at"))


def _on_day(day: date) -> tuple[RideAlert, ...]:
    rows = RideAlertModel.objects.filter(day=day, owner__erased_at=None)
    return tuple(_to_entity(row) for row in rows.order_by("created_at"))


@transaction.atomic
def _purge(before: date) -> int:
    ids = list(
        RideAlertModel.objects.filter(Q(day__lt=before) | Q(owner__erased_at__isnull=False)).values_list(
            "id", flat=True
        )
    )
    RideAlertModel.objects.filter(id__in=ids).delete()  # delete() would also count the notices
    return len(ids)


def _claim(alert_id: AlertId, ride_id: RideId, at: datetime) -> bool:
    try:
        with transaction.atomic():  # a savepoint when nested, so a refusal does not poison the outer one
            NoticeModel.objects.create(alert_id=alert_id, ride_id=ride_id, at=at)
    except IntegrityError:
        return False
    return True


def _to_entity(row: RideAlertModel) -> RideAlert:
    return RideAlert(
        id=row.id,
        owner_id=UUID(str(row.owner_id)),
        text=row.text or None,
        day=row.day,
        from_time=row.from_time,
        until_time=row.until_time,
        created_at=row.created_at,
    )
