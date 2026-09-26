"""The routes against the real composition: ninja, session, use cases, ORM, catalog, revision."""

import json
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta
from http import HTTPStatus
from typing import Any, cast
from zoneinfo import ZoneInfo

import pytest
from django.http import HttpResponse, StreamingHttpResponse
from django.test.client import AsyncClient
from django.utils import timezone

from brazcar.places.adapters.repository import DjangoCatalogRepository
from brazcar.places.domain import Catalog, Place
from tests.accounts.signup import registration

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.usefixtures("worker_thread_connections_closed", "stored_catalog"),
]

FRONT = "http://localhost:5173"
BRASILIA = ZoneInfo("America/Sao_Paulo")
ANA = {"phone": "61 99999-0001", "email": "ana@example.com", "display_name": "Ana"}
BIA = {"phone": "61 99999-0002", "email": "bia@example.com", "display_name": "Bia"}
GOL = {"model": "Gol", "color": "prata", "plate": "ABC1234"}


class Browser:
    """A client that behaves like the front: sends its origin on every request, keeps cookies."""

    def __init__(self) -> None:
        self.client = AsyncClient()

    async def get(self, path: str, query: dict[str, str] | None = None) -> HttpResponse:
        return await self.client.get(path, query, headers={"Origin": FRONT})

    async def post(self, path: str, data: object = None) -> HttpResponse:
        return await self.client.post(path, data, content_type="application/json", headers={"Origin": FRONT})

    async def patch(self, path: str, data: object) -> HttpResponse:
        return await self.client.patch(path, data, content_type="application/json", headers={"Origin": FRONT})


def body(response: HttpResponse) -> Any:  # noqa: ANN401 - the tests assert the shape
    return json.loads(response.content)


def tomorrow(hour: int = 7) -> str:
    local = timezone.now().astimezone(BRASILIA) + timedelta(days=1)
    return local.replace(hour=hour, minute=0, second=0, microsecond=0).isoformat()


def ride_payload(**overrides: object) -> dict[str, object]:
    return {
        "car_id": "",
        "stops": [{"place_id": "brazlandia"}, {"text": "Incra 8"}, {"place_id": "esplanada"}],
        "departure_at": tomorrow(),
        "seats_available": 3,
        "price": "7.00",
        "payment_methods": ["pix", "cash"],
        **overrides,
    }


@pytest.fixture
async def stored_catalog() -> None:
    places = (
        Place(id="brazlandia", name="Brazlândia", aliases=("Braz",)),
        Place(id="plano-piloto", name="Plano Piloto"),
        Place(id="esplanada", name="Esplanada", parent_id="plano-piloto"),
    )
    await DjangoCatalogRepository().save(Catalog(places=places))


@pytest.fixture(autouse=True)
def _front_origin(settings: object) -> None:
    setattr(settings, "CORS_ALLOWED_ORIGINS", [FRONT])  # noqa: B010 - pytest-django's settings proxy


async def driver() -> tuple[Browser, str]:
    """Ana, signed in, with a car: the identifier of the car comes back."""
    client = Browser()
    signed_up = await client.post("/api/accounts/register", await registration(**ANA))
    assert signed_up.status_code == HTTPStatus.CREATED
    with_car = await client.post("/api/accounts/cars", GOL)
    return client, body(with_car)["cars"][0]["id"]


async def passenger() -> Browser:
    client = Browser()
    signed_up = await client.post("/api/accounts/register", await registration(**BIA))
    assert signed_up.status_code == HTTPStatus.CREATED
    return client


async def publish(client: Browser, car_id: str, **overrides: object) -> dict[str, Any]:
    response = await client.post("/api/rides", ride_payload(car_id=car_id, **overrides))
    assert response.status_code == HTTPStatus.CREATED, response.content
    return body(response)


async def test_publishing_needs_a_session_a_car_and_known_places() -> None:
    anonymous = await Browser().post("/api/rides", ride_payload())
    bia = await passenger()
    without_car = await bia.post("/api/rides", ride_payload(car_id="00000000-0000-0000-0000-000000000000"))
    ana, car_id = await driver()
    nowhere = await ana.post(
        "/api/rides", ride_payload(car_id=car_id, stops=[{"place_id": "x"}, {"text": "y"}])
    )
    both = await ana.post(
        "/api/rides",
        ride_payload(car_id=car_id, stops=[{"place_id": "brazlandia", "text": "y"}, {"text": "y"}]),
    )

    assert anonymous.status_code == HTTPStatus.UNAUTHORIZED
    assert without_car.status_code == HTTPStatus.UNPROCESSABLE_CONTENT
    assert nowhere.status_code == HTTPStatus.UNPROCESSABLE_CONTENT
    assert both.status_code == HTTPStatus.UNPROCESSABLE_CONTENT


