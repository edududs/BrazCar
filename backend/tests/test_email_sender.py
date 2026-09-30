import importlib

import pytest
from django.core.exceptions import ImproperlyConfigured


def _reload() -> None:
    import brazcar.config.settings as project_settings  # noqa: PLC0415 - reloaded on purpose

    importlib.reload(project_settings)


def test_a_well_formed_sender_boots(monkeypatch: pytest.MonkeyPatch) -> None:
    import brazcar.config.settings as project_settings  # noqa: PLC0415 - reloaded on purpose

    monkeypatch.setenv("EMAIL_FROM", "BrazCar <no-reply@elj-labs.org>")
    importlib.reload(project_settings)
    assert project_settings.DEFAULT_FROM_EMAIL == "BrazCar <no-reply@elj-labs.org>"
    monkeypatch.delenv("EMAIL_FROM")
    _reload()


@pytest.mark.parametrize("raw", ["BrazCar <no-reply@elj-labs.org", "no-reply", "BrazCar <>"])
def test_a_malformed_sender_stops_the_boot(raw: str, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EMAIL_FROM", raw)
    with pytest.raises(ImproperlyConfigured, match="EMAIL_FROM"):
        _reload()
    monkeypatch.delenv("EMAIL_FROM")
    _reload()
