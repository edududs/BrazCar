"""The removal request of the public page, and its decision by command (D-162, D-172).

Asking removes nothing: the page is public, and anyone could otherwise wipe someone else's rides.
Approving reuses `BlockSender`, which already forgets messages, candidates and rides of a phone.
"""

from dataclasses import dataclass
from datetime import timedelta

from brazcar.importing.domain import (
    Approved,
    RemovalRequest,
    RemovalRequestId,
    TooManyAttemptsError,
)
from brazcar.shared.application.ports import RateLimiter
from brazcar.shared.domain.phone import PhoneNumber

from .ports import Clock, RemovalRequests
from .use_cases import BlockSender, PurgeReport

LIMIT_WINDOW = timedelta(hours=24)
REQUESTS_PER_CLIENT = 10  # over it: 429, the only limit that is told (D-172)
REQUESTS_PER_PHONE = 3  # over it: silence, so the answer never tells whether a phone is known


class RemovalRequestNotFoundError(LookupError):
    def __init__(self, request_id: RemovalRequestId) -> None:
        super().__init__(f"no removal request {request_id}")


@dataclass(frozen=True, slots=True)
class RequestRemoval:
    requests: RemovalRequests
    limiter: RateLimiter
    clock: Clock

    async def __call__(self, *, phone: str, note: str | None, client: str) -> None:
        """`client` is opaque: whatever the adapter says identifies the sender, an address usually.

        Raises `InvalidPhoneNumberError`, a validation error, or `TooManyAttemptsError`, in that
        order: a form with a mistake spends no window. The same answer whether the phone has rides
        on the board or not, and whether its own limit was reached or not.
        """
        request = RemovalRequest.open(phone=PhoneNumber.parse(phone), note=note, at=self.clock.now())
        if not await self.limiter.acquire(
            f"removal-ip:{client}", limit=REQUESTS_PER_CLIENT, window=LIMIT_WINDOW
        ):
            raise TooManyAttemptsError
        if not await self.limiter.acquire(
            f"removal:{request.phone.e164()}", limit=REQUESTS_PER_PHONE, window=LIMIT_WINDOW
        ):
            return
        await self.requests.save(request)


@dataclass(frozen=True, slots=True)
class ApproveRemoval:
    requests: RemovalRequests
    block: BlockSender
    clock: Clock

    async def __call__(self, request_id: RemovalRequestId) -> PurgeReport | None:
        """What was removed now; `None` when it had been approved before and nothing was done.

        Raises `RemovalRequestNotFoundError`, and `RemovalAlreadyDecidedError` for a refused one.
        The phone is blocked first and the approval written after: a failure in between leaves the
        request pending, and blocking again is harmless, so approving again finishes the job.
        """
        request = await self.requests.get(request_id)
        if request is None:
            raise RemovalRequestNotFoundError(request_id)
        if isinstance(request.decision, Approved):
            return None
        approved = request.approve(self.clock.now())
        report = await self.block(request.phone)
        await self.requests.save(approved)
        return report


@dataclass(frozen=True, slots=True)
class RefuseRemoval:
    requests: RemovalRequests
    clock: Clock

    async def __call__(self, request_id: RemovalRequestId) -> bool:
        """True when refused now; False when it had been refused before.

        Raises `RemovalRequestNotFoundError`, and `RemovalAlreadyDecidedError` for an approved one.
        """
        request = await self.requests.get(request_id)
        if request is None:
            raise RemovalRequestNotFoundError(request_id)
        refused = request.refuse(self.clock.now())
        if refused == request:
            return False
        await self.requests.save(refused)
        return True
