"""Server-Sent Events over Django ASGI: wire framing and the response every proxy must pass through."""

from collections.abc import AsyncIterator

from django.http import StreamingHttpResponse


def event_frame(*, event: str, data: str, event_id: str | None = None) -> str:
    """One dispatched event. `data` must be a single line; JSON without indentation is."""
    head = "" if event_id is None else f"id: {event_id}\n"
    return f"{head}event: {event}\ndata: {data}\n\n"


def comment_frame(text: str) -> str:
    """A line the browser discards. It keeps idle connections alive through proxies."""
    return f": {text}\n\n"


def retry_frame(milliseconds: int) -> str:
    """How long the browser waits before it reconnects by itself."""
    return f"retry: {milliseconds}\n\n"


def sse_response(frames: AsyncIterator[str]) -> StreamingHttpResponse:
    encoded = (frame.encode() async for frame in frames)
    response = StreamingHttpResponse(encoded, content_type="text/event-stream")
    # `no-transform` stops compression, which buffers; `X-Accel-Buffering` is the nginx-style opt-out
    # that other proxies honour too.
    response["Cache-Control"] = "no-cache, no-transform"
    response["X-Accel-Buffering"] = "no"
    return response
