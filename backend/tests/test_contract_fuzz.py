"""Fuzzes `contract/openapi.json` against a live, SQLite-backed API (D-065, D-156).

Same recipe as the end to end suite (`playwright.config.ts`): a real server, a real database,
requests over HTTP. Schemathesis drives every documented operation with generated data and checks
the response against the schema itself (status code, shape, headers) with every built-in check
except `positive_data_acceptance`, documented below where it is excluded (`--checks all` on the
CLI minus that one check).

Own marker, `schemathesis` (also `heavy`, in its style): too slow for the fast gate, part of the
heavy one (`poe test-contract-fuzz`, called from `poe check-heavy`). The seed is fixed
(`@seed(...)`) so a failure reproduces; `max_examples` is kept low so the whole file runs in a
few minutes.

Routes split by their own contract, not a hand-kept list: an operation with a `security` entry in
`contract/openapi.json` needs the session cookie `session_auth` reads (D-091); the rest is public.
`log_out` and `delete_account` end the session they are given, so they run alone, each with its own
throwaway account, instead of inside the batch the other authenticated routes share.
"""

import itertools
import json
from http import HTTPStatus
from pathlib import Path
from typing import Any

import pytest
import requests
import schemathesis
from hypothesis import HealthCheck, seed
from hypothesis import settings as hypothesis_settings
from schemathesis.checks import (
    CHECKS,  # pyright: ignore[reportUnknownVariableType] - untyped registry
    load_all_checks,
)

from tests.accounts.signup import registration_sync

pytestmark = [pytest.mark.heavy, pytest.mark.schemathesis, pytest.mark.django_db(transaction=True)]

CONTRACT = Path(__file__).resolve().parents[2] / "contract" / "openapi.json"
FRONT = "http://localhost:5173"
RAW_SCHEMA = json.loads(CONTRACT.read_text(encoding="utf-8"))
HTTP_VERBS = frozenset({"get", "post", "put", "patch", "delete"})

AUTHENTICATED_OPERATIONS = sorted(
    operation["operationId"]
    for methods in RAW_SCHEMA["paths"].values()
    for verb, operation in methods.items()
    if verb in HTTP_VERBS and "security" in operation
)
"""Every operation `contract/openapi.json` marks with `SessionAuth` (D-091). Read from the file
itself so a route that starts requiring a session is fuzzed authenticated without anyone updating
a list here."""

ENDS_THE_SESSION = ("log_out", "delete_account")
BATCH_AUTHENTICATED_OPERATIONS = [op for op in AUTHENTICATED_OPERATIONS if op not in ENDS_THE_SESSION]

load_all_checks()
NEGATIVE_DATA_REJECTION = CHECKS.get_one("negative_data_rejection")  # pyright: ignore[reportUnknownVariableType]
POSITIVE_DATA_ACCEPTANCE = CHECKS.get_one("positive_data_acceptance")  # pyright: ignore[reportUnknownVariableType]

BASE_CHECKS = [  # pyright: ignore[reportUnknownVariableType]
    check
    for check in CHECKS.get_all()  # pyright: ignore[reportUnknownVariableType]
    if check is not POSITIVE_DATA_ACCEPTANCE
]
"""Every built-in check except `positive_data_acceptance`, excluded everywhere (D-156). It treats
any body that merely matches the JSON types as data the route must accept (2xx) or refuse only for
reasons outside the payload's shape (401/403/404/409/429/5xx) — never 422. That does not hold here
on purpose: `StopIn` types `place_id` and `text` as two independent optional strings because OpenAPI
has no XOR, so "both empty" is shape-valid and 422 is the domain saying "a stop is one or the
other" (`cada parada é um lugar do catálogo ou um texto`); the same gap lets a shape-valid body
carry a weak password, an unknown catalog place or a phone Django's validators refuse, all real
domain refusals, already covered by the unit and route tests of each context. Every other check,
including `status_code_conformance` and `response_schema_conformance` (the two D-065 set out to
add), stays on."""

AUTHENTICATED_CHECKS = [  # pyright: ignore[reportUnknownVariableType]
    check
    for check in BASE_CHECKS  # pyright: ignore[reportUnknownVariableType]
    if check is not NEGATIVE_DATA_REJECTION
]
"""`session_cookie` below hands every authenticated case a real cookie, on top of whatever
Schemathesis generated, so the one negative case that deliberately omits `brazcar_session` never
reaches the API without it: `negative_data_rejection` would then see a 200 and flag "invalid data
accepted", not because the API accepts a missing cookie (`tests/accounts/test_routes.py` and
`tests/rides/test_routes.py` already prove 401), but because this harness never lets that one case
through. Excluded only here; the public batch keeps every other check."""

