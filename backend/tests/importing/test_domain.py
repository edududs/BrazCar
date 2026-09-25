"""The rules of `importing` without any adapter: keys, candidates, checks, schedule and acceptance."""

from datetime import UTC, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from hypothesis import given
from hypothesis import strategies as st

from brazcar.importing.domain import (
    DEDUP_WINDOW,
    Accept,
    Candidate,
    Day,
    Failed,
    Offer,
    OfferFare,
    Other,
    Pending,
    Rejected,
    RejectReason,
    Request,
    ResolvedStop,
    Sender,
    SourceMessage,
    Update,
    attach_fares,
    check,
    decide,
    digit_tokens,
    resolve_departure,
    text_key,
)
from brazcar.shared.domain.phone import PhoneNumber

BRASILIA = ZoneInfo("America/Sao_Paulo")
TOLERANCE = timedelta(minutes=10)
EVENING = datetime(2026, 9, 22, 21, 15, tzinfo=BRASILIA)  # the evening post for the morning ride
OFFER_TEXT = "*03 VAGAS as 05:45*\n🚘 Veredas\n🚘 Rodeador\n🚘 Estrutural\n🚘 Rodoviária\n💵 7,00 Pix"
ZE = Sender(phone=PhoneNumber.from_jid_user("5561999990009"), display_name="Zé")


def message(
    text: str = OFFER_TEXT, *, sent_at: datetime = EVENING, sender: Sender = ZE, message_id: str = "m1"
) -> SourceMessage:
    return SourceMessage(
        account=PhoneNumber.from_jid_user("5561900000001"),
        message_id=message_id,
        chat_jid="120363000000000001@g.us",
        sender=sender,
        sent_at=sent_at,
        text=text,
        received_at=sent_at + timedelta(seconds=2),
    )


# --- text key --------------------------------------------------------------------------------------


def test_the_key_ignores_accents_case_emoji_and_punctuation() -> None:
    assert text_key("🚘 Rodoviária do Plano!  (Americanas)") == "rodoviaria do plano americanas"
    assert text_key("*03 VAGAS as 05:45*") == text_key("03 vagas às 05:45")
    assert digit_tokens("*03 VAGAS as 05:45* 7h30 17H, 06:20hrs") == {
        "03",
        "05",
        "45",
        "7",
        "30",
        "17",
        "06",
        "20",
    }


@given(st.text(max_size=80))
def test_the_key_is_idempotent_and_never_has_double_spaces(text: str) -> None:
    key = text_key(text)
    assert text_key(key) == key
    assert "  " not in key
    assert key == key.strip()


# --- candidate -------------------------------------------------------------------------------------


def test_a_repost_within_the_window_joins_the_candidate_and_counts_its_sources() -> None:
    candidate = Candidate.open(message(), group_label="Rota")
    repost = message(
        "03 vagas às 05:45 🚗 Veredas 🚗 Rodeador 🚗 Estrutural 🚗 Rodoviária 7,00 Pix",
        sent_at=EVENING + timedelta(minutes=3),
        message_id="m2",
    )

    assert candidate.accepts(repost)
    joined = candidate.absorb(repost)
    assert joined.sources == 2
    assert joined.last_seen_at == repost.sent_at
    assert joined.first_seen_at == EVENING


@pytest.mark.parametrize(
    ("other", "why"),
    [
        (message(sent_at=EVENING + DEDUP_WINDOW + timedelta(minutes=1)), "past the window"),
        (message(sent_at=EVENING - timedelta(minutes=1)), "before the first"),
        (
            message(sender=Sender(phone=PhoneNumber.from_jid_user("5561999990008"), display_name="Zé")),
            "another sender",
        ),
        (message("02 VAGAS as 05:45 Veredas Rodeador Estrutural Rodoviária 7,00 Pix"), "other words"),
    ],
)
def test_what_is_not_the_same_posting(other: SourceMessage, why: str) -> None:
    candidate = Candidate.open(message(), group_label="Rota")

    assert not candidate.accepts(other), why


def test_a_judged_candidate_accepts_nothing_more_and_a_failure_counts_attempts() -> None:
    candidate = Candidate.open(message(), group_label="Rota")

    rejected = candidate.judge(Rejected(reason=RejectReason.NOT_AN_OFFER), at=EVENING)
    failed = candidate.fail("ollama away", at=EVENING).fail("still away", at=EVENING)

    assert not rejected.accepts(message(message_id="m2"))
    assert isinstance(failed.verdict, Failed)
    assert failed.verdict.attempts == 2
    assert candidate.is_pending
    assert not failed.is_pending
    assert isinstance(candidate.verdict, Pending)
    with pytest.raises(ValueError, match="judged"):
        candidate.evolve(judged_at=EVENING)


