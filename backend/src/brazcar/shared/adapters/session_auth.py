"""ninja authentication by the Django session cookie, async (D-059).

Reading the session's user touches the database, so it runs through `sync_to_async`; the sync
`django_auth` of ninja would block the loop. What the route receives in `request.auth` is the
account identifier only: the domain entity comes from the repository, never from the ORM user.
"""

from uuid import UUID

from asgiref.sync import sync_to_async
from django.contrib.auth import get_user
from django.http import HttpRequest
from ninja.security import APIKeyCookie
from ninja.security.base import AuthBase

SESSION_COOKIE_NAME = "brazcar_session"


class SessionAuth(APIKeyCookie):
    """Documents the cookie in OpenAPI; the check itself is `__call__`."""

    param_name = SESSION_COOKIE_NAME

    async def __call__(self, request: HttpRequest) -> UUID | None:  # pyright: ignore[reportIncompatibleMethodOverride]
        user = await sync_to_async(get_user)(request)
        if not user.is_authenticated:
            return None
        return UUID(str(user.pk))

    def authenticate(self, request: HttpRequest, key: str | None) -> UUID | None:
        message = "SessionAuth is async; ninja calls __call__"
        raise NotImplementedError(message)


_session = SessionAuth()
session_auth: AuthBase = _session


async def optional_account_id(request: HttpRequest) -> UUID | None:
    """For public routes that answer differently to a signed-in viewer (ADR-0011): no session, no error."""
    return await _session(request)


def signed_in_account_id(request: HttpRequest) -> UUID:
    """In a route guarded by `session_auth`: the account ninja put in `request.auth`."""
    account_id: object = getattr(request, "auth", None)
    assert isinstance(account_id, UUID)  # noqa: S101 - `session_auth` only ever returns a UUID
    return account_id
