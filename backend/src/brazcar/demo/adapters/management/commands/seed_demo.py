"""`manage.py seed_demo`: a database with one ride of every situation, for the screens (D-133).

It refuses to run unless `DJANGO_DEBUG` is on or `--yes-i-know` is given, and it starts by
forgetting whatever an earlier run left, so running it twice leaves the same rows.
"""

import asyncio
import json
from pathlib import Path
from typing import override

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.utils import timezone

from brazcar.demo.adapters.seeding import DemoManifest, seed
from brazcar.demo.adapters.teardown import forget_demo
from brazcar.demo.adapters.wiring import demo_wiring
from brazcar.places.adapters.repository import DjangoCatalogRepository

REFUSAL = (
    "seed_demo writes invented accounts and rides. Turn DJANGO_DEBUG on, or pass --yes-i-know "
    "if this really is a database you may fill with demonstration data."
)
NO_CATALOG = "the places catalog is empty: run `manage.py sync_places` first (D-087)."


class Command(BaseCommand):
    help = "Fill the database with the demonstration data. Safe to run again; overwrites itself."

    @override
    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--yes-i-know", action="store_true", help="allow it outside DEBUG, on purpose")
        parser.add_argument("--manifest", type=Path, default=None, help="write what was made, as JSON")
        parser.add_argument("--forget", action="store_true", help="only remove what an earlier run left")

    @override
    def handle(self, *args: object, **options: object) -> None:
        allowed = options["yes_i_know"]
        if not settings.DEBUG and not allowed:
            raise CommandError(REFUSAL)
        removed = asyncio.run(forget_demo())
        if removed.anything:
            self.stdout.write(
                f"forgot {removed.accounts} account(s), {removed.rides} ride(s), "
                f"{removed.candidates} candidate(s), {removed.messages} message(s), "
                f"{removed.invites} invite(s)"
            )
        if options["forget"]:
            return
        manifest = asyncio.run(_fill())
        path = options["manifest"]
        if isinstance(path, Path):
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(manifest.model_dump_json(indent=2), encoding="utf-8")
            self.stdout.write(f"manifest: {path}")
        self.stdout.write(
            f"seeded {len(manifest.accounts)} account(s), {len(manifest.rides)} ride(s) on "
            f"{len(manifest.days)} day(s), candidates {json.dumps(manifest.candidates_by_verdict)}"
        )


async def _fill() -> DemoManifest:
    catalog = await DjangoCatalogRepository().load()
    if not catalog.places:
        raise CommandError(NO_CATALOG)
    # The board's own zone (D-094) and the top of the hour: the situations come out the same at
    # any hour, and the clock on the screen is at least a round number.
    anchor = timezone.localtime().replace(minute=0, second=0, microsecond=0)
    return await seed(demo_wiring(), anchor=anchor)
