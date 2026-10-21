"""Wires the alert use cases to their adapters. Called by `config/api.py` and by the purge command.

`notify_matching_alerts()` is what the composition root plugs into the port that tells a ride was
written, so `rides` never knows who listens (D-177).
"""

from django.conf import settings
from django.utils import timezone
from ninja import Router

from brazcar.accounts.adapters.composition import writer_auth
from brazcar.accounts.adapters.repository import DjangoAccountRepository
from brazcar.alerts.application import (
    AlertRules,
    CreateAlert,
    DeleteAlert,
    ListAlerts,
    NotifyMatchingAlerts,
    PurgeAlerts,
)
from brazcar.alerts.application.ports import PushSender
from brazcar.places.adapters.repository import DjangoCatalogRepository
from brazcar.push.adapters.composition import push_to_account
from brazcar.rides.adapters.composition import ride_rules, ride_search
from brazcar.rides.adapters.directories import AccountDriverDirectory, CatalogPlaceDirectory
from brazcar.rides.adapters.repository import DjangoRideRepository
from brazcar.rides.application import ShownOnBoard, ShowRide
from brazcar.shared.adapters.clock import SystemClock

from .push import DevicePushSender, LoggingPushSender
from .repository import DjangoAlertRepository, DjangoNoticeLog
from .rides import RidesBoard
from .routes import build_router


def alert_rules() -> AlertRules:
    return AlertRules(limit=settings.ALERT_ACTIVE_LIMIT, zone=timezone.get_default_timezone())


def _push_sender() -> PushSender:
    """Through the `push` context when push is on; a log line when this server has no VAPID keys (D-182)."""
    push = push_to_account()
    return LoggingPushSender() if push is None else DevicePushSender(push)


def notify_matching_alerts() -> NotifyMatchingAlerts:
    rides = DjangoRideRepository()
    drivers = AccountDriverDirectory(DjangoAccountRepository())
    places = CatalogPlaceDirectory(DjangoCatalogRepository())
    search = ride_search()
    clock = SystemClock()
    rules = ride_rules()
    board = RidesBoard(
        ShowRide(rides, drivers, places, clock, rules),
        ShownOnBoard(rides, search, clock, rules),
    )
    return NotifyMatchingAlerts(
        DjangoAlertRepository(), board, DjangoNoticeLog(), _push_sender(), clock, alert_rules()
    )


def purge_alerts() -> PurgeAlerts:
    return PurgeAlerts(DjangoAlertRepository(), SystemClock(), alert_rules())


def alerts_router() -> Router:
    alerts, clock, rules = DjangoAlertRepository(), SystemClock(), alert_rules()
    return build_router(
        CreateAlert(alerts, clock, rules),
        ListAlerts(alerts, clock, rules),
        DeleteAlert(alerts),
        writer_auth(),
    )
