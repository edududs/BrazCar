"""Who sent a request, for a limit per client (D-172).

Behind the Cloudflare tunnel every request reaches the API from the tunnel's own address, so
`REMOTE_ADDR` names the tunnel, not the person. `CLIENT_IP_HEADER` names the header the edge fills
with the real one (`CF-Connecting-IP`). It is trustworthy only because the API can be reached through
the tunnel alone: with a direct way in, anyone could write that header and the limit would not hold.
Unset, as in development and tests, the socket's address is used.
"""

from django.conf import settings
from django.http import HttpRequest

MAX_LENGTH = 45  # the longest textual IPv6 address; a forged header never grows a limiter key past it


def client_ip(request: HttpRequest) -> str:
    """The address the configured header carries; the socket's when unset or absent."""
    header: str = settings.CLIENT_IP_HEADER
    if header:
        forwarded = request.headers.get(header, "").strip()
        if forwarded:
            return forwarded[:MAX_LENGTH]
    return str(request.META.get("REMOTE_ADDR", ""))[:MAX_LENGTH]
