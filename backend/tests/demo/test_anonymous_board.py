"""The anonymous view over the demonstration (D-171): without a session, the board and every detail
say nothing about a person of the seed, and `q` finds nobody by name.

Seeding is not cheap, so each test checks its promises on one run.
"""

import re
from collections.abc import Iterator
from http import HTTPStatus
from io import StringIO
from pathlib import Path
from typing import cast

import pytest
from asgiref.sync import sync_to_async
from django.core.management import call_command

from brazcar.demo.adapters import dataset as data
from brazcar.demo.adapters.seeding import DemoManifest
from brazcar.shared.domain.phone import PhoneNumber
from tests.rides.test_routes import FRONT, Browser, body

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.usefixtures("worker_thread_connections_closed"),
]

WINDOW = 4  # words: a longer run of a message or a note is its own words, never a stop's name
KEPT = (
    "id",
    "origin",
    "stops",
    "departure_at",
    "seats_available",
    "price",
    "has_fares",
    "payment_methods",
    "status",
)
NO_ACTIONS = {
    "can_edit": False,
    "can_change_seats": False,
    "can_cancel": False,
    "can_repeat": False,
    "can_contact": False,
    "delay_until": None,
}


@pytest.fixture(autouse=True)
def _front_origin(settings: object) -> None:
    setattr(settings, "CORS_ALLOWED_ORIGINS", [FRONT])  # noqa: B010 - pytest-django's settings proxy


async def _seed(manifest: Path) -> DemoManifest:
    # The command opens a loop of its own, so it may not share this one's single thread executor.
    await sync_to_async(call_command, thread_sensitive=False)("sync_places", stdout=StringIO())
    await sync_to_async(call_command, thread_sensitive=False)(
        "seed_demo", "--yes-i-know", "--manifest", str(manifest), stdout=StringIO()
    )
    text = await sync_to_async(manifest.read_text, thread_sensitive=False)(encoding="utf-8")
    return DemoManifest.model_validate_json(text)


async def _signed_in(seeded: DemoManifest, slug: str) -> Browser:
    account = seeded.account(slug)
    client = Browser()
    answer = await client.post("/api/accounts/login", {"phone": account.phone, "password": account.password})
    assert answer.status_code == HTTPStatus.OK, answer.content
    return client


def _strings(value: object) -> Iterator[str]:
    """Every string of a JSON document, at any depth."""
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in cast("dict[str, object]", value).values():
            yield from _strings(item)
    elif isinstance(value, list):
        for item in cast("list[object]", value):
            yield from _strings(item)


def _phone_forms(phone: PhoneNumber) -> set[str]:
    """E.164, digits only and the screen's own format."""
    return {phone.e164(), phone.e164().removeprefix("+"), phone.display()}


def _windows(text: str) -> set[str]:
    words = text.split()
    return {" ".join(words[start : start + WINDOW]) for start in range(max(1, len(words) - WINDOW + 1))}


def _personal_pieces() -> set[str]:
    """What must never reach a viewer without a session, as substrings."""
    cars = [car for person in data.PEOPLE for car in person.cars]
    phones = [PhoneNumber.parse(person.phone) for person in data.PEOPLE]
    phones += [PhoneNumber.from_jid_user(sender.phone) for sender in data.SENDERS]
    texts = [
        value for name, value in vars(data).items() if name.startswith("MESSAGE_") and isinstance(value, str)
    ]
    texts += [data.SHORT_NOTES, data.LONG_NOTES, *data.GROUPS.values()]
    return (
        {person.display_name for person in data.PEOPLE}
        | {sender.display_name for sender in data.SENDERS}
        | {person.email for person in data.PEOPLE if person.email is not None}
        | {car.plate for car in cars}
        | {f"{car.model} {car.color}" for car in cars}
        | {form for phone in phones for form in _phone_forms(phone)}
        | {window for text in texts for window in _windows(text)}
    )


def _car_models() -> set[str]:
    """Whole words only: a model's name inside a longer word is not the car."""
    return {car.model for person in data.PEOPLE for car in person.cars}


async def test_nothing_of_a_person_of_the_seed_reaches_a_viewer_without_a_session(tmp_path: Path) -> None:
    seeded = await _seed(tmp_path / "manifest.json")
    anonymous = Browser()

    board = await anonymous.get("/api/rides")
    details = [await anonymous.get(f"/api/rides/{ride.id}") for ride in seeded.rides]
    strings = [text for page in (board, *details) for text in _strings(body(page))]
    pieces = _personal_pieces()
    models = [re.compile(rf"\b{re.escape(model)}\b") for model in _car_models()]

    leaks = [(text, piece) for text in strings for piece in pieces if piece in text]
    leaks += [(text, model.pattern) for text in strings for model in models if model.search(text)]

    assert board.status_code == HTTPStatus.OK
    assert len(body(board)) == len([ride for ride in seeded.rides if ride.on_board])
    assert [page.status_code for page in details] == [HTTPStatus.OK] * len(seeded.rides)
    assert leaks == []


async def test_a_session_still_sees_the_driver_and_the_search_never_reads_a_name(tmp_path: Path) -> None:
    seeded = await _seed(tmp_path / "manifest.json")
    passenger = await _signed_in(seeded, data.PASSENGER.slug)
    anonymous = Browser()
    published = str(seeded.ride("open_today_notes").id)
    imported = str(seeded.ride("imported_external").id)

    signed_board = {card["id"]: card for card in body(await passenger.get("/api/rides"))}
    open_board = {card["id"]: card for card in body(await anonymous.get("/api/rides"))}
    for ride_id in (published, imported):
        signed_detail = body(await passenger.get(f"/api/rides/{ride_id}"))
        open_detail = body(await anonymous.get(f"/api/rides/{ride_id}"))
        for signed, bare in ((signed_board[ride_id], open_board[ride_id]), (signed_detail, open_detail)):
            assert signed["actions"]["can_contact"] is True
            assert {key: bare[key] for key in KEPT} == {key: signed[key] for key in KEPT}
            assert bare["driver_name"] is None
            assert bare["car"] is None
            assert bare["origin_message"] is None
            assert bare["notes"] is None
            assert bare["actions"] == NO_ACTIONS
            assert bare["is_mine"] is False

    assert signed_board[published]["driver_name"] == data.DRIVER_ONE_CAR.display_name
    assert signed_board[published]["car"] == {"model": "Gol", "color": "prata"}
    assert signed_board[published]["notes"] == data.SHORT_NOTES
    assert signed_board[imported]["driver_name"] == data.SENDER_EXTERNAL.display_name
    assert signed_board[imported]["origin_message"]["group_label"] == data.GROUP_LABEL
    assert open_board[imported]["origin"] == "whatsapp"

    # `q` reads the stops only (D-101): a full name finds nothing, with or without a session, and a
    # first name finds whatever its letters find in a stop's name, the same for both (D-171).
    drivers = [person.display_name for person in data.PEOPLE] + [
        sender.display_name for sender in data.SENDERS
    ]
    for name in drivers:
        for query in (name, name.split()[0]):
            signed = [card["id"] for card in body(await passenger.get("/api/rides", {"q": query}))]
            bare = [card["id"] for card in body(await anonymous.get("/api/rides", {"q": query}))]
            assert bare == signed, query
            if query == name and " " in name:
                assert bare == [], query
    assert body(await anonymous.get("/api/rides", {"q": "Esplanada"}))
