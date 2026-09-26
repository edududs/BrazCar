"""The public route against the real composition: ninja, use case, limiter, ORM (D-172)."""

import json
from datetime import UTC, datetime, timedelta
from http import HTTPStatus

import pytest

from brazcar.importing.adapters.models import RemovalRequestModel
from brazcar.importing.adapters.routes import INVALID_NOTE, TOO_MANY
from brazcar.rides.adapters.repository import DjangoRideRepository
from brazcar.shared.adapters.phone_input import INVALID_PHONE
from brazcar.shared.domain.phone import PhoneNumber
from tests.accounts.test_routes import Browser
from tests.importing.test_purge_statement import imported
from tests.rides.strategies import external

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.usefixtures("worker_thread_connections_closed"),
]

FRONT = "http://localhost:5173"
ROUTE = "/api/removal-requests"
WITH_RIDES = "(61) 99999-0001"
WITHOUT_RIDES = "(61) 99999-0002"
NOTE = "Nunca autorizei publicar minhas caronas; favor retirar."


@pytest.fixture(autouse=True)
def _front_origin(settings: object) -> None:
    setattr(settings, "CORS_ALLOWED_ORIGINS", [FRONT])  # noqa: B010 - pytest-django's settings proxy


@pytest.fixture
def _behind_the_tunnel(settings: object) -> None:
    setattr(settings, "CLIENT_IP_HEADER", "CF-Connecting-IP")  # noqa: B010


async def post(data: object, *, ip: str | None = None) -> tuple[int, bytes]:
    client = Browser().client
    headers = {"Origin": FRONT} | ({"CF-Connecting-IP": ip} if ip else {})
    response = await client.post(ROUTE, data, content_type="application/json", headers=headers)
    return response.status_code, response.content


async def test_the_answer_is_the_same_whether_the_phone_has_rides_or_not() -> None:
    now = datetime.now(UTC)
    ride = imported(external(PhoneNumber.parse(WITH_RIDES)), now + timedelta(hours=2), now)
    await DjangoRideRepository().save(ride, ())

    known = await post({"phone": WITH_RIDES, "note": NOTE})
    unknown = await post({"phone": WITHOUT_RIDES, "note": NOTE})

    assert known == unknown
    assert known[0] == HTTPStatus.ACCEPTED
    assert json.loads(known[1]) == {"ok": True}
    assert NOTE.encode() not in known[1]
    phones = {row.phone async for row in RemovalRequestModel.objects.all()}
    assert phones == {"+5561999990001", "+5561999990002"}
    assert await RemovalRequestModel.objects.filter(decision="pending", note=NOTE).acount() == 2


async def test_the_note_is_optional() -> None:
    status, content = await post({"phone": WITHOUT_RIDES})

    assert status == HTTPStatus.ACCEPTED
    assert json.loads(content) == {"ok": True}
    row = await RemovalRequestModel.objects.aget()
    assert row.note == ""


@pytest.mark.parametrize(
    ("data", "words"),
    [
        ({"phone": "123"}, INVALID_PHONE),
        ({"phone": WITHOUT_RIDES, "note": "a" * 501}, None),
    ],
)
async def test_a_malformed_request_is_refused_and_the_note_never_comes_back(
    data: dict[str, str], words: str | None
) -> None:
    status, content = await post(data)

    assert status == HTTPStatus.UNPROCESSABLE_CONTENT
    assert b"a" * 501 not in content
    if words is not None:
        assert body_of(content) == words
    assert await RemovalRequestModel.objects.acount() == 0


async def test_a_nul_in_the_note_is_refused_in_the_words_of_the_route() -> None:
    status, content = await post({"phone": WITHOUT_RIDES, "note": "antes\x00depois"})

    assert status == HTTPStatus.UNPROCESSABLE_CONTENT
    assert body_of(content) == INVALID_NOTE


@pytest.mark.usefixtures("_behind_the_tunnel")
async def test_the_limit_per_client_reads_the_edge_header_and_is_told() -> None:
    answers = [(await post({"phone": f"(61) 99999-{n:04d}"}, ip="203.0.113.7"))[0] for n in range(11)]
    other = await post({"phone": "(61) 99999-0100"}, ip="198.51.100.1")

    assert answers[:10] == [HTTPStatus.ACCEPTED] * 10
    assert answers[10] == HTTPStatus.TOO_MANY_REQUESTS
    assert body_of((await post({"phone": "(61) 99999-0101"}, ip="203.0.113.7"))[1]) == TOO_MANY
    assert other[0] == HTTPStatus.ACCEPTED


async def test_the_limit_per_phone_is_silent() -> None:
    answers = [await post({"phone": WITHOUT_RIDES, "note": NOTE}) for _ in range(4)]

    assert answers == [answers[0]] * 4
    assert answers[0][0] == HTTPStatus.ACCEPTED
    assert await RemovalRequestModel.objects.acount() == 3


def body_of(content: bytes) -> object:
    detail: object = json.loads(content)["detail"]
    return detail
