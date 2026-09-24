"""From a message on the table to a ride on the board, one idempotent stage at a time (D-113).

`IngestMessages` turns messages into candidates, `JudgeCandidates` turns candidates into rides,
`PurgeImported` forgets what has served its purpose (D-119), `BlockSender` forgets one sender.
"""

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime, timedelta, tzinfo
from uuid import UUID
from zoneinfo import ZoneInfo

from brazcar.importing.domain import (
    DEDUP_WINDOW,
    Accept,
    Accepted,
    Candidate,
    Offer,
    Rejected,
    RejectReason,
    attach_fares,
    check,
    decide,
    resolve_departure,
    text_key,
)
from brazcar.shared.domain.model import FrozenModel
from brazcar.shared.domain.personal_data import redact_personal_data
from brazcar.shared.domain.phone import PhoneNumber

from .parser_output import to_judgement
from .ports import (
    BlockedSenders,
    Candidates,
    Clock,
    ImportedRides,
    RideParser,
    SourceMessages,
    StopResolver,
)


@dataclass(frozen=True, slots=True)
class ImportRules:
    """The knobs of the context, from configuration."""

    zone: tzinfo = field(default_factory=lambda: ZoneInfo("America/Sao_Paulo"))  # the board's (D-094)
    departure_tolerance: timedelta = timedelta(minutes=10)  # the same the board uses (D-121)
    accept_threshold: float = 0.7  # confidence below this is refused (D-116)
    max_attempts: int = 5  # a candidate the interpreter keeps failing on is left alone (D-112)
    retention: timedelta = timedelta(hours=24)  # what made no ride lives this long (D-119)


@dataclass(frozen=True, slots=True)
class IngestMessages:
    """Every unattached message joins the candidate it reposts, or opens one (D-113)."""

    messages: SourceMessages
    candidates: Candidates
    blocked: BlockedSenders
    groups: Mapping[str, str]  # label by group JID (D-109)

    async def __call__(self, limit: int = 200) -> int:
        touched = 0
        for message in await self.messages.unattached(limit):
            if await self.blocked.is_blocked(message.sender.phone):
                await self.messages.delete_from(message.sender.phone)
                continue
            candidate = await self.candidates.open_for(
                message.sender.phone, text_key(message.text), since=message.sent_at - DEDUP_WINDOW
            )
            if candidate is not None and candidate.accepts(message):
                await self.candidates.save(candidate.absorb(message), attaching=message)
            else:
                label = self.groups.get(message.chat_jid, message.chat_jid)
                await self.candidates.save(Candidate.open(message, group_label=label), attaching=message)
            touched += 1
        return touched


class Judged(FrozenModel):
    candidate: Candidate
    created_ride: bool = False