async def test_more_than_four_seats_is_refused_on_publishing_and_on_changing_seats() -> None:
    ana, car_id = await driver()
    ride = await publish(ana, car_id)

    over_publish = await ana.post("/api/rides", ride_payload(car_id=car_id, seats_available=5))
    over_change = await ana.post(f"/api/rides/{ride['id']}/seats", {"seats_available": 5})

    assert over_publish.status_code == HTTPStatus.UNPROCESSABLE_CONTENT
    assert over_change.status_code == HTTPStatus.UNPROCESSABLE_CONTENT


async def test_the_card_shows_the_driver_and_the_car_but_never_the_phone_or_the_plate() -> None:
    ana, car_id = await driver()

    card = await publish(ana, car_id)
    listed = await Browser().get("/api/rides")
    revision = await Browser().get("/api/rides/revision")

    assert card["driver_name"] == "Ana"
    assert card["car"] == {"model": "Gol", "color": "prata"}
    assert card["origin"] == "published"
    assert card["origin_message"] is None
    assert [stop["label"] for stop in card["stops"]] == ["Brazlândia", "Incra 8", "Esplanada"]
    assert card["status"] == "open"
    assert card["is_mine"] is True
    assert card["actions"]["can_edit"] is True
    assert "ABC1234" not in listed.content.decode()
    assert "+55" not in listed.content.decode()
    assert body(listed)[0]["actions"] == {
        "can_edit": False,
        "can_change_seats": False,
        "can_cancel": False,
        "can_repeat": False,
        "can_contact": False,
        "delay_until": None,
    }
    assert body(revision)["revision"] >= 1


async def test_notes_go_out_with_the_ride_are_edited_and_erased_and_never_reach_the_search() -> None:
    ana, car_id = await driver()

    published = await publish(ana, car_id, notes="  Levo mala pequena.  ")
    rewritten = await ana.patch(f"/api/rides/{published['id']}", {"notes": "Sem mala hoje"})
    erased = await ana.patch(f"/api/rides/{published['id']}", {"notes": ""})
    by_notes = body(await Browser().get("/api/rides", {"q": "mala"}))

    assert published["notes"] == "Levo mala pequena."
    assert body(rewritten)["notes"] == "Sem mala hoje"
    assert body(erased)["notes"] is None
    assert by_notes == []  # "passa por" reads the stops, never the notes (D-129)


@pytest.mark.parametrize("notes", ["Chama no 61 99999-0001", "ana@exemplo.com", "meu carro é o ABC1D23"])
async def test_notes_with_a_phone_an_email_or_a_plate_are_refused(notes: str) -> None:
    ana, car_id = await driver()

    refused = await ana.post("/api/rides", ride_payload(car_id=car_id, notes=notes))

    assert refused.status_code == HTTPStatus.UNPROCESSABLE_CONTENT
    assert "botão de contato" in body(refused)["detail"]


async def test_a_fare_per_stop_prices_the_ride_from_the_cheapest_one() -> None:
    ana, car_id = await driver()
    fared = [
        {"place_id": "brazlandia"},
        {"text": "Incra 8", "fare": "9.00"},
        {"place_id": "esplanada", "fare": "7.00"},
    ]

    published = await publish(ana, car_id, stops=fared, price="20.00")
    on_origin = await ana.post(
        "/api/rides",
        ride_payload(car_id=car_id, stops=[{"place_id": "brazlandia", "fare": "7.00"}, {"text": "y"}]),
    )
    under_eight = body(await Browser().get("/api/rides", {"max_price": "8"}))

    assert published["price"] == "7.00"  # the typed 20.00 is ignored (D-131)
    assert published["has_fares"] is True
    assert [stop["fare"] for stop in published["stops"]] == [None, "9.00", "7.00"]
    assert on_origin.status_code == HTTPStatus.UNPROCESSABLE_CONTENT
    assert "primeira parada" in body(on_origin)["detail"]
    assert [r["id"] for r in under_eight] == [published["id"]]


