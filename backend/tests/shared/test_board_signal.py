"""The polling adapter of `BoardSignal` (ADR-0010), against a counter the test moves by hand."""

import asyncio
import contextlib
from collections.abc import AsyncIterator

import pytest

from brazcar.shared.adapters.board_signal import PollingBoardSignal

POLL = 0.01


class Counter:
    def __init__(self) -> None:
        self.revision = 0
        self.reads = 0

    async def current(self) -> int:
        self.reads += 1
        return self.revision


async def first(numbers: AsyncIterator[int], *, within: float = 1.0) -> int:
    return await asyncio.wait_for(anext(numbers), within)


async def test_a_subscriber_hears_each_new_revision_once_and_in_order() -> None:
    counter = Counter()
    signal = PollingBoardSignal(counter, poll_seconds=POLL)
    numbers = signal.subscribe()
    heard: list[int] = []

    async def listen() -> None:
        async for number in numbers:
            heard.append(number)
            if len(heard) == 2:
                break

    listening = asyncio.create_task(listen())
    await asyncio.sleep(POLL * 3)  # the first read only learns where the counter is
    counter.revision = 5
    await asyncio.sleep(POLL * 3)
    counter.revision = 6
    await asyncio.wait_for(listening, 1.0)

    assert heard == [5, 6]
    assert counter.reads >= 2


async def test_publish_reaches_subscribers_at_once_and_the_poll_does_not_repeat_it() -> None:
    counter = Counter()
    signal = PollingBoardSignal(counter, poll_seconds=POLL)
    numbers = signal.subscribe()
    listening = asyncio.create_task(first(numbers))
    await asyncio.sleep(POLL * 2)

    counter.revision = 3
    await signal.publish(3)

    assert await listening == 3
    with pytest.raises(TimeoutError):  # the next polls see 3 again and must stay quiet
        await first(numbers, within=POLL * 5)
    await numbers.aclose()


async def test_the_poll_runs_only_while_someone_listens() -> None:
    counter = Counter()
    signal = PollingBoardSignal(counter, poll_seconds=POLL)
    assert not signal.polling

    numbers = signal.subscribe()
    listening = asyncio.create_task(first(numbers, within=POLL * 5))
    await asyncio.sleep(POLL * 2)
    assert signal.polling

    listening.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await listening
    await numbers.aclose()

    assert not signal.polling
    reads = counter.reads
    await asyncio.sleep(POLL * 3)
    assert counter.reads == reads
