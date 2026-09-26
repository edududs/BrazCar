"""ninja authentication by the Django session cookie, async (D-059).

Reading the session's user touches the database, so it runs through `sync_to_async`; the sync
`django_auth` of ninja would block the loop. What the route receives in `request.auth` is the
account identifier only: the domain entity comes from the repository, never from the ORM user.

A route that changes state takes `gated_session_auth` instead (D-168): the same session, and then a
`WriteGate` says whether the account may write yet. The gate is the accounts context's, handed in by
each composition; this module knows only that an account can be held, never why.
"""

from dataclasses import dataclass
from http import HTTPStatus
from typing import Protocol
from uuid import UUID

from asgiref.sync import sync_to_async
from django.contrib.auth import get_user
from django.http import HttpRequest
from ninja.errors import AuthorizationError
from ninja.security import APIKeyCookie
from ninja.security.base import AuthBase

SESSION_COOKIE_NAME = "brazcar_session"


@dataclass(frozen=True, slots=True)
class Hold:
    """Why a signed-in account may not change anything yet: what the front leads the person to do
    (`required_action`), and the words the screen shows (`detail`)."""

    required_action: str
    detail: str


class WriteGate(Protocol):
    async def hold(self, account_id: UUID) -> Hold | None:
        """`None` when the account may write."""
        ...


class AccountHeldError(AuthorizationError):
    """403 with the hold in the body; `config/api.py` renders `required_action` next to `detail`."""

    def __init__(self, hold: Hold) -> None:
        super().__init__(HTTPStatus.FORBIDDEN, hold.detail)
        self.required_action = hold.required_action


class SessionAuth(APIKeyCookie):
    """Documents the cookie in OpenAPI; the check itself is `__call__`. With a gate, a held account
    is refused with `AccountHeldError`; the scheme in OpenAPI stays the same."""

    param_name = SESSION_COOKIE_NAME

    def __init__(self, gate: WriteGate | None = None) -> None:
        super().__init__()
        self._gate = gate

    async def __call__(self, request: HttpRequest) -> UUID | None:  # pyright: ignore[reportIncompatibleMethodOverride]
        user = await sync_to_async(get_user)(request)
        if not user.is_authenticated:
            return None
        account_id = UUID(str(user.pk))
        hold = None if self._gate is None else await self._gate.hold(account_id)
        if hold is not None:
            raise AccountHeldError(hold)
        return account_id

    def authenticate(self, request: HttpRequest, key: str | None) -> UUID | None:
        message = "SessionAuth is async; ninja calls __call__"
        raise NotImplementedError(message)


_session = SessionAuth()
session_auth: AuthBase = _session


def gated_session_auth(gate: WriteGate) -> AuthBase:
    """`session_auth` for a route that changes state: a held account gets 403 (D-168)."""
    return SessionAuth(gate)


async def optional_account_id(request: HttpRequest) -> UUID | None:
    """For public routes that answer differently to a signed-in viewer (ADR-0011): no session, no error."""
    return await _session(request)


def signed_in_account_id(request: HttpRequest) -> UUID:
    """In a route guarded by `session_auth`: the account ninja put in `request.auth`."""
    account_id: object = getattr(request, "auth", None)
    assert isinstance(account_id, UUID)  # noqa: S101 - `session_auth` only ever returns a UUID
    return account_id
