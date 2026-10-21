import base64
import binascii
from datetime import datetime
from typing import Annotated
from urllib.parse import urlsplit
from uuid import UUID

from pydantic import AfterValidator, BaseModel, ConfigDict

PUSH_SERVICES: tuple[str, ...] = (
    "fcm.googleapis.com",
    "push.services.mozilla.com",
    "push.apple.com",
    "notify.windows.com",
)
"""The browsers' push services. An endpoint must point at one of them (the same host or a subdomain,
compared by suffix after a dot), because the API is the one that POSTs to it: a free endpoint would
turn the server into a request forger toward the internal network."""

ENDPOINT_LIMIT = 2048
DEVICE_LIMIT = 5  # devices per account; the least recently used leaves when the sixth arrives

_P256_POINT_SIZE = 65  # uncompressed point: 0x04 followed by two 32-byte coordinates
_UNCOMPRESSED = 0x04
_AUTH_SIZE = 16


class Frozen(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


def _decode(value: str) -> bytes:
    try:
        return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    except (binascii.Error, ValueError) as error:
        message = "not base64url"
        raise ValueError(message) from error


def _endpoint(value: str) -> str:
    if len(value) > ENDPOINT_LIMIT:
        message = f"endpoint longer than {ENDPOINT_LIMIT} characters"
        raise ValueError(message)
    parts = urlsplit(value)
    host = parts.hostname
    if parts.scheme != "https" or parts.username is not None or parts.password is not None or not host:
        message = "endpoint must be an https URL without credentials"
        raise ValueError(message)
    if not any(host == service or host.endswith("." + service) for service in PUSH_SERVICES):
        message = "endpoint is not a known push service"
        raise ValueError(message)
    return value


def _p256dh(value: str) -> str:
    raw = _decode(value)
    if len(raw) != _P256_POINT_SIZE or raw[0] != _UNCOMPRESSED:
        message = "p256dh must be an uncompressed P-256 point"
        raise ValueError(message)
    return value


def _auth(value: str) -> str:
    if len(_decode(value)) != _AUTH_SIZE:
        message = f"auth must be {_AUTH_SIZE} bytes"
        raise ValueError(message)
    return value


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        message = "datetime must be timezone-aware"
        raise ValueError(message)
    return value


Aware = Annotated[datetime, AfterValidator(_aware)]


class PushSubscription(Frozen):
    """One device of one account: where the push service reaches it, and the keys to seal the message."""

    endpoint: Annotated[str, AfterValidator(_endpoint)]
    p256dh: Annotated[str, AfterValidator(_p256dh)]
    auth: Annotated[str, AfterValidator(_auth)]
    owner_id: UUID
    created_at: Aware
    last_used_at: Aware


def service_host(endpoint: str) -> str:
    """The host of the push service, for logs. The whole endpoint is the device address: never logged."""
    return urlsplit(endpoint).hostname or ""
