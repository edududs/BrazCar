"""The single NinjaAPI instance. Each context plugs its router in here."""

from http import HTTPStatus
from importlib.metadata import version

from django.conf import settings
from django.http import HttpRequest, HttpResponse
from ninja import NinjaAPI
from pydantic import ValidationError

from brazcar.accounts.adapters.composition import accounts_router
from brazcar.feedback.adapters.composition import feedback_router
from brazcar.places.adapters.repository import DjangoCatalogRepository
from brazcar.places.adapters.routes import build_router as build_places_router
from brazcar.rides.adapters.composition import rides_router
from brazcar.shared.adapters.health import router as health_router
from brazcar.shared.adapters.sse_diagnostics import router as sse_diagnostics_router
from brazcar.shared.adapters.web_version import router as web_version_router

api = NinjaAPI(
    title="BrazCar API",
    version=version("brazcar"),  # one version for the whole release; the tag is the source (D-082)
    docs_url="/docs" if settings.DEBUG else None,
)
api.add_router("", health_router)
api.add_router("", web_version_router)
api.add_router("/accounts", accounts_router())
api.add_router("/places", build_places_router(DjangoCatalogRepository()))
api.add_router("/rides", rides_router())
api.add_router("/feedback", feedback_router())
api.add_router("", sse_diagnostics_router)  # diagnostic, removable: see the module docstring


@api.exception_handler(ValidationError)
def _domain_validation_error(request: HttpRequest, exc: ValidationError) -> HttpResponse:  # noqa: ARG001
    """A domain object refusing its own construction (D-158): a route's schema or its own
    try/except is meant to catch this first, with a message that names what was wrong. This is the
    net underneath both, registered once instead of a try/except repeated on every route, so a
    `pydantic.ValidationError` no route expects yet still answers 422, never the 500 every other
    exception falls back to (Schemathesis found this on `POST /api/accounts/cars`)."""
    return api.create_response(
        request, {"detail": "confira os dados enviados"}, status=HTTPStatus.UNPROCESSABLE_CONTENT
    )
