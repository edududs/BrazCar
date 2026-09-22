"""`BoardSignal` by polling (ADR-0010, D-046): one task per process reads the revision once a second.

The task exists only while someone is subscribed, so an idle process costs nothing. The fan-out
is in memory; a revision bumped by another process arrives on the next poll. `publish` is the
short cut for a writer in this very process, and what a `LISTEN/NOTIFY` adapter (D-050) would
turn into a notification.
"""

import asyncio
import contextlib
from collections.abc import AsyncGenerator

from brazcar.shared.application.ports import BoardRevision

POLL_SECONDS = 1.0


class PollingBoardSignal:
    def __init__(self, revision: BoardRevision, *, poll_seconds: float = POLL_SECONDS) -> None:
        self._revision = revision
        self._poll_seconds = poll_seconds
        self._subscribers: set[asyncio.Queue[int]] = set()
        self._task: asyncio.Task[None] | None = None
        self._last: int | None = None

    async def publish(self, revision: int) -> None:
        self._fan_out(revision)

    async def subscribe(self) -> AsyncGenerator[int]:
        queue: asyncio.Queue[int] = asyncio.Queue()
        self._subscribers.add(queue)
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._poll())
        try:
            while True:
                yield await queue.get()
        finally:
            self._subscribers.discard(queue)
            if not self._subscribers:
                self._stop_polling()

    def _stop_polling(self) -> None:
        task, self._task = self._task, None
        if task is not None:
            task.cancel()

    @property
    def polling(self) -> bool:
        return self._task is not None and not self._task.done()

    async def _poll(self) -> None:
        while True:
            with contextlib.suppress(Exception):  # a failed read is a missed second, not a dead signal
                current = await self._revision.current()
                if self._last is not None and current != self._last:
                    self._fan_out(current)
                self._last = current
            await asyncio.sleep(self._poll_seconds)

    def _fan_out(self, revision: int) -> None:
        if self._last is not None and revision <= self._last:
            return
        self._last = revision
        for queue in self._subscribers:
            queue.put_nowait(revision)
