"""The net every route relies on without knowing it (D-158): see `config/api.py`."""

import json
from http import HTTPStatus

from django.test import RequestFactory
from pydantic import BaseModel, ValidationError

from brazcar.config.api import api


class _Example(BaseModel):
    value: str


def test_a_domain_validation_error_becomes_422_not_500() -> None:
    """No route in the app is meant to reach this handler for a case it already catches itself
    (accounts, feedback and rides each translate their own); this proves the net under all of them
    still answers 422, not the 500 every other exception falls back to, for a `pydantic.ValidationError`
    no route expects yet."""
    try:
        _Example.model_validate({"value": None})
    except ValidationError as error:
        response = api.on_exception(RequestFactory().get("/"), error)
    else:
        message = "expected a validation error"
        raise AssertionError(message)

    assert response.status_code == HTTPStatus.UNPROCESSABLE_CONTENT
    assert json.loads(response.content) == {"detail": "confira os dados enviados"}