schema = schemathesis.openapi.from_dict(RAW_SCHEMA)
public_schema = schema.exclude(operation_id=AUTHENTICATED_OPERATIONS)  # pyright: ignore[reportUnknownMemberType]
batch_authenticated_schema = schema.include(  # pyright: ignore[reportUnknownMemberType]
    operation_id=BATCH_AUTHENTICATED_OPERATIONS
)
log_out_schema = schema.include(operation_id="log_out")  # pyright: ignore[reportUnknownMemberType]
delete_account_schema = schema.include(operation_id="delete_account")  # pyright: ignore[reportUnknownMemberType]

FUZZ_SETTINGS = hypothesis_settings(
    max_examples=8,
    deadline=None,  # a real HTTP round trip against a real database, not an in-memory function
    suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture],
)

_spare_numbers = itertools.count(1)


def _spare_phone_and_email() -> tuple[str, str]:
    """A phone the demonstration seed and the end to end suite never reserve (D-133, D-134), and an
    e-mail of its own: both are unique per account (D-167)."""
    n = next(_spare_numbers)
    return f"61 97000-{n:04d}", f"fuzzer{n}@example.com"


@pytest.fixture(autouse=True)
def _front_origin(settings: Any) -> None:  # noqa: ANN401 - pytest-django's settings proxy has no stub
    setattr(settings, "CORS_ALLOWED_ORIGINS", [FRONT])  # noqa: B010


def _register(base_url: str) -> requests.Response:
    """Signed up the one way there is: an invite written to the live server's database, its e-mail
    given, then the registration over HTTP (D-167)."""
    phone, email = _spare_phone_and_email()
    payload = registration_sync(phone=phone, email=email, display_name="Fuzzer")
    return requests.post(
        f"{base_url}/api/accounts/register", json=payload, headers={"Origin": FRONT}, timeout=10
    )


def _session_cookie_of(response: requests.Response) -> dict[str, str]:
    """The session cookie a registration response set, the way `session_auth` reads it (D-091)."""
    assert response.status_code == HTTPStatus.CREATED, response.text
    cookie = response.cookies["brazcar_session"]
    assert cookie is not None
    return {"brazcar_session": cookie}


@pytest.fixture
def session_cookie(live_server: Any) -> dict[str, str]:  # noqa: ANN401 - pytest-django's fixture has no stub
    """A signed-in account's session cookie, fresh for the test that asks for it."""
    return _session_cookie_of(_register(live_server.url))


def _call(case: Any, base_url: str, cookies: dict[str, str] | None = None) -> None:  # noqa: ANN401
    case.call_and_validate(
        base_url=base_url,
        headers={"Origin": FRONT},
        cookies=cookies,
        checks=AUTHENTICATED_CHECKS if cookies else BASE_CHECKS,
        timeout=10,
    )


@public_schema.parametrize()  # pyright: ignore[reportUnknownMemberType, reportUntypedFunctionDecorator]
@FUZZ_SETTINGS
@seed(20260925)
def test_public_routes_follow_the_contract(case: Any, live_server: Any) -> None:  # noqa: ANN401
    _call(case, live_server.url)


@batch_authenticated_schema.parametrize()  # pyright: ignore[reportUnknownMemberType, reportUntypedFunctionDecorator]
@FUZZ_SETTINGS
@seed(20260925)
def test_authenticated_routes_follow_the_contract(
    case: Any,  # noqa: ANN401
    live_server: Any,  # noqa: ANN401
    session_cookie: dict[str, str],
) -> None:
    _call(case, live_server.url, cookies=session_cookie)


@log_out_schema.parametrize()  # pyright: ignore[reportUnknownMemberType, reportUntypedFunctionDecorator]
@hypothesis_settings(
    max_examples=3, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture]
)
@seed(20260925)
def test_log_out_follows_the_contract(case: Any, live_server: Any) -> None:  # noqa: ANN401
    """Alone: it ends the session a fresh account hands it, so the batch above never gets it."""
    _call(case, live_server.url, cookies=_session_cookie_of(_register(live_server.url)))


@delete_account_schema.parametrize()  # pyright: ignore[reportUnknownMemberType, reportUntypedFunctionDecorator]
@hypothesis_settings(
    max_examples=3, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture]
)
@seed(20260925)
def test_delete_account_follows_the_contract(case: Any, live_server: Any) -> None:  # noqa: ANN401
    """Alone, for the same reason as `log_out`: it also erases the account the cookie stands for."""
    _call(case, live_server.url, cookies=_session_cookie_of(_register(live_server.url)))
