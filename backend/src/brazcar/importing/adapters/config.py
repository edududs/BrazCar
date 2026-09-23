"""What the worker needs from the environment, read once from the Django settings (D-108, D-109)."""

from dataclasses import dataclass
from datetime import timedelta
from enum import StrEnum
from typing import Self

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from brazcar.importing.domain import WatchedGroup


class PurgeMode(StrEnum):
    WORKER = "worker"  # the worker's own sweep (SQLite, or a Postgres without pg_cron)
    PG_CRON = "pg_cron"  # a job inside Postgres, installed by `manage.py install_purge_schedule`


@dataclass(frozen=True, slots=True)
class ImportingSettings:
    account: str
    """Phone of the paired account, digits only. Empty until `pair_whatsapp` says which."""
    session_dsn: str
    """SQLite file or `postgres://` DSN where neonize keeps the session (D-040)."""
    groups: tuple[WatchedGroup, ...]
    purge: PurgeMode
    raw_retention: timedelta

    @classmethod
    def from_django(cls) -> Self:
        return cls(
            account=settings.WHATSAPP_ACCOUNT,
            session_dsn=settings.WHATSAPP_SESSION_DSN,
            groups=parse_groups(settings.WHATSAPP_GROUPS),
            purge=PurgeMode(settings.IMPORT_PURGE),
            raw_retention=timedelta(hours=settings.IMPORT_RAW_RETENTION_HOURS),
        )

    def require_account(self) -> str:
        if not self.account:
            message = "WHATSAPP_ACCOUNT is empty: pair with `manage.py pair_whatsapp` and set it"
            raise ImproperlyConfigured(message)
        return self.account


def parse_groups(spec: str) -> tuple[WatchedGroup, ...]:
    """`jid=label;jid=label`. Blank is no group at all, which the worker refuses to run with."""
    groups: list[WatchedGroup] = []
    for entry in (item.strip() for item in spec.split(";")):
        if not entry:
            continue
        jid, separator, label = entry.partition("=")
        if not separator:
            message = f"WHATSAPP_GROUPS entry {entry!r} must be `jid=label`"
            raise ImproperlyConfigured(message)
        groups.append(WatchedGroup(jid=jid.strip(), label=label))
    return tuple(groups)
