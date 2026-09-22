from io import StringIO
from pathlib import Path

import pytest
from asgiref.sync import async_to_sync
from django.core.management import call_command

from brazcar.places.adapters.repository import DjangoCatalogRepository
from brazcar.places.adapters.seed import SEED_PATH, load_seed
from brazcar.places.domain import Catalog


def test_the_versioned_catalog_is_valid_and_has_the_places_the_ad_names() -> None:
    catalog = load_seed()

    assert {place.id for place in catalog.places} >= {
        "esplanada",
        "eixo-monumental",
        "estrutural",
        "brazlandia",
    }
    assert catalog.named("Braz") == catalog.get("brazlandia")
    assert catalog.get("esplanada") in catalog.resolve("plano-piloto").descendants


def test_an_invalid_file_fails_before_touching_anything(tmp_path: Path) -> None:
    broken = tmp_path / "catalog.toml"
    broken.write_text('[[places]]\nid = "a"\nname = "A"\nparent = "nowhere"\n', encoding="utf-8")

    with pytest.raises(ValueError, match="not in the catalog"):
        load_seed(broken)


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
def test_sync_places_loads_the_file_once_and_is_idempotent() -> None:
    first, second = StringIO(), StringIO()

    call_command("sync_places", stdout=first)
    call_command("sync_places", stdout=second)

    assert "synced" in first.getvalue()
    assert "already up to date" in second.getvalue()
    assert async_to_sync(DjangoCatalogRepository().load)() == load_seed(SEED_PATH)


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
def test_sync_places_accepts_another_file(tmp_path: Path) -> None:
    other = tmp_path / "catalog.toml"
    other.write_text('[[places]]\nid = "x"\nname = "X"\n', encoding="utf-8")

    call_command("sync_places", file=other, stdout=StringIO())

    assert async_to_sync(DjangoCatalogRepository().load)() == Catalog.model_validate(
        {"places": [{"id": "x", "name": "X"}]}
    )
