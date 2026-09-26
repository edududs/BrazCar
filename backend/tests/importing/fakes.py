"""In-memory adapters for the use-case tests. The repositories are held to the port contracts."""

from collections.abc import Collection, Mapping
from datetime import datetime
from uuid import UUID, uuid4

from brazcar.importing.application import ImportedRide, ParserOutput
from brazcar.importing.domain import (
    Accepted,
    Candidate,
    CandidateId,
    Failed,
    Pending,
    RemovalRequest,
    RemovalRequestId,
    ResolvedStop,
    RideDraft,
    Sender,
    SourceMessage,
)
from brazcar.shared.domain.phone import PhoneNumber


class InMemorySourceMessages:
    def __init__(self) -> None:
        self.rows: dict[tuple[str, str], SourceMessage] = {}
        self.attached: dict[tuple[str, str], CandidateId] = {}

    async def save(self, message: SourceMessage) -> bool:
        if message.key in self.rows:
            return False
        self.rows[message.key] = message
        return True

    async def unattached(self, limit: int) -> tuple[SourceMessage, ...]:
        free = [m for key, m in self.rows.items() if key not in self.attached]
        return tuple(sorted(free, key=lambda m: m.sent_at)[:limit])

    async def delete_older_than(self, cutoff: datetime) -> int:
        gone = [k for k, m in self.rows.items() if k not in self.attached and m.received_at < cutoff]
        for key in gone:
            del self.rows[key]
        return len(gone)

    async def delete_from(self, phone: PhoneNumber) -> int:
        gone = [k for k, m in self.rows.items() if m.sender.phone == phone]
        for key in gone:
            del self.rows[key]
            self.attached.pop(key, None)
        return len(gone)

    def drop_of(self, candidate_ids: Collection[CandidateId]) -> int:
        keys = [k for k, c in self.attached.items() if c in candidate_ids]
        for key in keys:
            self.rows.pop(key, None)
            del self.attached[key]
        return len(keys)


class InMemoryCandidates:
    def __init__(self, messages: InMemorySourceMessages) -> None:
        self.rows: dict[CandidateId, Candidate] = {}
        self._messages = messages

    async def get(self, candidate_id: CandidateId) -> Candidate | None:
        return self.rows.get(candidate_id)

    async def open_for(self, phone: PhoneNumber, text_key: str, *, since: datetime) -> Candidate | None:
        found = [
            c
            for c in self.rows.values()
            if c.is_pending
            and c.sender.phone == phone
            and c.text_key == text_key
            and c.first_seen_at >= since
        ]
        return min(found, key=lambda c: c.first_seen_at, default=None)

    async def save(self, candidate: Candidate, *, attaching: SourceMessage | None = None) -> None:
        self.rows[candidate.id] = candidate
        if attaching is not None:
            self._messages.attached[attaching.key] = candidate.id

    async def pending(self, limit: int, *, max_attempts: int) -> tuple[Candidate, ...]:
        due = [
            c
            for c in self.rows.values()
            if isinstance(c.verdict, Pending)
            or (isinstance(c.verdict, Failed) and c.verdict.attempts < max_attempts)
        ]
        return tuple(sorted(due, key=lambda c: c.first_seen_at)[:limit])

    async def judged_since(self, since: datetime) -> tuple[Candidate, ...]:
        judged = [c for c in self.rows.values() if not c.is_pending and c.first_seen_at >= since]
        return tuple(sorted(judged, key=lambda c: c.first_seen_at))

    async def forget_by_ride(self, ride_ids: Collection[UUID]) -> int:
        gone = [
            c.id
            for c in self.rows.values()
            if isinstance(c.verdict, Accepted) and c.verdict.ride_id in ride_ids
        ]
        return self._forget(gone)

    async def forget_judged_before(self, cutoff: datetime) -> int:
        gone = [
            c.id
            for c in self.rows.values()
            if c.judged_at is not None and c.judged_at < cutoff and not isinstance(c.verdict, Accepted)
        ]
        return self._forget(gone)

    async def forget_from(self, phone: PhoneNumber) -> int:
        return self._forget([c.id for c in self.rows.values() if c.sender.phone == phone])

    def _forget(self, ids: list[CandidateId]) -> int:
        for candidate_id in ids:
            del self.rows[candidate_id]
        self._messages.drop_of(ids)
        return len(ids)


