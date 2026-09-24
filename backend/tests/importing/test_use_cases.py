"""The three stages of D-113 with fakes: message to candidate, candidate to ride, and the purge."""

from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest

from brazcar.importing.application import (
    BlockSender,
    ImportRules,
    IngestMessages,
    JudgeCandidates,
    ParserOutput,
    PurgeImported,
    ReopenJudged,
    StopFare,
)
from brazcar.importing.domain import Accepted, Failed, Rejected, RejectReason, Sender, SourceMessage
from brazcar.shared.domain.phone import PhoneNumber

from .fakes import (
    FixedClock,
    InMemoryBlockedSenders,
    InMemoryCandidates,
    InMemorySourceMessages,
    RecordingImportedRides,
    ScriptedParser,
    TableStopResolver,
)

BRASILIA = ZoneInfo("America/Sao_Paulo")
EVENING = datetime(2026, 9, 22, 21, 15, tzinfo=BRASILIA)
NEXT_MORNING = datetime(2026, 9, 23, 5, 45, tzinfo=BRASILIA)
GROUPS = {"1@g.us": "Rota Plano", "2@g.us": "Rota 2"}
ZE = Sender(phone=PhoneNumber.from_jid_user("5561999990009"), display_name="Zé")
OFFER = "*03 VAGAS as 05:45*\n🚘 Veredas\n🚘 Rodeador\n🚘 Rodoviária\n💵 7,00 Pix 61 98888-7777"
ASK = "Alguma vaga voltando 12h sentido Braz?"
CHAT = "bom dia pessoal"
RULES = ImportRules(accept_threshold=0.7, max_attempts=2, retention=timedelta(hours=24))
OFFER_READ = ParserOutput(
    kind="offer",
    time="05:45",
    stops=["Veredas", "Rodeador", "Rodoviária"],
    seats=3,
    price="7.00",
    payment_methods=["pix"],
)


def message(
    text: str = OFFER,
    *,
    message_id: str = "m1",
    chat: str = "1@g.us",
    sent_at: datetime = EVENING,
    sender: Sender = ZE,
) -> SourceMessage:
    return SourceMessage(
        account=PhoneNumber.from_jid_user("5561900000001"),
        message_id=message_id,
        chat_jid=chat,
        sender=sender,
        sent_at=sent_at,
        text=text,
        received_at=sent_at + timedelta(seconds=1),
    )


class Context:
    def __init__(self, *answers: tuple[str, ParserOutput | Exception], now: datetime = EVENING) -> None:
        self.messages = InMemorySourceMessages()
        self.candidates = InMemoryCandidates(self.messages)
        self.blocked = InMemoryBlockedSenders()
        self.rides = RecordingImportedRides()
        self.parser = ScriptedParser(dict(answers))
        self.clock = FixedClock(now)
        self.ingest = IngestMessages(self.messages, self.candidates, self.blocked, GROUPS)
        self.judge = JudgeCandidates(
            self.candidates,
            self.parser,
            TableStopResolver({"Veredas": "veredas", "Rodeador": "rodeador", "Rodoviária": "rodoviaria"}),
            self.rides,
            self.clock,
            RULES,
        )
        self.purge = PurgeImported(self.messages, self.candidates, self.rides, self.clock, RULES)
        self.block = BlockSender(self.blocked, self.messages, self.candidates, self.rides)
        self.reopen = ReopenJudged(self.candidates, self.rides)

    async def arriving(self, *messages: SourceMessage) -> int:
        for each in messages:
            await self.messages.save(each)
        return await self.ingest()


@pytest.fixture
def ctx() -> Context:
    return Context(
        (OFFER, OFFER_READ), (ASK, ParserOutput(kind="request")), (CHAT, ParserOutput(kind="other"))
    )


# --- ingest ----------------------------------------------------------------------------------------


