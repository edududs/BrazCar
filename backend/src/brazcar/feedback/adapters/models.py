"""Storage shape of an opinion. No rule lives here: the domain validates, these rows only hold."""

from django.conf import settings
from django.db import models


class FeedbackModel(models.Model):
    id = models.UUIDField(primary_key=True)
    # Erasing an account keeps its row (D-090), so the opinion stays and loses only the person.
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="feedback")
    kind = models.CharField(max_length=12)
    message = models.TextField()
    about_phone = models.CharField(max_length=20, blank=True)  # E.164, or empty; never a link to an account
    web_version = models.CharField(max_length=32)
    at = models.DateTimeField(db_index=True)

    # What Django adds at runtime, declared for the type checker.
    author_id: object

    class Meta:
        db_table = "feedback_feedback"
        ordering = ("at",)

    def __str__(self) -> str:
        return f"{self.kind} {self.at:%Y-%m-%d %H:%M}"
