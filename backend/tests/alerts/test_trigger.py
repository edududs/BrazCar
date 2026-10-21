"""The trigger, end to end with the real composition: a ride written with an event warns the alerts
it matches, once, without a person in the payload, and never fails because of the warning (D-177, D-178)."""

import logging
from datetime import date, datetime, timedelta
from decimal import Decimal
from http import HTTPStatus
from uuid import UUID

import pytest
from django.utils import timezone

from brazcar.alerts.adapters.models import NoticeModel
from brazcar.alerts.adapters.push import LoggingPushSender
from brazcar.alerts.application import NotifyMatchingAlerts
from brazcar.alerts.domain import AccountId, Notice
from brazcar.importing.adapters.composition import import_ride
from brazcar.rides.domain import CatalogStop, FreeTextStop, PaymentMethod, WhatsAppOrigin
from brazcar.shared.domain.phone import PhoneNumber
from tests.accounts.signup import registration
from tests.rides.test_routes import BRASILIA, Browser, body, ride_payload, stored_catalog

__all__ = ["stored_catalog"]  # the fixture of the rides routes, reused as is

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.usefixtures("worker_thread_connections_closed", "stored_catalog"),
]

FRONT = "http://localhost:5173"
PUSH_LOGGER = "brazcar.alerts.adapters.push"
DRIVER = {"phone": "61 99999-0001", "email": "dona@example.com", "display_name": "Dona Mariquinha Souza"}
WATCHER = {"phone": "61 99999-0002", "email": "bia@example.com", "display_name": "Bia"}
CAR = {"model": "Fusca", "color": "turquesa", "plate": "QWE5R67"}
NOTES = "Levo mala grande, falar com a Dona Mariquinha"
GROUP_PHONE = PhoneNumber.from_jid_user("5561988887777")
GROUP_NAME = "Seu Zé do Grupo"
GROUP_TEXT = "Seu Zé 61 98888-7777 saindo de Braz secreto"
ROUTE = (CatalogStop(place_id="brazlandia"), FreeTextStop(text="Incra 8"), CatalogStop(place_id="esplanada"))
BODY_TOMORROW = "Brazlândia → Esplanada, amanhã às 07:00"


@pytest.fixture(autouse=True)
def _front_origin(settings: object) -> None:
    setattr(settings, "CORS_ALLOWED_ORIGINS", [FRONT])  # noqa: B010 - pytest-django's settings proxy


def day_after(days: int) -> date:
    return timezone.localdate() + timedelta(days=days)


def at(days: int, hour: int) -> str:
    local = timezone.now().astimezone(BRASILIA) + timedelta(days=days)
    return local.replace(hour=hour, minute=0, second=0, microsecond=0).isoformat()


async def signed_up(person: dict[str, str]) -> Browser:
    client = Browser()
    response = await client.post("/api/accounts/register", await registration(**person))
    assert response.status_code == HTTPStatus.CREATED
    return client


async def driver_with_car() -> tuple[Browser, str]:
    client = await signed_up(DRIVER)
    with_car = await client.post("/api/accounts/cars", CAR)
    return client, body(with_car)["cars"][0]["id"]


async def watcher_with_alert(**overrides: object) -> tuple[Browser, str]:
    client = await signed_up(WATCHER)
    return client, await add_alert(client, **overrides)


async def add_alert(client: Browser, **overrides: object) -> str:
    payload = {
        "text": "Incra",
        "day": day_after(1).isoformat(),
        "from_time": "06:00:00",
        "until_time": "09:00:00",
        **overrides,
    }
    response = await client.post("/api/alerts", payload)
    assert response.status_code == HTTPStatus.CREATED, response.content
    return str(body(response)["id"])


async def publish(client: Browser, car_id: str, **overrides: object) -> str:
    response = await client.post(
        "/api/rides", ride_payload(car_id=car_id, departure_at=at(1, 7), **overrides)
    )
    assert response.status_code == HTTPStatus.CREATED, response.content
    return str(body(response)["id"])


async def notices() -> list[tuple[str, str]]:
    return [(str(n.alert_id), str(n.ride_id)) async for n in NoticeModel.objects.order_by("id")]


def pushes(caplog: pytest.LogCaptureFixture) -> list[str]:
    return [r.getMessage() for r in caplog.records if r.name == PUSH_LOGGER]


