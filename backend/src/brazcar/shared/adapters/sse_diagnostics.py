"""DIAGNOSTIC route, not product: a numbered SSE stream to measure what the path to the browser does.

It exists for the risk test of D-049 (Cloudflare tunnel -> Traefik -> API -> iPhone). It is off unless
`SSE_DIAGNOSTICS_TOKEN` is set, stays out of the OpenAPI contract, and can be deleted with its test
and its line in `config/api.py` once the real board signal (D-046) has replaced it.

It never touches the ORM, so an open stream holds no database connection.
"""

import asyncio
import json
import math
import time
from collections.abc import AsyncIterator
from hmac import compare_digest
from http import HTTPStatus

from django.conf import settings
from django.http import HttpRequest, StreamingHttpResponse
from ninja import Field, Query, Router, Schema
from ninja.errors import HttpError

from brazcar.shared.adapters.sse import comment_frame, event_frame, retry_frame, sse_response

router = Router(tags=["diagnostics"])

_BROWSER_RETRY_MS = 3000
_MIN_INTERVAL_SECONDS = 0.1


class StreamOptions(Schema):
    token: str = ""
    # 0 turns the corresponding frame off. Both off gives a silent connection, to watch a proxy cut it.
    tick_seconds: float = Field(default=1.0, ge=0, le=60)
    heartbeat_seconds: float = Field(default=15.0, ge=0, le=300)


async def diagnostic_frames(*, tick_seconds: float, heartbeat_seconds: float) -> AsyncIterator[str]:
    """Ticks carry a sequence number and the server clock; heartbeats are comments. 0 disables either."""
    yield retry_frame(_BROWSER_RETRY_MS)
    loop = asyncio.get_running_loop()
    next_tick = loop.time() if tick_seconds else math.inf
    next_heartbeat = loop.time() + heartbeat_seconds if heartbeat_seconds else math.inf
    sequence = 0
    while True:
        due = min(next_tick, next_heartbeat)
        if math.isinf(due):
            await asyncio.Event().wait()  # silent until the client or a proxy gives up
        await asyncio.sleep(max(0.0, due - loop.time()))
        if next_tick <= next_heartbeat:
            sequence += 1
            payload = json.dumps({"seq": sequence, "server_time_ms": time.time_ns() // 1_000_000})
            yield event_frame(event="tick", data=payload, event_id=str(sequence))
            next_tick += tick_seconds
        else:
            yield comment_frame("ping")
            next_heartbeat += heartbeat_seconds


def _authorized(token: str) -> bool:
    expected: str = settings.SSE_DIAGNOSTICS_TOKEN
    return bool(expected) and compare_digest(token.encode(), expected.encode())


def _at_least_minimum(seconds: float) -> float:
    return max(seconds, _MIN_INTERVAL_SECONDS) if seconds else 0.0


@router.get("/diagnostics/sse", include_in_schema=False)
async def stream_diagnostics(request: HttpRequest, options: Query[StreamOptions]) -> StreamingHttpResponse:
    if not _authorized(options.token):
        # Same answer whether the route is off or the token is wrong.
        raise HttpError(HTTPStatus.NOT_FOUND, "Not Found")
    return sse_response(
        diagnostic_frames(
            tick_seconds=_at_least_minimum(options.tick_seconds),
            heartbeat_seconds=_at_least_minimum(options.heartbeat_seconds),
        )
    )
