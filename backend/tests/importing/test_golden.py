"""The golden set (D-120): real messages, anonymised, with the reading they must get.

Heavy, and only with an Ollama at hand: `OLLAMA_BASE_URL` (and `RIDE_PARSER_MODEL`) name it, as in
production. It measures the interpreter, not the rules around it: `kind` first, then each field of
an offer, and how long each answer takes. The floors are what a model must reach to be the one the
worker runs (ADR-0016); `poe test-golden` prints the whole table.
"""

import json
import os
import re
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import pytest

from brazcar.importing.adapters.ollama import OllamaRideParser, ParserAnswerError
from brazcar.importing.application import ParserOutput

GOLDEN = Path(__file__).with_name("golden") / "messages.jsonl"
KIND_FLOOR = 0.90  # share of messages whose kind is right
OFFER_FLOOR = 0.80  # share of offer fields (time, day, seats, price, stops) read right
pytestmark = pytest.mark.heavy


@dataclass
class Case:
    seq: int
    sent_at: datetime
    text: str
    expected: ParserOutput
    note: str


@dataclass
class Score:
    kinds: int = 0
    fields: int = 0
    field_total: int = 0
    seconds: list[float] = field(default_factory=list[float])
    misses: list[str] = field(default_factory=list[str])


def load_cases() -> list[Case]:
    cases: list[Case] = []
    for line in GOLDEN.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        raw = json.loads(line)
        cases.append(
            Case(
                seq=int(raw["seq"]),
                sent_at=datetime.fromisoformat(raw["sent_at"]),
                text=str(raw["text"]),
                expected=ParserOutput.model_validate(raw["expected"]),
                note=str(raw.get("note", "")),
            )
        )
    return cases


def compare(case: Case, got: ParserOutput, score: Score) -> None:
    wanted = case.expected
    if got.kind == wanted.kind:
        score.kinds += 1
    else:
        score.misses.append(f"#{case.seq} kind: wanted {wanted.kind}, got {got.kind}")
    if wanted.kind != "offer":
        return
    checks = {
        "time": got.time == wanted.time,
        "day": got.day == wanted.day,
        "seats": got.seats == wanted.seats,
        "price": _price(got.price) == _price(wanted.price),
        "stops": _stops(got.stops) == _stops(wanted.stops),
    }
    score.field_total += len(checks)
    score.fields += sum(checks.values())
    for name, ok in checks.items():
        if not ok:
            score.misses.append(
                f"#{case.seq} {name}: wanted {getattr(wanted, name)!r}, got {getattr(got, name)!r}"
            )


def _price(value: str | None) -> str | None:
    return None if value is None else f"{float(value.replace(',', '.')):.2f}"


def _fold(text: str) -> str:
    """Substance, not punctuation: no parenthetical detail, "A/B" and "A ou B" as two, folded."""
    return " ".join(re.sub(r"\([^)]*\)", " ", text).casefold().split())


def _stops(stops: list[str]) -> list[str]:
    return [
        folded
        for stop in stops
        for part in re.split(r"\s*/\s*|\s+ou\s+", stop)
        if (folded := _fold(part)) and not folded.isdigit()
    ]


@pytest.mark.skipif("OLLAMA_BASE_URL" not in os.environ, reason="set OLLAMA_BASE_URL to measure a model")
@pytest.mark.skipif(not GOLDEN.exists(), reason="no golden set yet")
async def test_the_model_reads_the_golden_set_well_enough() -> None:
    parser = OllamaRideParser(
        base_url=os.environ["OLLAMA_BASE_URL"], model=os.environ.get("RIDE_PARSER_MODEL", "qwen3.5:4b")
    )
    cases = load_cases()
    score = Score()
    try:
        for case in cases:
            started = time.perf_counter()
            try:
                got = await parser.parse(case.text, sent_at=case.sent_at, group_label="Rota")
            except ParserAnswerError as error:  # an answer outside the schema counts as a wrong kind
                score.misses.append(f"#{case.seq} answer: {error}")
                continue
            finally:
                score.seconds.append(time.perf_counter() - started)
            compare(case, got, score)
    finally:
        await parser.aclose()

    kind_share = score.kinds / len(cases)
    field_share = score.fields / score.field_total if score.field_total else 1.0
    seconds = sorted(score.seconds)
    print(  # noqa: T201 - the table is the point of this test
        f"\nmodel {os.environ.get('RIDE_PARSER_MODEL', 'qwen3.5:4b')}: {len(cases)} messages, "
        f"kind {kind_share:.0%}, offer fields {field_share:.0%}, "
        f"latency median {seconds[len(seconds) // 2]:.1f}s max {seconds[-1]:.1f}s"
    )
    for miss in score.misses:
        print(miss)  # noqa: T201
    assert kind_share >= KIND_FLOOR
    assert field_share >= OFFER_FLOOR
