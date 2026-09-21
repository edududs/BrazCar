"""The single NinjaAPI instance. Each context plugs its router in here."""

from django.conf import settings
from ninja import NinjaAPI

from brazcar.shared.adapters.health import router as health_router
from brazcar.shared.adapters.sse_diagnostics import router as sse_diagnostics_router

api = NinjaAPI(
    title="BrazCar API",
    version="0.1.0",
    docs_url="/docs" if settings.DEBUG else None,
)
api.add_router("", health_router)
api.add_router("", sse_diagnostics_router)  # diagnostic, removable: see the module docstring
