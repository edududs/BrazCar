from http import HTTPStatus

from django.test.client import AsyncClient


async def test_health_reports_ok() -> None:
    response = await AsyncClient().get("/api/health")

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {"status": "ok"}
