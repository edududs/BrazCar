"""`manage.py sync_places`: make the stored catalog equal to the versioned file (D-087)."""

import asyncio
from pathlib import Path
from typing import override

from django.core.management.base import BaseCommand, CommandParser

from brazcar.places.adapters.repository import DjangoCatalogRepository
from brazcar.places.adapters.seed import SEED_PATH, load_seed
from brazcar.places.application import SyncCatalog


class Command(BaseCommand):
    help = "Sync the places catalog from the versioned file. Safe to run again."

    @override
    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--file", type=Path, default=SEED_PATH, help=f"catalog file (default: {SEED_PATH})"
        )

    @override
    def handle(self, *args: object, **options: object) -> None:
        path = options["file"]
        assert isinstance(path, Path)  # noqa: S101 - argparse hands the declared type back
        catalog = load_seed(path)
        changed = asyncio.run(SyncCatalog(DjangoCatalogRepository())(catalog))
        verb = "synced" if changed else "already up to date"
        self.stdout.write(f"places: {len(catalog.places)} in {path.name}, {verb}")
