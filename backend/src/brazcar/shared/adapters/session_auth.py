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


session_auth: AuthBase = SessionAuth()