async def test_a_ride_without_fares_keeps_the_typed_price() -> None:
    ana, car_id = await driver()

    published = await publish(ana, car_id, price="9.50")

    assert published["price"] == "9.50"
    assert published["has_fares"] is False
    assert [stop["fare"] for stop in published["stops"]] == [None, None, None]
    assert published["notes"] is None


async def test_repeating_carries_the_notes_and_the_fares() -> None:
    ana, car_id = await driver()
    fared = [{"place_id": "brazlandia"}, {"place_id": "esplanada", "fare": "9.00"}]
    ride = await publish(ana, car_id, stops=fared, notes="Levo mala")

    repeated = await ana.post(f"/api/rides/{ride['id']}/repeat", {"departure_at": tomorrow(9)})

    assert repeated.status_code == HTTPStatus.CREATED
    assert body(repeated)["notes"] == "Levo mala"
    assert body(repeated)["price"] == "9.00"
    assert [stop["fare"] for stop in body(repeated)["stops"]] == [None, "9.00"]


async def test_the_board_filters_by_text_of_any_stop_day_seats_and_price() -> None:
    ana, car_id = await driver()
    cheap = await publish(ana, car_id)
    pricey = await publish(ana, car_id, price="12.50", departure_at=tomorrow(18), seats_available=1)
    await ana.post(f"/api/rides/{pricey['id']}/seats", {"seats_available": 0})
    board = Browser()

    plano = body(await board.get("/api/rides", {"q": "Plano Piloto"}))
    other_stop = body(await board.get("/api/rides", {"q": "incra"}))
    unknown = body(await board.get("/api/rides", {"q": "nowhere"}))
    with_seats = body(await board.get("/api/rides", {"with_seats": "true"}))
    today = body(
        await board.get("/api/rides", {"day": timezone.now().astimezone(BRASILIA).date().isoformat()})
    )
    tomorrow_only = body(await board.get("/api/rides", {"day": tomorrow()[:10]}))
    under_ten = body(await board.get("/api/rides", {"max_price": "10"}))

    assert [r["id"] for r in plano] == [cheap["id"], pricey["id"]]  # earliest first
    assert [r["id"] for r in other_stop] == [cheap["id"], pricey["id"]]
    assert unknown == []
    assert [r["id"] for r in with_seats] == [cheap["id"]]
    assert today == []
    assert [r["id"] for r in tomorrow_only] == [cheap["id"], pricey["id"]]
    assert [r["id"] for r in under_ten] == [cheap["id"]]


async def test_from_time_keeps_rides_at_or_after_that_local_hour() -> None:
    ana, car_id = await driver()
    seventeen_fifty_nine = (
        (timezone.now().astimezone(BRASILIA) + timedelta(days=1))
        .replace(hour=17, minute=59, second=0, microsecond=0)
        .isoformat()
    )
    early = await publish(ana, car_id, departure_at=seventeen_fifty_nine)
    late = await publish(ana, car_id, departure_at=tomorrow(18))
    board = Browser()

    from_18 = body(await board.get("/api/rides", {"from": "18:00"}))
    malformed = await board.get("/api/rides", {"from": "not-a-time"})

    assert [r["id"] for r in from_18] == [late["id"]]
    assert early["id"] not in [r["id"] for r in from_18]
    assert malformed.status_code == HTTPStatus.UNPROCESSABLE_CONTENT


