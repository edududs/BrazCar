"""The worker's loop (D-112): the extractor feeds the table; a sweep runs when woken or every minute.

The extractor's handler only sets an event; the sweep does the work on its own task, one pass at a
time, so a slow pass never holds the extractor back. When the extractor ends, for any reason, the
sweep is cancelled and the process exits: the compose restarts it, and the table is where it
resumes from (ADR-0009).
"""

import asyncio
import contextlib
import logging
from collections.abc import Awaitable, Callable

from whatsapp_extractor.application import EventHandler
from whatsapp_extractor.domain import MessageExtracted

log = logging.getLogger(__name__)

type Extract = Callable[[EventHandler[MessageExtracted]], Awaitable[None]]
"""Runs the extractor until it ends, announcing each message to the handler it is given."""
type Sweep = Callable[[], Awaitable[None]]
"""One pass over the pending work. Errors are logged and the next pass is tried anyway."""


async def run_worker(extract: Extract, sweep: Sweep, *, interval: float) -> None:
    wake = asyncio.Event()

    async def on_extracted(_: MessageExtracted) -> None:
        wake.set()

    sweeper = asyncio.create_task(_sweeping(sweep, wake, interval), name="importing-sweep")
    try:
        await extract(on_extracted)
    finally:
        sweeper.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await sweeper


async def _sweeping(sweep: Sweep, wake: asyncio.Event, interval: float) -> None:
    while True:
        try:
            await sweep()
        except Exception:
            log.exception("sweep failed; trying again next time")
        wake.clear()
        with contextlib.suppress(TimeoutError):
            await asyncio.wait_for(wake.wait(), interval)