# --- checks ----------------------------------------------------------------------------------------


def test_checks_confirm_each_value_in_the_words_and_forgive_what_was_not_said() -> None:
    offer = Offer(
        at=time(5, 45),
        stops=("Veredas", "Rodeador", "Estrutural", "Rodoviária"),
        seats=3,
        price=Decimal("7.00"),
        payment_methods=frozenset({"pix"}),
    )

    backed = check(offer, OFFER_TEXT, resolved=(True, True, True, True))
    invented = check(
        offer.evolve(at=time(19, 30), seats=4, stops=("Veredas", "Esplanada")),
        OFFER_TEXT,
        resolved=(True, False),
    )
    silent = check(Offer(stops=("Veredas", "Rodoviária")), OFFER_TEXT, resolved=(True, True))

    assert backed.confidence == 1.0
    assert backed.catalog_stops == 4
    assert invented.time_in_text is False
    assert invented.seats_in_text is False
    assert invented.stops_in_text == 0.5
    assert invented.confidence == pytest.approx(0.15 + 0.175)
    assert silent.confidence == 1.0


# --- schedule --------------------------------------------------------------------------------------


def test_the_evening_post_for_the_morning_means_tomorrow_and_a_time_still_ahead_means_today() -> None:
    morning = resolve_departure(
        sent_at=EVENING, day=Day.UNKNOWN, at=time(5, 45), zone=BRASILIA, tolerance=TOLERANCE
    )
    later_tonight = resolve_departure(
        sent_at=EVENING, day=Day.UNKNOWN, at=time(22, 0), zone=BRASILIA, tolerance=TOLERANCE
    )
    just_passed = resolve_departure(
        sent_at=EVENING, day=Day.UNKNOWN, at=time(21, 10), zone=BRASILIA, tolerance=TOLERANCE
    )

    assert morning == datetime(2026, 9, 23, 5, 45, tzinfo=BRASILIA)
    assert later_tonight == datetime(2026, 9, 22, 22, 0, tzinfo=BRASILIA)
    assert just_passed == datetime(2026, 9, 22, 21, 10, tzinfo=BRASILIA)  # within the tolerance: today


def test_said_days_win_and_no_time_means_no_departure() -> None:
    assert resolve_departure(
        sent_at=EVENING, day=Day.TODAY, at=time(5, 45), zone=BRASILIA, tolerance=TOLERANCE
    ) == datetime(2026, 9, 22, 5, 45, tzinfo=BRASILIA)
    assert resolve_departure(
        sent_at=EVENING, day=Day.TOMORROW, at=time(22, 0), zone=BRASILIA, tolerance=TOLERANCE
    ) == datetime(2026, 9, 23, 22, 0, tzinfo=BRASILIA)
    assert (
        resolve_departure(sent_at=EVENING, day=Day.UNKNOWN, at=None, zone=BRASILIA, tolerance=TOLERANCE)
        is None
    )


@given(
    sent_at=st.datetimes(
        min_value=datetime(2026, 1, 1, tzinfo=UTC).replace(tzinfo=None),
        max_value=datetime(2026, 12, 31, tzinfo=UTC).replace(tzinfo=None),
        timezones=st.just(UTC),
    ),
    at=st.times(),
    day=st.sampled_from(Day),
)
def test_a_resolved_departure_is_in_the_board_zone_and_never_far_in_the_past(
    sent_at: datetime, at: time, day: Day
) -> None:
    departure = resolve_departure(sent_at=sent_at, day=day, at=at, zone=BRASILIA, tolerance=TOLERANCE)

    assert departure is not None
    assert departure.tzinfo is BRASILIA
    assert departure.time() == at
    if day is Day.UNKNOWN:
        assert departure + TOLERANCE >= sent_at
        assert departure - sent_at < timedelta(days=1) + TOLERANCE


# --- acceptance ------------------------------------------------------------------------------------

STOPS = (
    ResolvedStop(text="Veredas", place_id="veredas"),
    ResolvedStop(text="Rodoviária", place_id="rodoviaria-do-plano"),
)
DEPARTURE = datetime(2026, 9, 23, 5, 45, tzinfo=BRASILIA)
FULL = Offer(
    at=time(5, 45),
    stops=("Veredas", "Rodoviária"),
    seats=3,
    price=Decimal("8.00"),
    payment_methods=frozenset({"pix"}),
)
SURE = check(FULL, OFFER_TEXT.replace("7,00", "8,00"), resolved=(True, True))


