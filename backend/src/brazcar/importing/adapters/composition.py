"""Wires the worker to its adapters. Called by the management commands only."""

import logging
from collections.abc import Awaitable

from whatsapp_extractor import bootstrap
from whatsapp_extractor.application import EventHandler
from whatsapp_extractor.domain import MessageExtracted, Watchlist
from whatsapp_extractor.settings import Settings, StoreKind, ViewKind

from brazcar.importing.application import PurgeSourceMessages
from brazcar.shared.adapters.clock import SystemClock

from .config import ImportingSettings, PurgeMode
from .repository import DjangoSourceMessages
from .store import DjangoStore
from .worker import Extract, Sweep

SWEEP_INTERVAL_SECONDS = 60.0


def extractor_settings(config: ImportingSettings, *, account: str | None = None) -> Settings:
    """The extractor's own settings, built from ours: no TOML, no `.env` of its own (D-109)."""
    return Settings(
        _env_file=None,  # pyright: ignore[reportCallIssue] - pydantic-settings init-only switch
        database=config.session_dsn,
        account=account or config.account or None,
        watchlist=Watchlist(chats=frozenset(group.jid for group in config.groups)),
        store=StoreKind.MEMORY,  # never used: the writer below is passed explicitly (D-042)
        view=ViewKind.LOG,
    )


def extract(config: ImportingSettings) -> Extract:
    account = config.require_account()
    store = DjangoStore(DjangoSourceMessages(), account=account, groups=config.groups, clock=SystemClock())
    settings = extractor_settings(config, account=account)

    def run(handler: EventHandler[MessageExtracted]) -> Awaitable[None]:
        return bootstrap.run(settings, handler, writer=store)

    return run


def sweep(config: ImportingSettings) -> Sweep:
    """In 7a the sweep only applies the retention rule, and only where Postgres does not (D-119)."""
    if config.purge is PurgeMode.PG_CRON:
        return _nothing
    purge = PurgeSourceMessages(DjangoSourceMessages(), SystemClock(), config.raw_retention)

    async def run() -> None:
        gone = await purge()
        if gone:
            logging.getLogger(__name__).info("purged %d source messages", gone)

    return run


async def _nothing() -> None:
    return


def quiet_extractor_logs() -> None:
    """The extractor logs every message in full at INFO; the platform keeps text out of logs."""
    logging.getLogger("whatsapp_extractor.adapters.log_handler").setLevel(logging.WARNING)
