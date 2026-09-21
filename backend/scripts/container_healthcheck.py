"""Container healthcheck. Exits non-zero unless the API answers /api/health.

It introduces itself with the first allowed host: with DJANGO_DEBUG off Django refuses
`127.0.0.1`, and a container that never turns healthy is never routed by Traefik.
"""

import os
import sys
import urllib.request

host = os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost").split(",")[0].strip() or "localhost"
request = urllib.request.Request("http://127.0.0.1:8000/api/health", headers={"Host": host})
with urllib.request.urlopen(request, timeout=2) as response:  # noqa: S310 - same
    sys.exit(0 if response.status == 200 else 1)  # noqa: PLR2004 - HTTP OK
