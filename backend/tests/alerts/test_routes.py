"""The routes against the real composition: ninja, session, use cases, ORM."""

from datetime import date, timedelta
from http import HTTPStatus
from uuid import UUID, uuid4

import pytest
from django.utils import timezone

from brazcar.alerts.adapters.models import RideAlertModel
from brazcar.alerts.adapters.repository import DjangoAlertRepository
from brazcar.alerts.domain import RideAlert
from tests.accounts.signup import PASSWORD, legacy_account
from tests.accounts.test_routes import Browser, body, register

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.usefixtures("worker_thread_connections_closed"),
]

FRONT = "http://localhost:5173"
BIA = {"phone": "61 99999-0002", "email": "bia@example.com", "display_name": "Bia"}


@pytest.fixture(autouse=True)
def _front_origin(settings: object) -> None:
    setattr(settings, "CORS_ALLOWED_ORIGINS", [FRONT])  # noqa: B010 - pytest-django's settings proxy


def today() -> date:
    return timezone.localdate()


def payload(**overrides: object) -> dict[str, object]:
    return {"text": "Rodoviária", "day": today().isoformat(), "from_time": "06:00:00", **overrides}


async def signed_in() -> tuple[Browser, UUID]:
    client = Browser()
    account = await register(client)
    return client, UUID(str(account["id"]))


async def held() -> Browser:
    await legacy_account(phone="61 99999-0005")
    client = Browser()
    await client.post("/api/accounts/login", {"phone": "61 99999-0005", "password": PASSWORD})
    return client


async def test_every_route_refuses_without_a_session() -> None:
    anonymous = Browser()

    listed = await anonymous.get("/api/alerts")
    created = await anonymous.post("/api/alerts", payload())
    deleted = await anonymous.delete(f"/api/alerts/{uuid4()}")

    assert [listed.status_code, created.status_code, deleted.status_code] == [HTTPStatus.UNAUTHORIZED] * 3
    assert await RideAlertModel.objects.acount() == 0


async def test_a_held_account_reads_its_alerts_but_neither_creates_nor_deletes() -> None:
    client = await held()

    listed = await client.get("/api/alerts")
    created = await client.post("/api/alerts", payload())
    deleted = await client.delete(f"/api/alerts/{uuid4()}")

    assert listed.status_code == HTTPStatus.OK
    assert listed.json() == []
    expected = {"detail": "confirme seu e-mail para continuar", "required_action": "confirm_email"}
    assert created.status_code == HTTPStatus.FORBIDDEN
    assert body(created) == expected
    assert deleted.status_code == HTTPStatus.FORBIDDEN
    assert body(deleted) == expected
    assert await RideAlertModel.objects.acount() == 0


async def test_a_created_alert_comes_back_whole_and_is_listed() -> None:
    ana, _ = await signed_in()

    created = await ana.post("/api/alerts", payload(until_time="09:30:00"))
    listed = await ana.get("/api/alerts")

    assert created.status_code == HTTPStatus.CREATED
    made = body(created)
    assert made["text"] == "Rodoviária"
    assert made["day"] == today().isoformat()
    assert made["from_time"] == "06:00:00"
    assert made["until_time"] == "09:30:00"
    assert made["created_at"]
    assert [UUID(str(alert["id"])) for alert in listed.json()] == [UUID(str(made["id"]))]


async def test_a_blank_text_is_no_text() -> None:
    ana, _ = await signed_in()

    created = await ana.post("/api/alerts", payload(text="   "))

    assert created.status_code == HTTPStatus.CREATED
    assert body(created)["text"] is None


@pytest.mark.parametrize(
    ("changes", "words"),
    [
        (
            {"day": (today() - timedelta(days=1)).isoformat()},
            "escolha hoje ou um dia que ainda não passou",
        ),
        (
            {"from_time": "10:00:00", "until_time": "09:00:00"},
            "o fim do horário não pode vir antes do começo",
        ),
    ],
)
async def test_a_refusal_says_why_in_the_words_of_the_screen(changes: dict[str, str], words: str) -> None:
    ana, _ = await signed_in()

    response = await ana.post("/api/alerts", payload(**changes))

    assert response.status_code == HTTPStatus.UNPROCESSABLE_CONTENT
    assert body(response)["detail"] == words
    assert await RideAlertModel.objects.acount() == 0


async def test_the_sixth_active_alert_is_refused() -> None:
    ana, _ = await signed_in()

    answers = [(await ana.post("/api/alerts", payload(text=f"Lugar {n}"))).status_code for n in range(5)]
    sixth = await ana.post("/api/alerts", payload(text="Lugar 6"))

    assert answers == [HTTPStatus.CREATED] * 5
    assert sixth.status_code == HTTPStatus.UNPROCESSABLE_CONTENT
    assert body(sixth)["detail"] == "você já tem 5 avisos ativos; apague um para criar outro"
    assert await RideAlertModel.objects.acount() == 5


async def test_the_list_holds_only_the_active_alerts_of_the_account() -> None:
    ana, ana_id = await signed_in()
    bia = Browser()
    await register(bia, **BIA)
    kept = body(await ana.post("/api/alerts", payload()))
    await bia.post("/api/alerts", payload(text="Do outro"))
    expired = RideAlert(
        id=uuid4(),
        owner_id=ana_id,
        text="Vencido",
        day=today() - timedelta(days=1),
        from_time=None,
        until_time=None,
        created_at=timezone.now() - timedelta(days=2),
    )
    await DjangoAlertRepository().add(expired)

    listed = await ana.get("/api/alerts")

    assert [alert["id"] for alert in listed.json()] == [kept["id"]]


async def test_deleting_ones_own_alert_removes_it() -> None:
    ana, _ = await signed_in()
    made = body(await ana.post("/api/alerts", payload()))

    deleted = await ana.delete(f"/api/alerts/{made['id']}")
    listed = await ana.get("/api/alerts")

    assert deleted.status_code == HTTPStatus.NO_CONTENT
    assert deleted.content == b""
    assert listed.json() == []


@pytest.mark.parametrize("whose", ["another", "nobody"])
async def test_someone_elses_alert_and_a_missing_one_read_the_same_and_change_nothing(whose: str) -> None:
    ana, _ = await signed_in()
    bia = Browser()
    await register(bia, **BIA)
    theirs = body(await bia.post("/api/alerts", payload()))
    target = theirs["id"] if whose == "another" else str(uuid4())

    deleted = await ana.delete(f"/api/alerts/{target}")

    assert deleted.status_code == HTTPStatus.NOT_FOUND
    assert body(deleted)["detail"] == "aviso não encontrado"
    assert await RideAlertModel.objects.acount() == 1
    assert [alert["id"] for alert in (await bia.get("/api/alerts")).json()] == [theirs["id"]]
