"""Rows of the shared kernel. No rule lives here."""

from django.db import models

BOARD = 1  # the one row of the board revision (ADR-0010)


class BoardRevisionModel(models.Model):
    """A single row: every write that changes the board bumps it in the same transaction."""

    id = models.PositiveSmallIntegerField(primary_key=True)
    revision = models.BigIntegerField(default=0)

    class Meta:
        db_table = "shared_board_revision"

    def __str__(self) -> str:
        return str(self.revision)


class RateLimitHitModel(models.Model):
    """One row per counted hit of a limited key (D-064). Old rows are pruned as new ones come in."""

    key = models.CharField(max_length=120)
    at = models.DateTimeField()

    class Meta:
        db_table = "shared_rate_limit_hit"
        indexes = (models.Index(fields=("key", "at"), name="rate_limit_key_at"),)

    def __str__(self) -> str:
        return f"{self.key} @ {self.at.isoformat()}"