class InMemoryBlockedSenders:
    def __init__(self) -> None:
        self.phones: set[PhoneNumber] = set()

    async def is_blocked(self, phone: PhoneNumber) -> bool:
        return phone in self.phones

    async def block(self, phone: PhoneNumber) -> None:
        self.phones.add(phone)


class ScriptedParser:
    """Answers by text key from a table; raises for what it was not told about."""

    def __init__(self, answers: Mapping[str, ParserOutput | Exception]) -> None:
        self.answers = answers
        self.calls: list[str] = []

    async def parse(self, text: str, *, sent_at: datetime, group_label: str) -> ParserOutput:
        del sent_at, group_label  # the script answers by the words alone
        self.calls.append(text)
        answer = self.answers.get(text)
        if answer is None:
            message = f"no scripted answer for {text[:30]!r}"
            raise KeyError(message)
        if isinstance(answer, Exception):
            raise answer
        return answer


class TableStopResolver:
    def __init__(self, known: Mapping[str, str]) -> None:
        self.known = {k.casefold(): v for k, v in known.items()}

    async def resolve(self, texts: tuple[str, ...]) -> tuple[ResolvedStop, ...]:
        return tuple(ResolvedStop(text=t, place_id=self.known.get(t.casefold())) for t in texts)


class RecordingImportedRides:
    """Remembers what it was asked to create; joins by phone and departure like the real one."""

    def __init__(self) -> None:
        self.created: dict[UUID, tuple[Sender, str, str, datetime, RideDraft]] = {}
        self.owned: set[UUID] = set()  # rides linked to an account: never released
        self.forgotten: list[UUID] = []

    async def create(
        self, *, sender: Sender, message_text: str, group_label: str, sent_at: datetime, draft: RideDraft
    ) -> ImportedRide:
        for ride_id, (who, _, _, _, existing) in self.created.items():
            if who.phone == sender.phone and existing.departure_at == draft.departure_at:
                return ImportedRide(ride_id=ride_id, created=False)
        ride_id = uuid4()
        self.created[ride_id] = (sender, message_text, group_label, sent_at, draft)
        return ImportedRide(ride_id=ride_id, created=True)

    async def forget_departed(self, before: datetime) -> tuple[UUID, ...]:
        gone = tuple(i for i, (_, _, _, _, d) in self.created.items() if d.departure_at < before)
        return self._forget(gone)

    async def forget_from(self, phone: PhoneNumber) -> tuple[UUID, ...]:
        gone = tuple(i for i, (who, _, _, _, _) in self.created.items() if who.phone == phone)
        return self._forget(gone)

    async def release(self, ride_id: UUID) -> bool:
        if ride_id in self.owned:
            return False
        self._forget((ride_id,) if ride_id in self.created else ())
        return True

    def _forget(self, ids: tuple[UUID, ...]) -> tuple[UUID, ...]:
        for ride_id in ids:
            del self.created[ride_id]
        self.forgotten.extend(ids)
        return ids


class FixedClock:
    def __init__(self, at: datetime) -> None:
        self.at = at

    def now(self) -> datetime:
        return self.at


class InMemoryRemovalRequests:
    def __init__(self) -> None:
        self.rows: dict[RemovalRequestId, RemovalRequest] = {}

    async def save(self, request: RemovalRequest) -> None:
        self.rows[request.id] = request

    async def get(self, request_id: RemovalRequestId) -> RemovalRequest | None:
        return self.rows.get(request_id)

    async def pending(self) -> tuple[RemovalRequest, ...]:
        return tuple(r for r in await self.all() if r.is_pending)

    async def all(self) -> tuple[RemovalRequest, ...]:
        return tuple(sorted(self.rows.values(), key=lambda r: (r.requested_at, r.id)))
