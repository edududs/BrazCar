"""Asking for removal, and deciding it, with fakes (D-172)."""

from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from brazcar.importing.application import (
    ApproveRemoval,
    BlockSender,
    PurgeReport,
    RefuseRemoval,
    RemovalRequestNotFoundError,
    RequestRemoval,
)
from brazcar.importing.domain import (
    Approved,
    Refused,
    RemovalAlreadyDecidedError,
    RemovalRequest,
    TooManyAttemptsError,
)
from brazcar.shared.domain.phone import InvalidPhoneNumberError, PhoneNumber
from tests.shared.fakes import InMemoryRateLimiter

from .fakes import (
    FixedClock,
    InMemoryBlockedSenders,
    InMemoryCandidates,
    InMemoryRemovalRequests,
    InMemorySourceMessages,
    RecordingImportedRides,
)

NOW = datetime(2026, 9, 26, 12, 0, tzinfo=UTC)
ZE = "(61) 99999-0009"
ZE_PHONE = PhoneNumber.parse(ZE)


class RecordingBlockedSenders(InMemoryBlockedSenders):
    """Writes down when the block ran, next to the saves; `fail` makes it break instead."""

    def __init__(self, log: list[str], *, fail: bool = False) -> None:
        super().__init__()
        self.log = log
        self.fail = fail

    async def block(self, phone: PhoneNumber) -> None:
        self.log.append(f"block {phone.e164()}")
        if self.fail:
            message = "the database went away"
            raise ConnectionError(message)
        await super().block(phone)


def block_sender(blocked: InMemoryBlockedSenders) -> BlockSender:
    messages = InMemorySourceMessages()
    return BlockSender(blocked, messages, InMemoryCandidates(messages), RecordingImportedRides())


class RecordingRequests(InMemoryRemovalRequests):
    def __init__(self, log: list[str]) -> None:
        super().__init__()
        self.log = log

    async def save(self, request: RemovalRequest) -> None:
        self.log.append(f"save {request.decision.kind}")
        await super().save(request)


class Context:
    def __init__(self, *, fail_block: bool = False) -> None:
        self.log: list[str] = []
        self.clock = FixedClock(NOW)
        self.requests = RecordingRequests(self.log)
        self.limiter = InMemoryRateLimiter(self.clock)
        self.blocked = RecordingBlockedSenders(self.log, fail=fail_block)
        self.ask = RequestRemoval(self.requests, self.limiter, self.clock)
        self.approve = ApproveRemoval(self.requests, block_sender(self.blocked), self.clock)
        self.refuse = RefuseRemoval(self.requests, self.clock)

    async def filed(self, phone: str = ZE, note: str | None = None) -> RemovalRequest:
        await self.ask(phone=phone, note=note, client="203.0.113.7")
        (request,) = [r for r in self.requests.rows.values() if r.phone == PhoneNumber.parse(phone)]
        self.log.clear()
        return request


@pytest.fixture
def ctx() -> Context:
    return Context()


# --- asking ----------------------------------------------------------------------------------------


async def test_a_request_is_recorded_pending_and_removes_nothing(ctx: Context) -> None:
    await ctx.ask(phone=ZE, note="Não autorizei.", client="203.0.113.7")

    (request,) = ctx.requests.rows.values()
    assert request.phone == ZE_PHONE
    assert request.note == "Não autorizei."
    assert request.is_pending
    assert request.requested_at == NOW
    assert not await ctx.blocked.is_blocked(ZE_PHONE)


async def test_a_malformed_phone_or_note_spends_no_window(ctx: Context) -> None:
    with pytest.raises(InvalidPhoneNumberError):
        await ctx.ask(phone="123", note=None, client="203.0.113.7")
    with pytest.raises(ValidationError):
        await ctx.ask(phone=ZE, note="a" * 501, client="203.0.113.7")

    assert ctx.requests.rows == {}
    assert ctx.limiter.hits == {}


async def test_the_limit_per_client_is_told(ctx: Context) -> None:
    for n in range(10):
        await ctx.ask(phone=f"(61) 99999-{n:04d}", note=None, client="203.0.113.7")

    with pytest.raises(TooManyAttemptsError):
        await ctx.ask(phone="(61) 99999-0100", note=None, client="203.0.113.7")
    await ctx.ask(phone="(61) 99999-0100", note=None, client="198.51.100.1")  # another client

    assert len(ctx.requests.rows) == 11