def test_an_offer_with_time_and_two_stops_above_the_threshold_becomes_a_draft_with_defaults_filled() -> None:
    bare = Offer(at=time(5, 45), stops=("Veredas", "Rodoviária"))

    full = decide(FULL, departure_at=DEPARTURE, stops=STOPS, checks=SURE, threshold=0.7)
    filled = decide(
        bare,
        departure_at=DEPARTURE,
        stops=STOPS,
        checks=check(bare, OFFER_TEXT, resolved=(True, True)),
        threshold=0.7,
    )

    assert isinstance(full, Accept)
    assert (full.draft.seats, full.draft.price, full.draft.payment_methods) == (
        3,
        Decimal("8.00"),
        frozenset({"pix"}),
    )
    assert isinstance(filled, Accept)
    assert (filled.draft.seats, filled.draft.price, filled.draft.payment_methods) == (
        2,
        Decimal("7.00"),
        frozenset({"cash", "pix"}),
    )


def test_an_offer_with_more_seats_than_a_ride_allows_is_clamped() -> None:
    """A passenger car has no fifth seat (D-142); the message may still say more."""
    six_seats = FULL.evolve(seats=6)

    decision = decide(six_seats, departure_at=DEPARTURE, stops=STOPS, checks=SURE, threshold=0.7)

    assert isinstance(decision, Accept)
    assert decision.draft.seats == 4


@pytest.mark.parametrize(
    ("judgement", "departure", "stops", "checks", "reason"),
    [
        (Request(), None, (), None, RejectReason.NOT_AN_OFFER),
        (Update(closed=True), None, (), None, RejectReason.NOT_AN_OFFER),
        (Other(), None, (), None, RejectReason.NOT_AN_OFFER),
        (FULL.evolve(at=None), None, STOPS, SURE, RejectReason.NO_TIME),
        (FULL.evolve(seats=0), DEPARTURE, STOPS, SURE, RejectReason.NO_SEATS),
        (FULL, DEPARTURE, STOPS[:1], SURE, RejectReason.FEW_STOPS),
        (
            FULL,
            DEPARTURE,
            STOPS,
            SURE.evolve(time_in_text=False, stops_in_text=0.0),
            RejectReason.LOW_CONFIDENCE,
        ),
    ],
)
def test_what_is_refused_and_why(
    judgement: Offer | Request | Update | Other,
    departure: datetime | None,
    stops: tuple[ResolvedStop, ...],
    checks: object,
    reason: RejectReason,
) -> None:
    decision = decide(judgement, departure_at=departure, stops=stops, checks=checks, threshold=0.7)  # type: ignore[arg-type]

    assert isinstance(decision, Rejected)
    assert decision.reason is reason


# --- fares (D-131) ----------------------------------------------------------------------------------

AIRPORT_TEXT = (
    "🔹AEROPORTO🔁BRAZLÂNDIA\nSaída: 18h00\n"
    "Octogonal→Anvisa\nEstrutural→Rodeador\nVila→Veredas\n"
    "💰 Valores:\nR$ 9,00 → Aeroporto\nR$ 8,00 → Anvisa\nR$ 7,00 → Estrutural\n"
)
AIRPORT_STOPS = (
    ResolvedStop(text="Teca Aeroporto"),
    ResolvedStop(text="Octogonal"),
    ResolvedStop(text="Anvisa", place_id="anvisa"),
    ResolvedStop(text="Estrutural", place_id="estrutural"),
    ResolvedStop(text="Rodeador", place_id="rodeador"),
)


def test_each_fare_lands_on_the_one_stop_its_words_name() -> None:
    fares = (
        OfferFare(stop="Aeroporto", price=Decimal("9.00")),
        OfferFare(stop="Anvisa", price=Decimal("8.00")),
        OfferFare(stop="Estrutural", price=Decimal("7.00")),
    )

    attached = attach_fares(AIRPORT_STOPS, fares, AIRPORT_TEXT)

    assert [stop.fare for stop in attached] == [
        None,  # "Aeroporto" only names the first stop, and that is where the ride leaves from
        None,
        Decimal("8.00"),
        Decimal("7.00"),
        None,
    ]


