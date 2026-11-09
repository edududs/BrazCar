"""Wires the public route of `importing` (D-172). Called once, by `config/api.py`.

Apart from `composition.py`, which wires the worker and the commands: the API process never loads
the extractor."""

from datetime import timedelta

from django.conf import settings
from ninja import Router

from brazcar.importing.application import CheckImportingHealth, RequestRemoval
from brazcar.shared.adapters.clock import SystemClock
from brazcar.shared.adapters.rate_limit import DjangoRateLimiter

from .config import ImportingSettings
from .health_routes import build_health_router
from .repository import DjangoCandidates, DjangoRemovalRequests, DjangoSourceMessages
from .routes import build_router


def removal_router() -> Router:
    return build_router(RequestRemoval(DjangoRemovalRequests(), DjangoRateLimiter(), SystemClock()))


def importing_health_router() -> Router:
    """The state of the importing (D-193), read from the tables the worker writes. The process of
    the API has no worker: `off` means no watched group is configured here."""
    stale_after = timedelta(hours=settings.IMPORT_STALE_AFTER_HOURS)

    def configured() -> bool:
        return bool(ImportingSettings.from_django().groups)

    return build_health_router(
        CheckImportingHealth(
            DjangoCandidates(), DjangoSourceMessages(), SystemClock(), configured, stale_after
        )
    )
