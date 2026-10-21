"""The Web Push transport (D-183): VAPID keys checked at boot, and delivery through `pywebpush`.

The only module of `src/` that touches `pywebpush`, `py_vapid`, `http_ece` or `cryptography`. It
reads no Django settings and no model on import: the settings module imports it."""

import asyncio
import base64
import binascii
import json
import re
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import timedelta
from typing import Literal, Protocol
from urllib.parse import urlsplit

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from django.core.exceptions import ImproperlyConfigured
from py_vapid import Vapid02
from pywebpush import WebPushException, webpush

from brazcar.push.application import Delivery
from brazcar.push.domain import PushMessage, PushSubscription, service_host

Urgency = Literal["very-low", "low", "normal", "high"]

_PRIVATE_SIZE = 32
_PUBLIC_SIZE = 65
_UNCOMPRESSED = 0x04
_GONE = (404, 410)
_MAILTO = re.compile(r"mailto:[^@\s:]+@[^@\s.:]+(\.[^@\s.:]+)+")
_TOGETHER = "VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_CONTACT go together: set all three or none"
_BAD_PRIVATE = "VAPID_PRIVATE_KEY must be a P-256 private key, 32 bytes in base64url"


class _Response(Protocol):
    status_code: int
    reason: str
    text: str
    headers: Mapping[str, str]


class HttpSession(Protocol):
    """What `pywebpush` asks of a `requests.Session`; tests pass a fake."""

    def post(
        self,
        url: str,
        *,
        data: bytes | None,
        headers: dict[str, str],
        timeout: float,
    ) -> _Response: ...


@dataclass(frozen=True, slots=True)
class VapidKeys:
    public_key: str  # base64url of the uncompressed point: the front's `applicationServerKey`
    private_key: str  # base64url of the 32-byte scalar
    contact: str


class PushDeliveryError(Exception):
    """Carries the host of the push service and the status or kind of failure, never the endpoint."""


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _unb64url(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _uncompressed(public: ec.EllipticCurvePublicKey) -> bytes:
    return public.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)


def _valid_contact(contact: str) -> bool:
    if _MAILTO.fullmatch(contact):
        return True
    parts = urlsplit(contact)
    host = parts.hostname or ""
    return parts.scheme == "https" and "." in host


def _signer(private: str) -> Vapid02:
    """Messages never carry the value: it is the secret."""
    try:
        if len(_unb64url(private)) != _PRIVATE_SIZE:
            raise ImproperlyConfigured(_BAD_PRIVATE)
        return Vapid02.from_raw(private.encode())
    except binascii.Error, ValueError:
        raise ImproperlyConfigured(_BAD_PRIVATE) from None


def vapid_keys(*, public: str, private: str, contact: str) -> VapidKeys | None:
    """`None` when the three are empty (push off); an error when they are partial or malformed."""
    public, private, contact = public.strip(), private.strip(), contact.strip()
    filled = [bool(public), bool(private), bool(contact)]
    if not any(filled):
        return None
    if not all(filled):
        raise ImproperlyConfigured(_TOGETHER)
    derived = _uncompressed(_signer(private).public_key)
    try:
        given = _unb64url(public)
    except binascii.Error, ValueError:
        given = b""
    if len(given) != _PUBLIC_SIZE or given[0] != _UNCOMPRESSED:
        message = "VAPID_PUBLIC_KEY must be an uncompressed P-256 point, 65 bytes in base64url"
        raise ImproperlyConfigured(message)
    if given != derived:
        message = "VAPID_PUBLIC_KEY does not belong to VAPID_PRIVATE_KEY"
        raise ImproperlyConfigured(message)
    if not _valid_contact(contact):
        # An invalid contact made Apple refuse every push with 403 BadJwtToken.
        message = "VAPID_CONTACT must be mailto:user@domain.tld or an https://host URL"
        raise ImproperlyConfigured(message)
    return VapidKeys(public_key=public, private_key=private, contact=contact)


def generate_vapid_keys() -> tuple[str, str]:
    """A new pair, `(public, private)`, in the format `vapid_keys` accepts."""
    key = ec.generate_private_key(ec.SECP256R1())
    private = key.private_numbers().private_value.to_bytes(_PRIVATE_SIZE, "big")
    return _b64url(_uncompressed(key.public_key())), _b64url(private)


def payload(message: PushMessage) -> str:
    return json.dumps(
        {"title": message.title, "body": message.body, "tag": message.tag, "url": message.url},
        ensure_ascii=False,
    )


class WebPushTransport:
    def __init__(
        self,
        vapid: VapidKeys,
        *,
        ttl: timedelta,
        urgency: Urgency,
        timeout: float,
        session: HttpSession | None = None,
    ) -> None:
        # Built once; passing the instance also spares `webpush` an `os.path.isfile` on the key.
        self._signer = Vapid02.from_raw(vapid.private_key.encode())
        self._contact = vapid.contact
        self._ttl = int(ttl.total_seconds())
        self._urgency: Urgency = urgency
        self._timeout = timeout
        self._session = session

    async def deliver(self, subscription: PushSubscription, message: PushMessage) -> Delivery:
        return await asyncio.to_thread(self._send, subscription, message)

    def _send(self, subscription: PushSubscription, message: PushMessage) -> Delivery:
        host = service_host(subscription.endpoint)
        try:
            webpush(
                subscription_info={
                    "endpoint": subscription.endpoint,
                    "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
                },
                data=payload(message),
                vapid_private_key=self._signer,
                # A new dict per send: `webpush` writes `aud` and `exp` into it, and the `aud` of
                # the first service would stick for every other one.
                vapid_claims={"sub": self._contact},
                ttl=self._ttl,
                # Always explicit: with `None`, `requests` waits forever.
                timeout=self._timeout,
                headers={"Urgency": self._urgency},
                requests_session=self._session,
            )
        except WebPushException as error:
            status = error.status_code
            if status in _GONE:
                return Delivery.GONE
            detail = f"status {status}" if status is not None else "no status"
            # `from None`: the chained cause would carry the endpoint and the response body to the log.
            message_text = f"push service {host} refused: {detail}"
            raise PushDeliveryError(message_text) from None
        except OSError as error:
            message_text = f"push service {host} unreachable: {type(error).__name__}"
            raise PushDeliveryError(message_text) from None
        return Delivery.SENT