@pytest.mark.parametrize(
    ("fare", "why"),
    [
        (OfferFare(stop="Ceilândia", price=Decimal("9.00")), "no stop with those words"),
        (OfferFare(stop="Lago Sul", price=Decimal("9.00")), "two stops with those words"),
        (OfferFare(stop="Rodeador", price=Decimal("12.00")), "a value the message never wrote"),
        (OfferFare(stop="Veredas", price=Decimal("9.00")), "the stop the ride leaves from"),
    ],
)
def test_a_fare_that_cannot_be_tied_to_one_stop_is_dropped(fare: OfferFare, why: str) -> None:
    text = "2 vagas 5:20 Veredas Rodeador Pontão do lago sul Ql 06 lago sul\nAté o lago sul 9,00"
    stops = (
        ResolvedStop(text="Veredas"),
        ResolvedStop(text="Rodeador"),
        ResolvedStop(text="Pontão do lago sul"),
        ResolvedStop(text="Ql 06 lago sul"),
    )

    attached = attach_fares(stops, (fare,), text)

    assert [stop.fare for stop in attached] == [None, None, None, None], why


def test_the_draft_of_a_fared_offer_costs_the_cheapest_fare() -> None:
    offer = FULL.evolve(fares=(OfferFare(stop="Rodoviária", price=Decimal("9.00")),))
    stops = (STOPS[0], STOPS[1].evolve(fare=Decimal("9.00")))

    decision = decide(offer, departure_at=DEPARTURE, stops=stops, checks=SURE, threshold=0.7)

    assert isinstance(decision, Accept)
    assert decision.draft.price == Decimal("9.00")  # not the 8.00 the message named for the trip
    assert [stop.fare for stop in decision.draft.stops] == [None, Decimal("9.00")]


def test_fares_do_not_move_the_confidence() -> None:
    """Confidence weighs time, stops, seats and price, and D-131 did not change the weights."""
    with_fares = FULL.evolve(fares=(OfferFare(stop="Rodoviária", price=Decimal("9.00")),))

    assert check(with_fares, OFFER_TEXT, resolved=(True, True)) == check(
        FULL, OFFER_TEXT, resolved=(True, True)
    )


# --- parser output ---------------------------------------------------------------------------------


def test_what_the_model_writes_badly_becomes_not_said_never_an_error() -> None:
    from brazcar.importing.application import (  # noqa: PLC0415 - the boundary under test
        ParserOutput,
        to_judgement,
    )

    read = to_judgement(
        ParserOutput(
            kind="offer", time="7:5", seats=26, price="sete", stops=[" Vila ", "vila", "", "Rodeador"]
        )
    )

    assert isinstance(read, Offer)
    assert read.at == time(7, 5)
    assert read.seats is None
    assert read.price is None
    assert read.stops == ("Vila", "Rodeador")
    assert to_judgement(ParserOutput(kind="offer", time="25:00")).at is None  # type: ignore[union-attr]


def test_a_price_list_the_model_cannot_spell_is_dropped_line_by_line() -> None:
    from brazcar.importing.application import (  # noqa: PLC0415 - the boundary under test
        ParserOutput,
        StopFare,
        to_judgement,
    )

    read = to_judgement(
        ParserOutput(
            kind="offer",
            time="18:00",
            stops=["Aeroporto", "Estrutural"],
            fares=[
                StopFare(stop=" Aeroporto ", price="9,00"),
                StopFare(stop="Estrutural", price="de graça"),
                StopFare(stop="", price="7.00"),
            ],
        )
    )

    assert isinstance(read, Offer)
    assert read.fares == (OfferFare(stop="Aeroporto", price=Decimal("9.00")),)
    assert to_judgement(ParserOutput(kind="offer", time="18:00")).fares == ()  # type: ignore[union-attr]


def test_a_long_route_keeps_where_it_leaves_from_and_where_it_goes() -> None:
    """The Brazlândia to Aeroporto offer of 24/09 lost the airport when the cut took the tail."""
    from brazcar.importing.application import (  # noqa: PLC0415 - the boundary under test
        ParserOutput,
        to_judgement,
    )
    from brazcar.importing.application.parser_output import MAX_STOPS  # noqa: PLC0415 - same

    airport = [
        "Veredas",
        "Vila",
        "Rodeador",
        "Estrutural",
        "Anvisa",
        "Octogonal",
        "Setor Policial",
        "Bombeiros",
        "Teca Aeroporto",
        "Log Brasília",
    ]
    too_long = [f"Parada {n}" for n in range(MAX_STOPS + 5)]

    kept = to_judgement(ParserOutput(kind="offer", time="06:15", stops=airport))
    cut = to_judgement(ParserOutput(kind="offer", time="06:15", stops=too_long))

    assert isinstance(kept, Offer)
    assert kept.stops == tuple(airport)
    assert isinstance(cut, Offer)
    assert len(cut.stops) == MAX_STOPS
    assert cut.stops[0] == "Parada 0"
    assert cut.stops[-1] == too_long[-1]
