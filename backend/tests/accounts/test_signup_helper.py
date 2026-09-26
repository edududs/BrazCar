"""The synchronous way in of `signup.py`, the one the contract fuzz relies on to get a session."""

from http import HTTPStatus

import pytest
from django.test import Client

from .signup import registration_sync

pytestmark = [pytest.mark.django_db(transaction=True)]

FRONT = "http://localhost:5173"


def test_a_synchronous_test_signs_up_through_an_invite(settings: object) -> None:
    setattr(settings, "CORS_ALLOWED_ORIGINS", [FRONT])  # noqa: B010 - pytest-django's settings proxy
    data = registration_sync(phone="61 97000-0001", email="fuzzer1@example.com", display_name="Fuzzer")

    response = Client().post(
        "/api/accounts/register", data, content_type="application/json", headers={"Origin": FRONT}
    )

    assert response.status_code == HTTPStatus.CREATED, response.content
    assert "brazcar_session" in response.cookies
