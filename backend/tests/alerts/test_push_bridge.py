"""`DevicePushSender` over the real `PushToAccount`, and the composition's choice of sender (D-182)."""

from uuid import uuid4

from brazcar.alerts.adapters.composition import notify_matching_alerts
from brazcar.alerts.adapters.push import DevicePushSender, LoggingPushSender
from brazcar.alerts.domain import Notice
from brazcar.push.adapters.web_push import VapidKeys, generate_vapid_keys
from brazcar.push.application import PushToAccount
from brazcar.push.domain import PushMessage
from tests.push.fakes import (
    FCM,
    FixedClock,
    InMemorySubscriptionRepository,
    ScriptedTransport,
    make_subscription,
)

NOTICE = Notice(title="Carona encontrada", body="Hoje às 07:00", tag="alert-1", url="/caronas/abc")


def bridge() -> tuple[DevicePushSender, InMemorySubscriptionRepository, ScriptedTransport]:
    subscriptions, transport = InMemorySubscriptionRepository(), ScriptedTransport()
    return DevicePushSender(PushToAccount(subscriptions, transport, FixedClock())), subscriptions, transport


async def test_the_notice_reaches_the_device_of_the_account_as_the_same_four_fields() -> None:
    sender, subscriptions, transport = bridge()
    owner = uuid4()
    await subscriptions.save(make_subscription(f"{FCM}one", owner))

    await sender.send(owner, NOTICE)

    assert transport.delivered == [
        (
            f"{FCM}one",
            PushMessage(title=NOTICE.title, body=NOTICE.body, tag=NOTICE.tag, url=NOTICE.url),
        )
    ]


async def test_an_account_without_a_device_calls_nothing() -> None:
    sender, subscriptions, transport = bridge()
    await subscriptions.save(make_subscription(f"{FCM}other", uuid4()))

    await sender.send(uuid4(), NOTICE)

    assert transport.delivered == []


def test_with_push_off_the_notices_go_to_the_log(settings: object) -> None:
    setattr(settings, "PUSH_VAPID", None)  # noqa: B010 - pytest-django's settings proxy

    assert isinstance(notify_matching_alerts().sender, LoggingPushSender)


def test_with_push_on_the_notices_go_to_the_devices(settings: object) -> None:
    public, private = generate_vapid_keys()
    setattr(settings, "PUSH_VAPID", VapidKeys(public, private, "mailto:ops@example.com"))  # noqa: B010

    assert isinstance(notify_matching_alerts().sender, DevicePushSender)
