"""The device subscriptions of an account (D-183). The public key is what the browser needs to
subscribe; saving and dropping a subscription are writes, so they go through the write gate (D-168).
The endpoint is the address of a device: it travels in the body, never in the URL, so it does not
reach an access log."""

from collections.abc import Callable
from http import HTTPStatus

from django.http import HttpRequest
from ninja import Field, Router, Schema
from ninja.errors import HttpError
from ninja.responses import Status
from ninja.security.base import AuthBase
from pydantic import ValidationError

from brazcar.push.application import SubscribeDevice, UnsubscribeDevice
from brazcar.push.domain import ENDPOINT_LIMIT
from brazcar.shared.adapters.api_errors import with_errors
from brazcar.shared.adapters.session_auth import session_auth, signed_in_account_id

_P256DH_LIMIT = 128
_AUTH_LIMIT = 64


class PublicKeyOut(Schema):
    public_key: str


class SubscriptionKeysIn(Schema):
    p256dh: str = Field(max_length=_P256DH_LIMIT)
    auth: str = Field(max_length=_AUTH_LIMIT)


class SubscriptionIn(Schema):
    """The browser's `PushSubscription.toJSON()`; what it sends beyond these fields is ignored."""

    endpoint: str = Field(max_length=ENDPOINT_LIMIT)
    keys: SubscriptionKeysIn


class SubscriptionOut(Schema):
    endpoint: str


class EndpointIn(Schema):
    endpoint: str = Field(max_length=ENDPOINT_LIMIT)


def build_router(
    subscribe: SubscribeDevice,
    unsubscribe: UnsubscribeDevice,
    public_key: Callable[[], str | None],
    writer: AuthBase,
) -> Router:
    """`public_key` is read on each call: `None` means push is off on this server.
    `writer`: an account held until it confirms its e-mail gets 403 (D-168)."""
    router = Router(tags=["push"])

    @router.get(
        "/public-key",
        response=with_errors(PublicKeyOut, unauthorized=True, unavailable=True),
        auth=session_auth,
        operation_id="push_public_key",
    )
    async def get_public_key(request: HttpRequest) -> PublicKeyOut:
        """The key the browser subscribes with; 503 when this server has push off."""
        key = public_key()
        if key is None:
            raise HttpError(
                HTTPStatus.SERVICE_UNAVAILABLE, "as notificações não estão disponíveis no momento"
            )
        return PublicKeyOut(public_key=key)

    @router.put(
        "/subscriptions",
        response=with_errors(SubscriptionOut, unauthorized=True, held=True, validation=True),
        auth=writer,
        operation_id="save_push_subscription",
    )
    async def save_subscription(request: HttpRequest, data: SubscriptionIn) -> SubscriptionOut:
        """Keep this device for the account; the same endpoint under another account passes to it."""
        try:
            saved = await subscribe(
                signed_in_account_id(request),
                endpoint=data.endpoint,
                p256dh=data.keys.p256dh,
                auth=data.keys.auth,
            )
        except ValidationError as error:
            raise HttpError(HTTPStatus.UNPROCESSABLE_CONTENT, "inscrição de notificação inválida") from error
        return SubscriptionOut(endpoint=saved.endpoint)

    @router.delete(
        "/subscriptions",
        response=with_errors({HTTPStatus.NO_CONTENT: None}, unauthorized=True, held=True, validation=True),
        auth=writer,
        operation_id="delete_push_subscription",
    )
    async def delete_subscription(request: HttpRequest, data: EndpointIn) -> Status[None]:
        """Drop one of the account's own devices; an unknown or foreign endpoint answers the same."""
        await unsubscribe(signed_in_account_id(request), data.endpoint)
        return Status(HTTPStatus.NO_CONTENT, None)

    return router