async def test_seats_close_and_reopen_cancel_is_final_and_repeat_makes_a_new_ride() -> None:
    ana, car_id = await driver()
    ride = await publish(ana, car_id)
    before = body(await ana.get("/api/rides/revision"))["revision"]

    full = await ana.post(f"/api/rides/{ride['id']}/seats", {"seats_available": 0})
    reopened = await ana.post(f"/api/rides/{ride['id']}/seats", {"seats_available": 2})
    edited = await ana.patch(f"/api/rides/{ride['id']}", {"price": "8.00"})
    same_day = await ana.patch(f"/api/rides/{ride['id']}", {"departure_at": tomorrow(8)})
    cancelled = await ana.post(f"/api/rides/{ride['id']}/cancel")
    after_cancel = await ana.patch(f"/api/rides/{ride['id']}", {"price": "9.00"})
    repeated = await ana.post(f"/api/rides/{ride['id']}/repeat", {"departure_at": tomorrow(9)})
    mine = body(await ana.get("/api/rides/mine"))
    revision = body(await ana.get("/api/rides/revision"))["revision"]

    assert body(full)["status"] == "full"
    assert body(reopened)["status"] == "reopened"
    assert body(edited)["price"] == "8.00"
    assert body(same_day)["departure_at"].startswith(tomorrow(8)[:13])
    assert body(cancelled)["status"] == "cancelled"
    assert body(cancelled)["actions"] == {
        "can_edit": False,
        "can_change_seats": False,
        "can_cancel": False,
        "can_repeat": True,
        "can_contact": False,
        "delay_until": None,
    }
    assert after_cancel.status_code == HTTPStatus.CONFLICT
    assert repeated.status_code == HTTPStatus.CREATED
    assert body(repeated)["id"] != ride["id"]
    assert body(repeated)["price"] == "8.00"
    assert [r["status"] for r in mine] == ["open", "cancelled"]  # latest departure first
    assert revision == before + 6  # seats, seats, price, departure, cancel, repeat: one bump each


async def test_a_departure_on_another_day_is_refused_before_leaving() -> None:
    ana, car_id = await driver()
    ride = await publish(ana, car_id)
    next_day = (datetime.fromisoformat(tomorrow()) + timedelta(days=1)).isoformat()

    moved = await ana.patch(f"/api/rides/{ride['id']}", {"departure_at": next_day})

    assert moved.status_code == HTTPStatus.CONFLICT
    assert "mesmo dia" in body(moved)["detail"]


async def test_only_the_driver_changes_a_ride() -> None:
    ana, car_id = await driver()
    ride = await publish(ana, car_id)
    bia = await passenger()

    foreign = await bia.post(f"/api/rides/{ride['id']}/cancel")
    missing = await ana.post("/api/rides/00000000-0000-0000-0000-000000000000/cancel")

    assert foreign.status_code == HTTPStatus.FORBIDDEN
    assert missing.status_code == HTTPStatus.NOT_FOUND


async def test_contact_needs_a_session_hands_out_the_link_and_the_plate_and_is_limited() -> None:
    ana, car_id = await driver()
    ride = await publish(ana, car_id)
    bia = await passenger()

    anonymous = await Browser().post(f"/api/rides/{ride['id']}/contact")
    seen = body(await bia.get(f"/api/rides/{ride['id']}"))
    contact = await bia.post(f"/api/rides/{ride['id']}/contact")
    answers = [(await bia.post(f"/api/rides/{ride['id']}/contact")).status_code for _ in range(20)]

    assert anonymous.status_code == HTTPStatus.UNAUTHORIZED
    assert seen["actions"]["can_contact"] is True
    assert contact.status_code == HTTPStatus.OK
    assert body(contact)["plate"] == "ABC1234"
    assert body(contact)["phone_display"] == "(61) 99999-0001"
    assert body(contact)["whatsapp_url"].startswith("https://wa.me/5561999990001?text=")
    assert answers == [HTTPStatus.OK] * 19 + [HTTPStatus.TOO_MANY_REQUESTS]


async def test_contact_is_refused_for_a_full_ride() -> None:
    ana, car_id = await driver()
    ride = await publish(ana, car_id)
    await ana.post(f"/api/rides/{ride['id']}/seats", {"seats_available": 0})
    bia = await passenger()

    refused = await bia.post(f"/api/rides/{ride['id']}/contact")

    assert refused.status_code == HTTPStatus.CONFLICT


async def test_the_signal_stream_starts_with_the_current_revision() -> None:
    response = await AsyncClient().get("/api/rides/signal")
    assert isinstance(response, StreamingHttpResponse)
    frames = cast("AsyncGenerator[bytes]", response.streaming_content)  # async under ASGI
    chunks = [await anext(frames) for _ in range(2)]
    await frames.aclose()

    assert response["Content-Type"] == "text/event-stream"
    assert chunks[0] == b"retry: 3000\n\n"
    assert chunks[1].startswith(b"id: ")
    assert b'event: revision\ndata: {"revision": ' in chunks[1]