async def test_the_same_posting_in_three_groups_is_one_candidate_with_three_sources(ctx: Context) -> None:
    await ctx.arriving(
        message(message_id="a", chat="1@g.us"),
        message(message_id="b", chat="2@g.us", sent_at=EVENING + timedelta(seconds=30)),
        message(
            "03 vagas às 05:45 🚗 Veredas 🚗 Rodeador 🚗 Rodoviária 7,00 Pix 61 98888-7777",
            message_id="c",
            sent_at=EVENING + timedelta(minutes=2),
        ),
        message(
            ASK,
            message_id="d",
            sender=Sender(phone=PhoneNumber.from_jid_user("5561999990001"), display_name="Bia"),
        ),
    )

    candidates = sorted(ctx.candidates.rows.values(), key=lambda c: c.first_seen_at)
    assert [(c.sources, c.group_label) for c in candidates] == [(3, "Rota Plano"), (1, "Rota Plano")]
    assert await ctx.messages.unattached(10) == ()
    assert await ctx.ingest() == 0  # nothing left: running again changes nothing


async def test_the_same_words_after_the_window_open_another_candidate(ctx: Context) -> None:
    await ctx.arriving(message(message_id="a"), message(message_id="b", sent_at=EVENING + timedelta(hours=7)))

    assert len(ctx.candidates.rows) == 2


async def test_a_blocked_sender_never_gets_a_candidate_and_loses_the_message(ctx: Context) -> None:
    await ctx.blocked.block(ZE.phone)

    await ctx.arriving(message())

    assert ctx.candidates.rows == {}
    assert ctx.messages.rows == {}


# --- judge -----------------------------------------------------------------------------------------


async def test_an_offer_becomes_a_ride_with_the_departure_resolved_and_the_words_redacted(
    ctx: Context,
) -> None:
    await ctx.arriving(message())

    (judged,) = await ctx.judge()

    assert judged.created_ride is True
    assert isinstance(judged.candidate.verdict, Accepted)
    (sender, text, label, sent_at, draft) = next(iter(ctx.rides.created.values()))
    assert sender == ZE
    assert "98888" not in text
    assert "[…]" in text
    assert label == "Rota Plano"
    assert sent_at == EVENING
    assert draft.departure_at == NEXT_MORNING
    assert (draft.seats, draft.price, draft.payment_methods) == (3, Decimal("7.00"), frozenset({"pix"}))
    assert [stop.place_id for stop in draft.stops] == ["veredas", "rodeador", "rodoviaria"]
    assert await ctx.judge() == ()  # judged once, never again


async def test_a_second_candidate_for_the_same_departure_joins_the_ride(ctx: Context) -> None:
    await ctx.arriving(message(message_id="a"), message(message_id="b", sent_at=EVENING + timedelta(hours=7)))

    first, second = [j.candidate.verdict for j in await ctx.judge(limit=2)]

    assert isinstance(first, Accepted)
    assert isinstance(second, Accepted)
    assert (first.ride_id, first.joined, second.ride_id, second.joined) == (
        first.ride_id,
        False,
        first.ride_id,
        True,
    )
    assert len(ctx.rides.created) == 1


async def test_a_price_per_stop_reaches_the_draft_and_prices_the_ride_from_the_cheapest() -> None:
    priced = (
        "*03 VAGAS as 05:45*\n🚘 Veredas\n🚘 Rodeador\n🚘 Rodoviária\n💸 7,00 Rodeador\n💸 9,00 Rodoviária"
    )
    read = OFFER_READ.model_copy(
        update={
            "price": "7.00",
            "fares": [
                StopFare(stop="Rodeador", price="7.00"),
                StopFare(stop="Rodoviária", price="9.00"),
                StopFare(stop="Ceilândia", price="12.00"),  # a place this ride never names
            ],
        }
    )
    ctx = Context((priced, read))
    await ctx.arriving(message(priced))

    (judged,) = await ctx.judge()

    assert isinstance(judged.candidate.verdict, Accepted)
    (*_, draft) = next(iter(ctx.rides.created.values()))
    assert [stop.fare for stop in draft.stops] == [None, Decimal("7.00"), Decimal("9.00")]
    assert draft.price == Decimal("7.00")


async def test_requests_and_chat_are_rejected_with_their_reason(ctx: Context) -> None:
    await ctx.arriving(
        message(ASK, message_id="a"), message(CHAT, message_id="b", sent_at=EVENING + timedelta(minutes=1))
    )

    verdicts = [j.candidate.verdict for j in await ctx.judge(limit=2)]

    assert all(isinstance(v, Rejected) and v.reason is RejectReason.NOT_AN_OFFER for v in verdicts)
    assert ctx.rides.created == {}


