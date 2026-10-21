import base64
import json
import os
from collections.abc import Mapping
from datetime import timedelta
from uuid import uuid4

import http_ece
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

from brazcar.push.adapters.web_push import (
    PushDeliveryError,
    Urgency,
    VapidKeys,
    WebPushTransport,
    generate_vapid_keys,
    payload,
)
from brazcar.push.application import Delivery
from brazcar.push.domain import PushMessage, PushSubscription

from .fakes import NOW, b64url

CONTACT = "mailto:ops@example.com"
TTL = timedelta(hours=2)
TIMEOUT = 7.5
FCM = "https://fcm.googleapis.com/fcm/send/device-secret-1"
APPLE = "https://web.push.apple.com/device-secret-2"
MESSAGE = PushMessage(title="Carona", body="Uma carona nova", tag="alert-1", url="/caronas/1")


class FakeResponse:
    def __init__(self, status_code: int) -> None:
        self.status_code = status_code
        self.reason = "reason"
        self.text = "body-with-endpoint-secret"
        self.headers: Mapping[str, str] = {}


class FakeSession:
    def __init__(self, status_code: int = 201) -> None:
        self.status_code = status_code
        self.calls: list[tuple[str, bytes | None, dict[str, str], float]] = []
        self.error: OSError | None = None

    def post(self, url: str, *, data: bytes | None, headers: dict[str, str], timeout: float) -> FakeResponse:
        if self.error is not None:
            raise self.error
        self.calls.append((url, data, dict(headers), timeout))
        return FakeResponse(self.status_code)


class Device:
    def __init__(self, endpoint: str) -> None:
        self.key = ec.generate_private_key(ec.SECP256R1())
        self.auth = os.urandom(16)
        point = self.key.public_key().public_bytes(
            serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
        )
        self.subscription = PushSubscription(
            endpoint=endpoint,
            p256dh=b64url(point),
            auth=b64url(self.auth),
            owner_id=uuid4(),
            created_at=NOW,
            last_used_at=NOW,
        )


def _transport(session: FakeSession, urgency: Urgency = "high") -> tuple[WebPushTransport, VapidKeys]:
    public, private = generate_vapid_keys()
    keys = VapidKeys(public_key=public, private_key=private, contact=CONTACT)
    return WebPushTransport(keys, ttl=TTL, urgency=urgency, timeout=TIMEOUT, session=session), keys


def _claims(authorization: str) -> dict[str, str | int]:
    token = authorization.removeprefix("vapid t=").split(",k=")[0]
    body = token.split(".")[1]
    return json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))


def test_payload_has_exactly_the_four_keys() -> None:
    assert json.loads(payload(MESSAGE)) == {
        "title": "Carona",
        "body": "Uma carona nova",
        "tag": "alert-1",
        "url": "/caronas/1",
    }


async def test_a_created_response_is_sent_with_the_configured_headers() -> None:
    session = FakeSession(201)
    transport, keys = _transport(session)
    device = Device(FCM)

    assert await transport.deliver(device.subscription, MESSAGE) is Delivery.SENT

    ((url, data, headers, timeout),) = session.calls
    assert url == FCM
    assert timeout == TIMEOUT
    assert headers["ttl"] == str(int(TTL.total_seconds()))
    assert headers["urgency"] == "high"
    assert headers["content-encoding"] == "aes128gcm"
    authorization = headers["authorization"]
    assert authorization.endswith(f",k={keys.public_key}")
    claims = _claims(authorization)
    assert claims["sub"] == CONTACT
    assert claims["aud"] == "https://fcm.googleapis.com"
    assert data is not None
    clear = http_ece.decrypt(data, private_key=device.key, auth_secret=device.auth, version="aes128gcm")
    assert set(json.loads(clear)) == {"title", "body", "tag", "url"}


async def test_each_service_gets_its_own_audience() -> None:
    session = FakeSession()
    transport, _ = _transport(session)

    await transport.deliver(Device(FCM).subscription, MESSAGE)
    await transport.deliver(Device(APPLE).subscription, MESSAGE)

    audiences = [_claims(headers["authorization"])["aud"] for _, _, headers, _ in session.calls]
    assert audiences == ["https://fcm.googleapis.com", "https://web.push.apple.com"]


@pytest.mark.parametrize("status", [404, 410])
async def test_a_vanished_subscription_is_reported_gone(status: int) -> None:
    transport, _ = _transport(FakeSession(status))
    assert await transport.deliver(Device(FCM).subscription, MESSAGE) is Delivery.GONE


async def test_a_server_error_raises_without_the_endpoint() -> None:
    transport, _ = _transport(FakeSession(500))
    with pytest.raises(PushDeliveryError) as error:
        await transport.deliver(Device(FCM).subscription, MESSAGE)
    text = str(error.value)
    assert "fcm.googleapis.com" in text
    assert "500" in text
    assert "device-secret" not in text
    assert "body-with-endpoint-secret" not in text
    assert error.value.__cause__ is None
    assert error.value.__suppress_context__ is True


async def test_a_network_failure_raises_without_the_endpoint() -> None:
    session = FakeSession()
    session.error = ConnectionError("cannot reach https://fcm.googleapis.com/fcm/send/device-secret-1")
    transport, _ = _transport(session)
    with pytest.raises(PushDeliveryError) as error:
        await transport.deliver(Device(FCM).subscription, MESSAGE)
    assert "fcm.googleapis.com" in str(error.value)
    assert "device-secret" not in str(error.value)
    assert error.value.__cause__ is None
    assert error.value.__suppress_context__ is True
