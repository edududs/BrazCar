"""Storage of the importing context (D-111, D-113). Typed columns, no JSON blob, no rule."""

from django.db import models


class CandidateModel(models.Model):
    """One posting and what became of it. Its messages point here and go with it (D-119)."""

    id = models.UUIDField(primary_key=True, editable=False)
    sender_phone = models.CharField(max_length=15)
    sender_name = models.CharField(max_length=120, blank=True)
    text_key = models.CharField(max_length=2000)
    text = models.TextField()
    group_label = models.CharField(max_length=60)
    first_seen_at = models.DateTimeField()
    last_seen_at = models.DateTimeField()
    sources = models.PositiveSmallIntegerField(default=1)
    verdict = models.CharField(max_length=8)  # pending, accepted, rejected, failed
    ride_id = models.UUIDField(null=True, blank=True)  # accepted: a reference into `rides`, by id
    joined = models.BooleanField(default=False)
    reason = models.CharField(max_length=20, blank=True)  # rejected: the `RejectReason`
    confidence = models.FloatField(null=True, blank=True)
    error = models.CharField(max_length=200, blank=True)  # failed
    attempts = models.PositiveSmallIntegerField(default=0)
    judged_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "importing_candidate"
        indexes = (
            models.Index(fields=("sender_phone", "first_seen_at"), name="importing_cand_sender_idx"),
            models.Index(fields=("verdict", "first_seen_at"), name="importing_cand_verdict_idx"),
            models.Index(fields=("ride_id",), name="importing_cand_ride_idx"),
        )

    def __str__(self) -> str:
        return f"{self.verdict} {self.id}"


class SourceMessageModel(models.Model):
    account = models.CharField(max_length=15)  # the paired phone the worker runs as
    message_id = models.CharField(max_length=120)
    chat_jid = models.CharField(max_length=60)
    sender_phone = models.CharField(max_length=15)
    sender_name = models.CharField(max_length=120, blank=True)
    sent_at = models.DateTimeField()
    text = models.TextField()
    received_at = models.DateTimeField()
    # Null until the sweep takes it into a candidate; then it lives and dies with it (D-113, D-119).
    candidate = models.ForeignKey(
        CandidateModel, on_delete=models.CASCADE, related_name="messages", null=True, blank=True
    )

    class Meta:
        db_table = "importing_source_message"
        constraints = (
            models.UniqueConstraint(fields=("account", "message_id"), name="one_row_per_account_message"),
        )
        indexes = (
            models.Index(fields=("received_at",), name="importing_msg_received_idx"),
            models.Index(fields=("candidate", "sent_at"), name="importing_msg_candidate_idx"),
        )

    def __str__(self) -> str:
        return f"{self.account}:{self.message_id}"


class BlockedSenderModel(models.Model):
    """Who asked to be left out (D-119). Nothing of theirs is stored again."""

    phone = models.CharField(max_length=15, primary_key=True)
    blocked_at = models.DateTimeField()

    class Meta:
        db_table = "importing_blocked_sender"

    def __str__(self) -> str:
        return self.phone


class RemovalRequestModel(models.Model):
    """A request of the public page (D-172). Decided, never deleted; the decision and its moment
    are two columns the constraint keeps together."""

    id = models.UUIDField(primary_key=True, editable=False)
    phone = models.CharField(max_length=16)  # E.164
    requested_at = models.DateTimeField()
    note = models.TextField(blank=True)  # empty when none was written
    decision = models.CharField(max_length=8, default="pending")  # pending, approved, refused
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "importing_removal_request"
        constraints = (
            models.CheckConstraint(
                condition=(
                    models.Q(decision="pending", decided_at__isnull=True)
                    | models.Q(decision__in=("approved", "refused"), decided_at__isnull=False)
                ),
                name="removal_decision_and_moment_agree",
            ),
        )
        indexes = (models.Index(fields=("decision", "requested_at"), name="importing_removal_idx"),)

    def __str__(self) -> str:
        return f"{self.decision} {self.id}"
