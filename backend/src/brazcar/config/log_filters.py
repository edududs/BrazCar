"""Keeping the tokens of the invite's links out of the logs (D-167).

The invite's link and the e-mail's link carry their token in the API path, and both the request
log of Django (`Not Found: /api/...`, `Gone: /api/...`) and the access log of uvicorn write the path
of the request. This filter rewrites that segment before any handler sees the record.
"""

import logging
import re
from typing import override

_SECRET_SEGMENT = re.compile(r"(/api/accounts/(?:invites|signup)/)[^/?#\s\"']+")
REDACTED = "[token]"


def redact_secret_paths(text: str) -> str:
    return _SECRET_SEGMENT.sub(rf"\g<1>{REDACTED}", text)


class RedactSecretPaths(logging.Filter):
    """Attached to the loggers that write request paths, in `LOGGING`; it drops nothing."""

    @override
    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = redact_secret_paths(str(record.msg))
        if isinstance(record.args, tuple):
            record.args = tuple(redact_secret_paths(a) if isinstance(a, str) else a for a in record.args)
        return True
