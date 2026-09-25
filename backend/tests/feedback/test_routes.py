"""The route against the real composition: ninja, session, use case, limiter, ORM."""

from http import HTTPStatus

import pytest

from brazcar.feedback.adapters.models import FeedbackModel
from tests.accounts.test_routes import Browser, body, register

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.usefixtures("worker_thread_connections_closed"),
]

FRONT = "http://localhost:5173"
COMPLAINT = {
    "kind": "complaint",
    "message": "Combinou e não apareceu.",
    "about_phone": "(61) 99999-0002",
    "web_version": "0.20.2",
}


@pytest.fixture(autouse=True)
def _front_origin(settings: object) -> None:
    setattr(settings, "CORS_ALLOWED_ORIGINS", [FRONT])  # noqa: B010 - pytest-django's settings proxy


async def test_only_a_signed_in_person_sends() -> None:
    response = await Browser().post("/api/feedback", COMPLAINT)

    assert response.status_code == HTTPStatus.UNAUTHORIZED
    assert await FeedbackModel.objects.acount() == 0


async def test_a_complaint_is_kept_with_the_phone_in_e164_and_nothing_comes_back() -> None:
    ana = Browser()
    account = await register(ana)

    response = await ana.post("/api/feedback", COMPLAINT)

    assert response.status_code == HTTPStatus.NO_CONTENT
    assert response.content == b""
    row = await FeedbackModel.objects.aget()
    assert str(row.author_id) == account["id"]
    assert row.about_phone == "+5561999990002"
    assert row.kind == "complaint"


@pytest.mark.parametrize(
    ("changes", "words"),
    [
        ({"about_phone": "123"}, "telefone inválido: digite o celular com DDD, como (61) 99999-9999"),
        ({"kind": "praise"}, "só a reclamação aponta alguém"),
        ({"message": "   "}, "escreva sua opinião"),
    ],
)
async def test_a_refusal_says_why_in_the_words_of_the_screen(changes: dict[str, str], words: str) -> None:
    ana = Browser()
    await register(ana)

    response = await ana.post("/api/feedback", {**COMPLAINT, **changes})

    assert response.status_code == HTTPStatus.UNPROCESSABLE_CONTENT
    assert body(response)["detail"] == words


async def test_the_account_has_a_limit() -> None:
    """Five a day by default (`FEEDBACK_LIMIT`, `FEEDBACK_WINDOW_HOURS`), read when the router is built."""
    ana = Browser()
    await register(ana)
    suggestion = {"kind": "suggestion", "message": "Uma ideia.", "web_version": "0.20.2"}

    answers = [(await ana.post("/api/feedback", suggestion)).status_code for _ in range(6)]

    assert answers[:5] == [HTTPStatus.NO_CONTENT] * 5
    assert answers[5] == HTTPStatus.TOO_MANY_REQUESTS
    assert (
        body(await ana.post("/api/feedback", suggestion))["detail"]
        == "muitas opiniões por hoje; tente amanhã"
    )
