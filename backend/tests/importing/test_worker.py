"""The loop of D-112: the handler only wakes the sweep; the sweep survives its own failures."""

import asyncio

import pytest
from whatsapp_extractor.application import EventHandler
from whatsapp_extractor.domain import MessageExtracted
from whatsapp_extractor.testing.factories import make_message

from brazcar.importing.adapters.worker import run_worker


class Counting:
    def __init__(self, *, fail_first: bool = False) -> None:
        self.passes = 0
        self.fail_first = fail_first

    async def __call__(self) -> None:
        self.passes += 1
        if self.fail_first and self.passes == 1:
            message = "database away"
            raise RuntimeError(message)


async def test_the_sweep_runs_at_start_then_once_per_wake_and_stops_with_the_extractor() -> None:
    sweep = Counting()

    async def extract(handler: EventHandler[MessageExtracted]) -> None:
        await asyncio.sleep(0.01)  # the first pass has run by now
        assert sweep.passes == 1
        for n in range(3):  # a burst is one wake
            await handler(MessageExtracted(message=make_message(f"m{n}")))
        await asyncio.sleep(0.01)

    await run_worker(extract, sweep, interval=60)

    assert sweep.passes == 2
    assert not [task for task in asyncio.all_tasks() if task.get_name() == "importing-sweep"]


async def test_the_sweep_also_runs_on_the_interval_and_after_a_failure() -> None:
    sweep = Counting(fail_first=True)

    async def extract(_: EventHandler[MessageExtracted]) -> None:
        await asyncio.sleep(0.05)

    await run_worker(extract, sweep, interval=0.01)

    assert sweep.passes >= 3


async def test_an_extractor_error_ends_the_worker_and_propagates() -> None:
    async def extract(_: EventHandler[MessageExtracted]) -> None:
        message = "connection lost"
        raise ConnectionError(message)

    with pytest.raises(ConnectionError):
        await run_worker(extract, Counting(), interval=60)
