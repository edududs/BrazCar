"""The single NinjaAPI instance. Each context plugs its router in here."""

from importlib.metadata import version

from django.conf import settings
from ninja import NinjaAPI

from brazcar.accounts.adapters.composition import accounts_router
from brazcar.places.adapters.repository import DjangoCatalogRepository
from brazcar.places.adapters.routes import build_router as build_places_router
from brazcar.shared.adapters.health import router as health_router
from brazcar.shared.adapters.sse_diagnostics import router as sse_diagnostics_router

api = NinjaAPI(
    title="BrazCar API",
    version=version("brazcar"),  # one version for the whole release; the tag is the source (D-082)
    docs_url="/docs" if settings.DEBUG else None,
)
api.add_router("", health_router)
api.add_router("/accounts", accounts_router())
api.add_router("/places", build_places_router(DjangoCatalogRepository()))
api.add_router("", sse_diagnostics_router)  # diagnostic, removable: see the module docstring