async def test_an_offer_the_words_do_not_back_is_refused_for_low_confidence() -> None:
    invented = OFFER_READ.model_copy(
        update={"time": "19:30", "seats": 5, "stops": ["Esplanada", "Ceilândia"]}
    )
    ctx = Context((OFFER, invented))
    await ctx.arriving(message())

    (judged,) = await ctx.judge()

    assert isinstance(judged.candidate.verdict, Rejected)
    assert judged.candidate.verdict.reason is RejectReason.LOW_CONFIDENCE
    assert judged.candidate.verdict.confidence is not None


async def test_a_failing_interpreter_leaves_the_candidate_for_the_next_sweep_up_to_the_ceiling() -> None:
    ctx = Context((OFFER, ConnectionError("ollama away")))
    await ctx.arriving(message())

    first = await ctx.judge()
    second = await ctx.judge()
    third = await ctx.judge()

    assert isinstance(first[0].candidate.verdict, Failed)
    assert isinstance(second[0].candidate.verdict, Failed)
    assert second[0].candidate.verdict.attempts == 2
    assert third == ()  # two attempts is the ceiling of these rules
    assert ctx.rides.created == {}


# --- purge and block ---------------------------------------------------------------------------


async def test_the_purge_forgets_the_ride_that_left_with_its_candidate_and_messages(ctx: Context) -> None:
    await ctx.arriving(
        message(message_id="a"), message(ASK, message_id="b", sent_at=EVENING + timedelta(minutes=1))
    )
    await ctx.judge(limit=2)
    ctx.clock.at = NEXT_MORNING + timedelta(minutes=5)

    still_open = await ctx.purge()
    ctx.clock.at = NEXT_MORNING + timedelta(minutes=11)
    departed = await ctx.purge()

    assert (still_open.rides, still_open.candidates, still_open.messages) == (0, 0, 0)
    assert (departed.rides, departed.candidates, departed.messages) == (1, 1, 0)
    assert ctx.rides.created == {}
    assert [c.text for c in ctx.candidates.rows.values()] == [ASK]  # judged 24h ago? not yet
    ctx.clock.at = EVENING + timedelta(hours=25)
    assert (await ctx.purge()).candidates == 1
    assert ctx.messages.rows == {}


async def test_blocking_a_sender_erases_everything_of_theirs_and_keeps_the_rest(ctx: Context) -> None:
    bia = Sender(phone=PhoneNumber.from_jid_user("5561999990001"), display_name="Bia")
    await ctx.arriving(message(message_id="a"), message(ASK, message_id="b", sender=bia))
    await ctx.judge(limit=2)

    report = await ctx.block(ZE.phone)

    assert (report.rides, report.candidates, report.messages) == (
        1,
        1,
        0,
    )  # the message went with its candidate
    assert [c.sender for c in ctx.candidates.rows.values()] == [bia]
    assert await ctx.blocked.is_blocked(ZE.phone)


# --- rejudge ---------------------------------------------------------------------------------------


async def test_a_rejudge_reads_the_day_again_and_leaves_an_accounts_ride_alone(ctx: Context) -> None:
    bia = Sender(phone=PhoneNumber.from_jid_user("5561999990001"), display_name="Bia")
    await ctx.arriving(message(message_id="a"), message(CHAT, message_id="b", sender=bia))
    first = await ctx.judge(limit=2)
    (ride_id,) = ctx.rides.created

    report = await ctx.reopen(EVENING - timedelta(hours=1))
    again = await ctx.judge(limit=2)

    assert (report.reopened, report.rides_released, report.kept) == (2, 1, 0)
    assert ride_id not in ctx.rides.created
    assert len(ctx.rides.created) == 1  # made again from the same messages
    assert sorted(j.candidate.verdict.kind for j in again) == sorted(j.candidate.verdict.kind for j in first)
    assert (await ctx.reopen(EVENING + timedelta(hours=1))).reopened == 0  # nothing judged since then

    (owned,) = ctx.rides.created
    ctx.rides.owned.add(owned)
    kept = await ctx.reopen(EVENING - timedelta(hours=1))
    assert (kept.reopened, kept.rides_released, kept.kept) == (1, 0, 1)
    assert owned in ctx.rides.created
