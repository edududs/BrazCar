"""Storage shape of the catalog. No rule lives here: the domain validates, these rows only hold."""

from django.db import models


class PlaceModel(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    name = models.CharField(max_length=80, unique=True)
    kind = models.CharField(max_length=16)
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="children"
    )
    geometry = models.JSONField(null=True, blank=True)  # reserved for the map (D-025)

    # What Django adds at runtime, declared for the type checker.
    parent_id: str | None
    aliases: models.Manager[PlaceAliasModel]

    class Meta:
        db_table = "places_place"

    def __str__(self) -> str:
        return self.name


class PlaceAliasModel(models.Model):
    place = models.ForeignKey(PlaceModel, on_delete=models.CASCADE, related_name="aliases")
    text = models.CharField(max_length=80, unique=True)
    position = models.PositiveSmallIntegerField()

    class Meta:
        db_table = "places_alias"
        ordering = ("place_id", "position")

    def __str__(self) -> str:
        return self.text
