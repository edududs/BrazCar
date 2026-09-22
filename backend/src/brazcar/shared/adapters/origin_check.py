"""The origin check of ADR-0012: a request that changes state must come from a known front.

The session cookie is `SameSite=Lax`, which already keeps cross-site POSTs from carrying it; this
middleware is the explicit rule on top, and the reason there is no CSRF token (it would not cross
origins). Browsers always send `Origin` on cross-origin and on same-origin unsafe requests.
"""

from http import HTTPStatus

from django.conf import settings
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.utils.deprecation import MiddlewareMixin

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


class OriginCheckMiddleware(MiddlewareMixin):
    """`MiddlewareMixin` serves the sync test client and the async server alike."""

    def process_request(self, request: HttpRequest) -> HttpResponse | None:
        if request.method not in SAFE_METHODS and not _origin_is_known(request):
            return JsonResponse({"detail": "unknown origin"}, status=HTTPStatus.FORBIDDEN)
        return None


def _origin_is_known(request: HttpRequest) -> bool:
    origin = request.headers.get("Origin")
    if origin is None:
        # Not a browser (curl, tests, the healthcheck): the session cookie is not at risk.
        return "HTTP_COOKIE" not in request.META
    own = f"{request.scheme}://{request.get_host()}"
    return origin == own or origin in settings.CORS_ALLOWED_ORIGINS