async def test_the_limit_per_phone_is_silent(ctx: Context) -> None:
    for client in ("203.0.113.1", "203.0.113.2", "203.0.113.3", "203.0.113.4"):
        await ctx.ask(phone=ZE, note=None, client=client)

    assert len(ctx.requests.rows) == 3


async def test_the_limits_forget_after_a_day(ctx: Context) -> None:
    for _ in range(4):
        await ctx.ask(phone=ZE, note=None, client="203.0.113.7")
    ctx.clock.at = NOW + timedelta(hours=24, seconds=1)

    await ctx.ask(phone=ZE, note=None, client="203.0.113.7")

    assert len(ctx.requests.rows) == 4


# --- approving -------------------------------------------------------------------------------------


async def test_approving_blocks_first_and_records_after(ctx: Context) -> None:
    request = await ctx.filed()

    report = await ctx.approve(request.id)

    assert ctx.log == [f"block {ZE_PHONE.e164()}", "save approved"]
    assert report == PurgeReport(rides=0, candidates=0, messages=0)
    assert await ctx.blocked.is_blocked(ZE_PHONE)
    assert ctx.requests.rows[request.id].decision == Approved(at=NOW)


async def test_a_failed_block_leaves_the_request_pending_and_a_retry_finishes() -> None:
    failing = Context(fail_block=True)
    request = await failing.filed()

    with pytest.raises(ConnectionError):
        await failing.approve(request.id)

    assert failing.requests.rows[request.id].is_pending
    assert "save approved" not in failing.log
    failing.blocked.fail = False
    assert await failing.approve(request.id) is not None
    assert isinstance(failing.requests.rows[request.id].decision, Approved)


async def test_approving_twice_blocks_once(ctx: Context) -> None:
    request = await ctx.filed()

    await ctx.approve(request.id)
    again = await ctx.approve(request.id)

    assert again is None
    assert ctx.log.count(f"block {ZE_PHONE.e164()}") == 1
    assert ctx.log.count("save approved") == 1


async def test_a_refused_request_is_not_approved_and_nothing_is_blocked(ctx: Context) -> None:
    request = await ctx.filed()
    await ctx.refuse(request.id)
    ctx.log.clear()

    with pytest.raises(RemovalAlreadyDecidedError):
        await ctx.approve(request.id)

    assert ctx.log == []
    assert not await ctx.blocked.is_blocked(ZE_PHONE)


async def test_an_unknown_request_is_not_found(ctx: Context) -> None:
    request = RemovalRequest.open(phone=ZE_PHONE, note=None, at=NOW)

    with pytest.raises(RemovalRequestNotFoundError):
        await ctx.approve(request.id)
    with pytest.raises(RemovalRequestNotFoundError):
        await ctx.refuse(request.id)


# --- refusing --------------------------------------------------------------------------------------


async def test_refusing_records_and_removes_nothing_and_twice_is_once(ctx: Context) -> None:
    request = await ctx.filed()

    assert await ctx.refuse(request.id) is True
    assert await ctx.refuse(request.id) is False

    assert ctx.log == ["save refused"]
    assert ctx.requests.rows[request.id].decision == Refused(at=NOW)
    assert not await ctx.blocked.is_blocked(ZE_PHONE)


async def test_an_approved_request_is_not_refused(ctx: Context) -> None:
    request = await ctx.filed()
    await ctx.approve(request.id)

    with pytest.raises(RemovalAlreadyDecidedError):
        await ctx.refuse(request.id)


# --- the block itself ------------------------------------------------------------------------------


async def test_blocking_twice_is_harmless() -> None:
    """Approving again after a failure in the middle relies on it (D-172)."""
    block = block_sender(InMemoryBlockedSenders())

    await block(ZE_PHONE)
    second = await block(ZE_PHONE)

    assert second == PurgeReport(rides=0, candidates=0, messages=0)
    assert await block.blocked.is_blocked(ZE_PHONE)
