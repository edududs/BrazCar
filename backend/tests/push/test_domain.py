from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from pydantic import ValidationError

from brazcar.push.domain import ENDPOINT_LIMIT, PushMessage, PushSubscription, service_host

from .fakes import FCM, NOW, b64url, make_subscription, new_auth, new_p256dh


def build(**changes: object) -> PushSubscription:
    fields: dict[str, object] = {
        "endpoint": FCM + "abc",
        "p256dh": new_p256dh(),
        "auth": new_auth(),
        "owner_id": uuid4(),
        "created_at": NOW,
        "last_used_at": NOW,
    }
    return PushSubscription.model_validate(fields | changes)


@pytest.mark.parametrize(
    "endpoint",
    [
        "https://fcm.googleapis.com/fcm/send/abc",
        "https://updates.push.services.mozilla.com/wpush/v2/abc",
        "https://push.services.mozilla.com/abc",
        "https://web.push.apple.com/abc",
        "https://push.apple.com/abc",
        "https://wns2-bl2p.notify.windows.com/abc",
        "https://notify.windows.com/abc",
    ],
)
def test_known_push_services_are_accepted(endpoint: str) -> None:
    assert build(endpoint=endpoint).endpoint == endpoint


@pytest.mark.parametrize(
    "endpoint",
    [
        "http://fcm.googleapis.com/fcm/send/abc",
        "https://example.com/abc",
        "https://fcm.googleapis.com.evil.com/x",
        "https://evilfcm.googleapis.com/x",
        "https://fcm.googleapis.com@evil.com/x",
        "https://user:pass@fcm.googleapis.com/x",
        "https:///x",
        "https://127.0.0.1/x",
        FCM + "a" * ENDPOINT_LIMIT,
    ],
)
def test_other_endpoints_are_refused(endpoint: str) -> None:
    with pytest.raises(ValidationError):
        build(endpoint=endpoint)


def test_p256dh_may_carry_padding() -> None:
    assert build(p256dh=b64url(b"\x04" + bytes(64)) + "=").p256dh.endswith("=")


@pytest.mark.parametrize(
    "p256dh",
    [
        b64url(b"\x04" + bytes(63)),
        b64url(b"\x02" + bytes(64)),
        "not base64 at all!",
        "a",
        "",
    ],
)
def test_malformed_p256dh_is_refused(p256dh: str) -> None:
    with pytest.raises(ValidationError):
        build(p256dh=p256dh)


@pytest.mark.parametrize("auth", [b64url(bytes(15)), b64url(bytes(17)), "###", ""])
def test_malformed_auth_is_refused(auth: str) -> None:
    with pytest.raises(ValidationError):
        build(auth=auth)


@pytest.mark.parametrize("field", ["created_at", "last_used_at"])
def test_naive_datetimes_are_refused(field: str) -> None:
    with pytest.raises(ValidationError):
        build(**{field: datetime(2026, 10, 21, 12, 0)})  # noqa: DTZ001  # the point is the missing zone


def test_aware_datetimes_in_any_zone_are_accepted() -> None:
    later = NOW.astimezone(UTC) + timedelta(hours=1)
    assert build(last_used_at=later).last_used_at == later


def test_subscription_is_frozen_and_closed() -> None:
    subscription = make_subscription(FCM + "x", uuid4())
    with pytest.raises(ValidationError):
        subscription.endpoint = FCM + "y"
    with pytest.raises(ValidationError):
        build(extra="x")


def test_service_host_hides_the_device_address() -> None:
    assert service_host(FCM + "secret-token") == "fcm.googleapis.com"


def test_message_has_exactly_four_fields() -> None:
    message = PushMessage(title="Carona", body="Há uma carona", tag="ride-1", url="/caronas/1")
    assert set(PushMessage.model_fields) == {"title", "body", "tag", "url"}
    assert message.url == "/caronas/1"


def test_message_refuses_an_extra_field() -> None:
    with pytest.raises(ValidationError):
        PushMessage.model_validate({"title": "t", "body": "b", "tag": "x", "url": "/", "icon": "i"})


@pytest.mark.parametrize("url", ["https://x", "//x", "caronas", ""])
def test_message_url_must_be_a_front_end_path(url: str) -> None:
    with pytest.raises(ValidationError):
        PushMessage(title="t", body="b", tag="x", url=url)


def test_message_title_must_not_be_blank() -> None:
    with pytest.raises(ValidationError):
        PushMessage(title="  ", body="b", tag="x", url="/")
