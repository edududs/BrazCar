"""Wires the push use cases to their adapters. Called by `config/api.py` and, for sending, by the
contexts that notify a person.

Push is off when the VAPID keys are unset (`settings.PUSH_VAPID` is `None`): `push_to_account()` then
answers `None` and the key route answers 503.
"""

from datetime import timedelta

from django.conf import settings
from ninja import Router

from brazcar.accounts.adapters.composition import writer_auth
from brazcar.push.application import ForgetDevices, PushToAccount, SubscribeDevice, UnsubscribeDevice
from brazcar.shared.adapters.clock import SystemClock

from .repository import DjangoSubscriptionRepository
from .routes import build_router
from .web_push import Urgency, VapidKeys, WebPushTransport

# (D-182) These hold for every message today because there is one sender (the ride alerts). When another
# sender asks for other values, they move into the message.
# A notice of a ride today or tomorrow still serves after a night with the phone off; later, the
# push service drops it.
PUSH_TTL = timedelta(hours=12)
PUSH_URGENCY: Urgency = "high"  # a ride notice is time-sensitive
PUSH_TIMEOUT_SECONDS = 5.0  # per device; sending runs inside the request that writes the ride (D-177)


def _vapid() -> VapidKeys | None:
    keys = settings.PUSH_VAPID
    return keys if isinstance(keys, VapidKeys) else None


def _public_key() -> str | None:
    keys = _vapid()
    return None if keys is None else keys.public_key


def push_to_account() -> PushToAccount | None:
    vapid = _vapid()
    if vapid is None:
        return None
    transport = WebPushTransport(vapid, ttl=PUSH_TTL, urgency=PUSH_URGENCY, timeout=PUSH_TIMEOUT_SECONDS)
    return PushToAccount(DjangoSubscriptionRepository(), transport, SystemClock())


def forget_devices() -> ForgetDevices:
    return ForgetDevices(DjangoSubscriptionRepository())


def push_router() -> Router:
    subscriptions, clock = DjangoSubscriptionRepository(), SystemClock()
    return build_router(
        SubscribeDevice(subscriptions, clock),
        UnsubscribeDevice(subscriptions),
        _public_key,
        writer_auth(),
    )
