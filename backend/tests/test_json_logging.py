import json
import logging

import pytest

from brazcar.shared.adapters.json_logging import JsonFormatter

logger = logging.getLogger("brazcar.test")


def test_formats_one_json_object_per_record(caplog: pytest.LogCaptureFixture) -> None:
    logger.warning("revisão do %s mudou", "mural")

    line = JsonFormatter().format(caplog.records[0])

    payload = json.loads(line)
    assert "\n" not in line
    assert payload["level"] == "WARNING"
    assert payload["logger"] == "brazcar.test"
    assert payload["message"] == "revisão do mural mudou"
    assert payload["time"].endswith("+00:00")


def test_includes_the_traceback_when_there_is_an_exception(caplog: pytest.LogCaptureFixture) -> None:
    try:
        _ = 1 / 0
    except ZeroDivisionError:
        logger.exception("falhou")

    payload = json.loads(JsonFormatter().format(caplog.records[0]))
    assert "ZeroDivisionError" in payload["exception"]
