import importlib
from http import HTTPStatus

import pytest
from django.core.exceptions import ImproperlyConfigured
from django.test import override_settings
from django.test.client import AsyncClient


async def test_without_a_floor_every_front_is_served() -> None:
    response = await AsyncClient().get("/api/web-version")

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {"minimum": "0.0.0"}


@override_settings(WEB_MINIMUM_VERSION="0.7.0")
async def test_the_floor_comes_from_the_environment() -> None:
    response = await AsyncClient().get("/api/web-version")

    assert response.json() == {"minimum": "0.7.0"}


@pytest.mark.parametrize("raw", ["0.7", "v0.7.0", "0.7.0-beta", "latest"])
def test_a_malformed_floor_stops_the_boot(raw: str, monkeypatch: pytest.MonkeyPatch) -> None:
    import brazcar.config.settings as project_settings  # noqa: PLC0415 - reloaded on purpose

    monkeypatch.setenv("WEB_MINIMUM_VERSION", raw)
    with pytest.raises(ImproperlyConfigured, match="WEB_MINIMUM_VERSION"):
        importlib.reload(project_settings)
    monkeypatch.delenv("WEB_MINIMUM_VERSION")
    importlib.reload(project_settings)
