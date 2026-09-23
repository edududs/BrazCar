"""Rebuild the search index of every ride still to depart. Idempotent; runs in the entrypoint.

The index is derived data (D-100): a catalog rename, or a write whose indexing failed, is made
right here, at the next deploy or by hand.
"""

import asyncio
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from brazcar.rides.adapters.composition import ride_search
from brazcar.rides.adapters.repository import DjangoRideRepository


class Command(BaseCommand):
    help = "Rebuild the search index of the rides still to depart."

    def handle(self, *args: object, **options: object) -> None:  # noqa: ARG002 - Django's signature
        count = asyncio.run(_reindex())
        self.stdout.write(f"rides: {count} indexed")


async def _reindex() -> int:
    search = ride_search()
    rides = await DjangoRideRepository().upcoming(timezone.now() - timedelta(days=1))
    for ride in rides:
        await search.index(ride)
    return len(rides)
