"""Hold N SSE connections open and report what they received. Standard library only.

Measurement tool of the SSE tunnel risk test (D-049): the cost on the server is read on the server
(`docker stats`, `/proc/<pid>/fd`) while this script keeps the connections open.

    uv run python scripts/sse_idle_connections.py https://host/api/diagnostics/sse?token=... -n 100 -s 120
"""

import argparse
import asyncio
import ssl
import sys
import time
from dataclasses import dataclass, field
from urllib.parse import urlsplit

HTTP_OK = b" 200 "


@dataclass
class Outcome:
    opened: bool = False
    frames: int = 0
    first_frame_seconds: float | None = None
    ended_after_seconds: float | None = None
    error: str | None = None
    gaps: list[float] = field(default_factory=list[float])


async def hold(url: str, seconds: float, outcome: Outcome) -> None:
    parts = urlsplit(url)
    secure = parts.scheme == "https"
    port = parts.port or (443 if secure else 80)
    target = parts.path + (f"?{parts.query}" if parts.query else "")
    started = time.monotonic()
    try:
        reader, writer = await asyncio.open_connection(
            parts.hostname, port, ssl=ssl.create_default_context() if secure else None
        )
    except OSError as failure:
        outcome.error = f"connect: {failure}"
        return
    try:
        request = f"GET {target} HTTP/1.1\r\nHost: {parts.netloc}\r\nAccept: text/event-stream\r\n\r\n"
        writer.write(request.encode())
        await writer.drain()
        status = await reader.readline()
        outcome.opened = HTTP_OK in status
        if not outcome.opened:
            outcome.error = status.decode(errors="replace").strip()
            return
        last = time.monotonic()
        async with asyncio.timeout(seconds):
            while line := await reader.readline():
                if line.startswith((b"data:", b": ")):
                    now = time.monotonic()
                    if outcome.first_frame_seconds is None:
                        outcome.first_frame_seconds = now - started
                    else:
                        outcome.gaps.append(now - last)
                    last = now
                    outcome.frames += 1
        outcome.ended_after_seconds = time.monotonic() - started  # the peer closed before the deadline
    except TimeoutError:
        pass  # held for the whole duration: the good outcome
    except OSError as failure:
        outcome.error = f"stream: {failure}"
        outcome.ended_after_seconds = time.monotonic() - started
    finally:
        writer.close()


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url")
    parser.add_argument("-n", "--connections", type=int, default=20)
    parser.add_argument("-s", "--seconds", type=float, default=60)
    arguments = parser.parse_args()
    url: str = arguments.url
    count: int = arguments.connections
    seconds: float = arguments.seconds

    outcomes = [Outcome() for _ in range(count)]
    await asyncio.gather(*(hold(url, seconds, outcome) for outcome in outcomes))

    opened = [outcome for outcome in outcomes if outcome.opened]
    cut_short = [outcome for outcome in opened if outcome.ended_after_seconds is not None]
    firsts = [o.first_frame_seconds for o in opened if o.first_frame_seconds is not None]
    gaps = [gap for outcome in opened for gap in outcome.gaps]
    errors = sorted({outcome.error for outcome in outcomes if outcome.error})
    sys.stdout.write(
        f"requested={count} opened={len(opened)} cut_short={len(cut_short)} held_seconds={seconds}\n"
        f"frames_total={sum(o.frames for o in opened)}\n"
        f"first_frame_seconds max={max(firsts, default=0):.3f} avg={sum(firsts) / max(len(firsts), 1):.3f}\n"
        f"gap_seconds min={min(gaps, default=0):.3f} max={max(gaps, default=0):.3f}\n"
        f"cut_short_after={[round(o.ended_after_seconds or 0, 1) for o in cut_short][:10]}\n"
        f"errors={errors[:5]}\n"
    )
    return 0 if len(opened) == count and not cut_short else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
