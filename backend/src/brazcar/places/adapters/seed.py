"""The versioned catalog file, read into the aggregate. Invalid data fails here, before any write."""

import tomllib
from pathlib import Path

from brazcar.places.domain import Catalog

SEED_PATH = Path(__file__).with_name("catalog.toml")


def load_seed(path: Path = SEED_PATH) -> Catalog:
    with path.open("rb") as file:
        data = tomllib.load(file)
    places = [_to_fields(entry) for entry in data.get("places", [])]
    return Catalog.model_validate({"places": places})


def _to_fields(entry: dict[str, object]) -> dict[str, object]:
    """The file says `parent`, which reads better; the entity says `parent_id`."""
    fields = dict(entry)
    if "parent" in fields:
        fields["parent_id"] = fields.pop("parent")
    return fields