@dataclass(frozen=True, slots=True)
class JudgeCandidates:
    """One candidate at a time: read, resolve, decide, and hand the accepted ones to `rides`."""

    candidates: Candidates
    parser: RideParser
    resolver: StopResolver
    rides: ImportedRides
    clock: Clock
    rules: ImportRules

    async def __call__(self, limit: int = 1) -> tuple[Judged, ...]:
        pending = await self.candidates.pending(limit, max_attempts=self.rules.max_attempts)
        return tuple([await self.judge(candidate) for candidate in pending])

    async def judge(self, candidate: Candidate) -> Judged:
        now = self.clock.now()
        try:
            output = await self.parser.parse(
                candidate.text, sent_at=candidate.first_seen_at, group_label=candidate.group_label
            )
        except Exception as error:  # noqa: BLE001 - whatever the interpreter raised, the sweep retries (D-112)
            failed = candidate.fail(f"{type(error).__name__}: {error}", at=now)
            await self.candidates.save(failed)
            return Judged(candidate=failed)
        judgement = to_judgement(output)
        departure = stops = checks = None
        if isinstance(judgement, Offer):
            resolved = await self.resolver.resolve(judgement.stops)
            stops = attach_fares(resolved, judgement.fares, candidate.text)
            departure = resolve_departure(
                sent_at=candidate.first_seen_at,
                day=judgement.day,
                at=judgement.at,
                zone=self.rules.zone,
                tolerance=self.rules.departure_tolerance,
            )
            checks = check(judgement, candidate.text, resolved=tuple(stop.known for stop in stops))
        decision = decide(
            judgement,
            departure_at=departure,
            stops=stops or (),
            checks=checks,
            threshold=self.rules.accept_threshold,
        )
        if not isinstance(decision, Accept):
            judged = candidate.judge(decision, at=now)
            await self.candidates.save(judged)
            return Judged(candidate=judged)
        try:
            imported = await self.rides.create(
                sender=candidate.sender,
                message_text=redact_personal_data(candidate.text),
                group_label=candidate.group_label,
                sent_at=candidate.first_seen_at,
                draft=decision.draft,
            )
        except LookupError:  # a place the catalog knew a moment ago and forgot
            judged = candidate.judge(
                Rejected(reason=RejectReason.UNKNOWN_PLACE, confidence=decision.confidence), at=now
            )
            await self.candidates.save(judged)
            return Judged(candidate=judged)
        judged = candidate.judge(Accepted(ride_id=imported.ride_id, joined=not imported.created), at=now)
        await self.candidates.save(judged)
        return Judged(candidate=judged, created_ride=imported.created)


class PurgeReport(FrozenModel):
    rides: int
    candidates: int
    messages: int


@dataclass(frozen=True, slots=True)
class PurgeImported:
    """Nothing imported outlives its use (D-119): rides that left, judgements that made no ride."""

    messages: SourceMessages
    candidates: Candidates
    rides: ImportedRides
    clock: Clock
    rules: ImportRules

    async def __call__(self) -> PurgeReport:
        now = self.clock.now()
        gone = await self.rides.forget_departed(now - self.rules.departure_tolerance)
        candidates = await self.candidates.forget_by_ride(gone)
        candidates += await self.candidates.forget_judged_before(now - self.rules.retention)
        messages = await self.messages.delete_older_than(now - self.rules.retention)
        return PurgeReport(rides=len(gone), candidates=candidates, messages=messages)


class RejudgeReport(FrozenModel):
    reopened: int
    rides_released: int
    kept: int  # accepted into an account's ride, left alone


@dataclass(frozen=True, slots=True)
class ReopenJudged:
    """A manual rejudge (D-130): what was judged since a moment goes back to pending, and the external
    rides it made leave the board, so the next sweep reads the same messages again. A tool for
    control and tests, not a routine."""

    candidates: Candidates
    rides: ImportedRides

    async def __call__(self, since: datetime) -> RejudgeReport:
        reopened = released = kept = 0
        seen_rides: dict[UUID, bool] = {}
        for candidate in await self.candidates.judged_since(since):
            verdict = candidate.verdict
            if isinstance(verdict, Accepted):
                if verdict.ride_id not in seen_rides:
                    seen_rides[verdict.ride_id] = await self.rides.release(verdict.ride_id)
                    released += seen_rides[verdict.ride_id]
                if not seen_rides[verdict.ride_id]:
                    kept += 1
                    continue
            await self.candidates.save(candidate.reopen())
            reopened += 1
        return RejudgeReport(reopened=reopened, rides_released=released, kept=kept)


@dataclass(frozen=True, slots=True)
class BlockSender:
    """Someone asked to be left out: nothing of theirs stays, nothing of theirs comes in (D-119)."""

    blocked: BlockedSenders
    messages: SourceMessages
    candidates: Candidates
    rides: ImportedRides

    async def __call__(self, phone: PhoneNumber) -> PurgeReport:
        await self.blocked.block(phone)
        rides = await self.rides.forget_from(phone)
        candidates = await self.candidates.forget_from(phone)
        messages = await self.messages.delete_from(phone)
        return PurgeReport(rides=len(rides), candidates=candidates, messages=messages)
