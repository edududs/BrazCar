"""The board revision row (ADR-0010): read by the signal, bumped inside every board-changing write."""

from asgiref.sync import sync_to_async
from django.db import close_old_connections, transaction
from django.db.models import F

from .models import BOARD, BoardRevisionModel


class DjangoBoardRevision:
    """`BoardRevision` over the one row. Reading releases the connection: the poller has no request."""

    async def current(self) -> int:
        return await sync_to_async(_read)()


def _read() -> int:
    row = BoardRevisionModel.objects.filter(pk=BOARD).values_list("revision", flat=True).first()
    close_old_connections()
    return 0 if row is None else row


def bump_board_revision() -> None:
    """Add one, atomically in the database. To be called inside the writer's own `atomic` block."""
    if not BoardRevisionModel.objects.filter(pk=BOARD).update(revision=F("revision") + 1):
        with transaction.atomic():  # the migration seeds the row; this only covers a wiped table
            BoardRevisionModel.objects.get_or_create(pk=BOARD, defaults={"revision": 0})
        BoardRevisionModel.objects.filter(pk=BOARD).update(revision=F("revision") + 1)