@pytest.fixture(autouse=True)
def _capture(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.INFO)


async def test_a_published_ride_that_matches_warns_the_alert(caplog: pytest.LogCaptureFixture) -> None:
    _, alert_id = await watcher_with_alert()
    ana, car_id = await driver_with_car()

    ride_id = await publish(ana, car_id)

    assert await notices() == [(alert_id, ride_id)]
    (line,) = pushes(caplog)
    assert f"tag={alert_id}" in line
    assert f"url=/caronas/{ride_id}" in line


@pytest.mark.parametrize(
    "overrides",
    [
        {"text": "Taguatinga"},  # not by text
        {"from_time": "08:00:00", "until_time": "09:00:00"},  # not inside the window
        {"day": day_after(2).isoformat()},  # not on the day
    ],
)
async def test_a_ride_that_does_not_match_warns_nobody(
    overrides: dict[str, str], caplog: pytest.LogCaptureFixture
) -> None:
    await watcher_with_alert(**overrides)
    ana, car_id = await driver_with_car()

    await publish(ana, car_id)

    assert await notices() == []
    assert pushes(caplog) == []


async def test_editing_a_ride_that_already_warned_does_not_warn_twice(
    caplog: pytest.LogCaptureFixture,
) -> None:
    _, alert_id = await watcher_with_alert()
    ana, car_id = await driver_with_car()
    ride_id = await publish(ana, car_id)

    edited = await ana.patch(f"/api/rides/{ride_id}", {"notes": "Saio no horário"})

    assert edited.status_code == HTTPStatus.OK
    assert await notices() == [(alert_id, ride_id)]
    assert len(pushes(caplog)) == 1


async def test_a_ride_edited_into_the_window_warns_on_the_edit(caplog: pytest.LogCaptureFixture) -> None:
    _, alert_id = await watcher_with_alert()
    ana, car_id = await driver_with_car()
    response = await ana.post("/api/rides", ride_payload(car_id=car_id, departure_at=at(1, 12)))
    ride_id = str(body(response)["id"])
    assert await notices() == []

    edited = await ana.patch(f"/api/rides/{ride_id}", {"departure_at": at(1, 8)})

    assert edited.status_code == HTTPStatus.OK
    assert await notices() == [(alert_id, ride_id)]
    assert len(pushes(caplog)) == 1


async def test_reopening_warns_and_a_full_ride_does_not(caplog: pytest.LogCaptureFixture) -> None:
    ana, car_id = await driver_with_car()
    ride_id = await publish(ana, car_id, seats_available=1)
    await ana.post(f"/api/rides/{ride_id}/seats", {"seats_available": 0})
    _, alert_id = await watcher_with_alert()
    assert await notices() == []

    await ana.patch(f"/api/rides/{ride_id}", {"notes": "Ainda cheia"})
    assert await notices() == []

    reopened = await ana.post(f"/api/rides/{ride_id}/seats", {"seats_available": 1})

    assert reopened.status_code == HTTPStatus.OK
    assert await notices() == [(alert_id, ride_id)]
    assert len(pushes(caplog)) == 1


async def test_repeating_a_ride_to_the_day_of_the_alert_warns_for_the_new_ride(
    caplog: pytest.LogCaptureFixture,
) -> None:
    _, alert_id = await watcher_with_alert()
    ana, car_id = await driver_with_car()
    response = await ana.post("/api/rides", ride_payload(car_id=car_id, departure_at=at(2, 7)))
    original = str(body(response)["id"])
    assert await notices() == []

    repeated = await ana.post(f"/api/rides/{original}/repeat", {"departure_at": at(1, 7)})

    assert repeated.status_code == HTTPStatus.CREATED
    assert await notices() == [(alert_id, str(body(repeated)["id"]))]
    assert len(pushes(caplog)) == 1


async def imported(departure_at: str) -> UUID:
    result = await import_ride()(
        sender_phone=GROUP_PHONE,
        sender_name=GROUP_NAME,
        origin=WhatsAppOrigin(message_text=GROUP_TEXT, group_label="Rota", sent_at=timezone.now()),
        route=ROUTE,
        departure_at=datetime.fromisoformat(departure_at),
        seats_available=2,
        price=Decimal("7.00"),
        payment_methods=frozenset({PaymentMethod.PIX}),
    )
    assert result.created
    return result.ride.id


