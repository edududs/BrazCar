"""`SourceMessages` and `Candidates` together: a message is taken by a candidate and goes with it."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from brazcar.importing.application import Candidates, SourceMessages
from brazcar.importing.domain import Accepted, Candidate, Rejected, RejectReason, Sender, SourceMessage
from brazcar.shared.domain.phone import PhoneNumber

RECEIVED = datetime(2026, 9, 23, 20, 0, tzinfo=UTC)
GROUP = "120363000000000001@g.us"
ACCOUNT = PhoneNumber.from_jid_user("5561900000001")
SENDER = PhoneNumber.from_jid_user("5561900000002")


def fresh(
    *,
    account: PhoneNumber = ACCOUNT,
    received_at: datetime = RECEIVED,
    text: str = "3 vagas 19:30",
    phone: PhoneNumber = SENDER,
) -> SourceMessage:
    """A message nobody else stored: examples do not get a clean table."""
    return SourceMessage(
        account=account,
        message_id=uuid4().hex,
        chat_jid=GROUP,
        sender=Sender(phone=phone, display_name="Motorista"),
        sent_at=received_at - timedelta(seconds=5),
        text=text,
        received_at=received_at,
    )


def own_phone() -> PhoneNumber:
    """A sender nobody else uses, so counts and lookups by phone see only this test's rows."""
    return PhoneNumber.from_jid_user(f"55619{uuid4().int % 10**8:08d}")


class ImportingRepositoriesContract:
    """Subclass as `TestMyRepositories`; implement `make_messages` and `make_candidates`."""

    def make_messages(self) -> SourceMessages:
        raise NotImplementedError

    def make_candidates(self, messages: SourceMessages) -> Candidates:
        raise NotImplementedError

    async def test_the_same_message_is_stored_once_and_never_replaced(self) -> None:
        messages = self.make_messages()
        phone = own_phone()
        message = fresh(phone=phone)

        assert await messages.save(message) is True
        assert await messages.save(message.evolve(text="edited")) is False
        assert await messages.delete_from(phone) == 1

    async def test_two_accounts_may_hold_the_same_message_id(self) -> None:
        messages = self.make_messages()
        phone = own_phone()
        message = fresh(account=PhoneNumber.from_jid_user("5561900000001"), phone=phone)
        twin = message.evolve(account=PhoneNumber.from_jid_user("5561900000009"))

        assert await messages.save(message) is True
        assert await messages.save(twin) is True
        assert await messages.delete_from(phone) == 2

    async def test_a_taken_message_leaves_the_unattached_and_goes_with_its_candidate(self) -> None:
        messages = self.make_messages()
        candidates = self.make_candidates(messages)
        phone = own_phone()
        first, second = fresh(phone=phone), fresh(phone=phone, received_at=RECEIVED + timedelta(minutes=1))
        await messages.save(first)
        await messages.save(second)
        candidate = Candidate.open(first, group_label="Rota")

        await candidates.save(candidate, attaching=first)

        free = [m for m in await messages.unattached(100) if m.sender.phone == phone]
        assert free == [second]
        assert await candidates.get(candidate.id) == candidate
        found = await candidates.open_for(phone, candidate.text_key, since=RECEIVED - timedelta(hours=1))
        assert found == candidate
        assert (
            await candidates.open_for(phone, candidate.text_key, since=RECEIVED + timedelta(hours=1)) is None
        )
        assert await messages.delete_older_than(RECEIVED + timedelta(days=1)) >= 1  # `second`, unattached
        assert await candidates.forget_from(phone) == 1
        assert await messages.delete_from(phone) == 0  # `first` went with the candidate

    async def test_a_candidate_round_trips_through_every_verdict_and_leaves_the_pending_list(self) -> None:
        messages = self.make_messages()
        candidates = self.make_candidates(messages)
        phone = own_phone()
        message = fresh(phone=phone)
        await messages.save(message)
        candidate = Candidate.open(message, group_label="Rota").absorb(message)
        await candidates.save(candidate, attaching=message)
        assert candidate in await candidates.pending(1000, max_attempts=3)

        failed = candidate.fail("away", at=RECEIVED)
        await candidates.save(failed)
        assert await candidates.get(candidate.id) == failed
        assert failed in await candidates.pending(1000, max_attempts=3)
        assert failed not in await candidates.pending(1000, max_attempts=1)

        assert failed in await candidates.judged_since(RECEIVED - timedelta(hours=1))
        rejected = failed.judge(Rejected(reason=RejectReason.NO_TIME, confidence=0.5), at=RECEIVED)
        await candidates.save(rejected)
        assert rejected in await candidates.judged_since(RECEIVED - timedelta(hours=1))
        assert rejected not in await candidates.judged_since(RECEIVED + timedelta(hours=1))
        await candidates.save(rejected.reopen())
        assert await candidates.get(candidate.id) == rejected.reopen()
        await candidates.save(rejected)
        assert await candidates.get(candidate.id) == rejected
        assert rejected not in await candidates.pending(1000, max_attempts=3)
        assert await candidates.forget_judged_before(RECEIVED + timedelta(seconds=1)) >= 1
        assert await candidates.get(candidate.id) is None
        assert await messages.delete_from(phone) == 0  # cascaded

    async def test_accepted_candidates_are_forgotten_by_their_ride_and_survive_the_stale_purge(self) -> None:
        messages = self.make_messages()
        candidates = self.make_candidates(messages)
        phone = own_phone()
        ride_id = uuid4()
        message = fresh(phone=phone)
        await messages.save(message)
        accepted = Candidate.open(message, group_label="Rota").judge(Accepted(ride_id=ride_id), at=RECEIVED)
        await candidates.save(accepted, attaching=message)

        assert await candidates.forget_judged_before(RECEIVED + timedelta(days=1)) == 0 or (
            await candidates.get(accepted.id) == accepted
        )
        assert await candidates.get(accepted.id) == accepted
        assert await candidates.forget_by_ride([ride_id]) == 1
        assert await candidates.forget_by_ride([ride_id]) == 0
        assert await candidates.get(accepted.id) is None
