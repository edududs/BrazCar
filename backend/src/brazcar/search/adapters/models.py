"""One row per indexed document, holding its folded text. No rule lives here."""

from django.db import models


class SearchEntryModel(models.Model):
    namespace = models.CharField(max_length=40)  # the kind of document: "rides"
    document_id = models.CharField(max_length=64)
    text = models.TextField()  # `SearchDocument.folded`

    class Meta:
        db_table = "search_entry"
        constraints = (
            models.UniqueConstraint(fields=("namespace", "document_id"), name="one_entry_per_document"),
        )

    def __str__(self) -> str:
        return f"{self.namespace}:{self.document_id}"
