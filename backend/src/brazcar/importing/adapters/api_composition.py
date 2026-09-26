"""Wires the public route of `importing` (D-172). Called once, by `config/api.py`.

Apart from `composition.py`, which wires the worker and the commands: the API process never loads
the extractor."""

from ninja import Router

from brazcar.importing.application import RequestRemoval
from brazcar.shared.adapters.clock import SystemClock
from brazcar.shared.adapters.rate_limit import DjangoRateLimiter

from .repository import DjangoRemovalRequests
from .routes import build_router


def removal_router() -> Router:
    return build_router(RequestRemoval(DjangoRemovalRequests(), DjangoRateLimiter(), SystemClock()))