async def test_an_imported_ride_warns_the_alert(caplog: pytest.LogCaptureFixture) -> None:
    _, alert_id = await watcher_with_alert()

    ride_id = await imported(at(1, 7))

    assert await notices() == [(alert_id, str(ride_id))]
    (line,) = pushes(caplog)
    assert f"url=/caronas/{ride_id}" in line


class Sent:
    """What the sender was asked to deliver, kept instead of logged."""

    def __init__(self) -> None:
        self.notices: list[tuple[AccountId, Notice]] = []

    async def send(self, owner_id: AccountId, notice: Notice) -> None:
        self.notices.append((owner_id, notice))


def assert_no_person(notice: Notice, *private: str) -> None:
    for field in (notice.title, notice.body, notice.tag, notice.url):
        for value in private:
            assert value.lower() not in field.lower()


PRIVATE = (
    "Dona Mariquinha",
    "Mariquinha",
    "Fusca",
    "turquesa",
    "QWE5R67",
    "mala grande",
    "99999-0001",
    "61999990001",
    "5561999990001",
    GROUP_NAME,
    "Zé",
    "98888-7777",
    "988887777",
    "5561988887777",
    "secreto",
)


async def test_the_payload_has_the_route_and_the_time_and_no_person(monkeypatch: pytest.MonkeyPatch) -> None:
    sent = Sent()
    monkeypatch.setattr(LoggingPushSender, "send", sent.send)
    _, alert_id = await watcher_with_alert()
    ana, car_id = await driver_with_car()

    published = await publish(ana, car_id, notes=NOTES)
    group_ride = await imported(at(1, 8))

    assert [notice.url for _, notice in sent.notices] == [f"/caronas/{published}", f"/caronas/{group_ride}"]
    for _, notice in sent.notices:
        assert notice.title == "Apareceu carona"
        assert notice.body.endswith(", amanhã às 07:00") or notice.body.endswith(", amanhã às 08:00")
        assert notice.tag == alert_id
        assert_no_person(notice, *PRIVATE)
    assert sent.notices[0][1].body == BODY_TOMORROW
    assert sent.notices[1][1].body == "Brazlândia → Esplanada, amanhã às 08:00"


async def test_a_far_day_is_written_as_day_and_month(monkeypatch: pytest.MonkeyPatch) -> None:
    sent = Sent()
    monkeypatch.setattr(LoggingPushSender, "send", sent.send)
    far = day_after(3)
    await watcher_with_alert(day=far.isoformat())
    ana, car_id = await driver_with_car()

    await ana.post("/api/rides", ride_payload(car_id=car_id, departure_at=at(3, 7)))

    assert [notice.body for _, notice in sent.notices] == [f"Brazlândia → Esplanada, {far:%d/%m} às 07:00"]


async def test_a_failing_sender_does_not_fail_the_ride(monkeypatch: pytest.MonkeyPatch) -> None:
    async def down(*_: object) -> None:
        message = "push service down"
        raise RuntimeError(message)

    monkeypatch.setattr(LoggingPushSender, "send", down)
    _, alert_id = await watcher_with_alert()
    ana, car_id = await driver_with_car()

    response = await ana.post("/api/rides", ride_payload(car_id=car_id, departure_at=at(1, 7)))

    assert response.status_code == HTTPStatus.CREATED
    ride_id = str(body(response)["id"])
    assert ride_id in [ride["id"] for ride in body(await Browser().get("/api/rides"))]
    assert await notices() == [(alert_id, ride_id)]  # claimed before sending: at most once


async def test_a_failing_listener_does_not_fail_the_ride(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    async def down(*_: object) -> None:
        message = "matching down"
        raise RuntimeError(message)

    monkeypatch.setattr(NotifyMatchingAlerts, "__call__", down)
    await watcher_with_alert()
    ana, car_id = await driver_with_car()

    response = await ana.post("/api/rides", ride_payload(car_id=car_id, departure_at=at(1, 7)))

    assert response.status_code == HTTPStatus.CREATED
    ride_id = str(body(response)["id"])
    assert ride_id in [ride["id"] for ride in body(await Browser().get("/api/rides"))]
    assert await notices() == []
    assert any(r.exc_info and ride_id in r.getMessage() for r in caplog.records)
