"""One row per source message (D-111). Typed columns, no JSON blob, no media. No rule lives here."""

from django.db import models


class SourceMessageModel(models.Model):
    account = models.CharField(max_length=15)  # the paired phone the worker runs as
    message_id = models.CharField(max_length=120)
    chat_jid = models.CharField(max_length=60)
    sender_phone = models.CharField(max_length=15)
    sender_name = models.CharField(max_length=120, blank=True)
    sent_at = models.DateTimeField()
    text = models.TextField()
    received_at = models.DateTimeField()

    class Meta:
        db_table = "importing_source_message"
        constraints = (
            models.UniqueConstraint(fields=("account", "message_id"), name="one_row_per_account_message"),
        )
        indexes = (models.Index(fields=("received_at",), name="importing_msg_received_idx"),)

    def __str__(self) -> str:
        return f"{self.account}:{self.message_id}"
