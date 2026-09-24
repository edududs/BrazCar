"""Wires the worker and the commands to their adapters. Called by the management commands only."""

import logging
from collections.abc import Awaitable
from dataclasses import dataclass

from whatsapp_extractor import bootstrap
from whatsapp_extractor.application import EventHandler
from whatsapp_extractor.domain import MessageExtracted, Watchlist
from whatsapp_extractor.settings import Settings, StoreKind, ViewKind

from brazcar.accounts.adapters.repository import DjangoAccountRepository
from brazcar.importing.application import (
    BlockSender,
    ImportRules,
    IngestMessages,
    JudgeCandidates,
    PurgeImported,
)
from brazcar.places.adapters.repository import DjangoCatalogRepository
from brazcar.rides.adapters.composition import ride_search
from brazcar.rides.adapters.directories import AccountDriverDirectory, CatalogPlaceDirectory
from brazcar.rides.adapters.repository import DjangoRideRepository
from brazcar.rides.application import ForgetRides, ImportRide
from brazcar.shared.adapters.clock import SystemClock

from .bridges import CatalogStopResolver, RidesBridge
from .config import ImportingSettings, PurgeMode
from .ollama import OllamaRideParser
from .repository import DjangoBlockedSenders, DjangoCandidates, DjangoSourceMessages
from .store import DjangoStore
from .worker import Extract, Sweep

SWEEP_INTERVAL_SECONDS = 60.0
JUDGEMENTS_PER_SWEEP = 50
log = logging.getLogger(__name__)


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


@dataclass(frozen=True, slots=True)
class ImportUseCases:
    ingest: IngestMessages
    judge: JudgeCandidates
    purge: PurgeImported
    block: BlockSender


def import_use_cases(config: ImportingSettings) -> ImportUseCases:
    messages = DjangoSourceMessages()
    candidates = DjangoCandidates()
    blocked = DjangoBlockedSenders()
    clock = SystemClock()
    catalog = DjangoCatalogRepository()
    rides_repository = DjangoRideRepository()
    rides = RidesBridge(
        ImportRide(
            rides_repository,
            AccountDriverDirectory(DjangoAccountRepository()),
            CatalogPlaceDirectory(catalog),
            ride_search(),
            clock,
        ),
        ForgetRides(rides_repository, ride_search()),
        rides_repository,
    )
    rules = ImportRules(
        departure_tolerance=config.departure_tolerance,
        accept_threshold=config.accept_threshold,
        max_attempts=config.max_attempts,
        retention=config.raw_retention,
    )
    parser = OllamaRideParser(base_url=config.ollama_base_url, model=config.parser_model)
    return ImportUseCases(
        ingest=IngestMessages(messages, candidates, blocked, config.labels),
        judge=JudgeCandidates(candidates, parser, CatalogStopResolver(catalog), rides, clock, rules),
        purge=PurgeImported(messages, candidates, rides, clock, rules),
        block=BlockSender(blocked, messages, candidates, rides),
    )


def sweep(config: ImportingSettings) -> Sweep:
    """One pass (D-112): new messages into candidates, candidates judged one at a time, then the
    purge unless Postgres does it by pg_cron (D-119)."""
    use_cases = import_use_cases(config)

    async def run() -> None:
        taken = await use_cases.ingest()
        judged = await use_cases.judge(limit=JUDGEMENTS_PER_SWEEP)
        created = sum(1 for each in judged if each.created_ride)
        if taken or judged:
            log.info("sweep: %d message(s) taken, %d judged, %d ride(s) created", taken, len(judged), created)
        if config.purge is PurgeMode.WORKER:
            report = await use_cases.purge()
            if report.rides or report.candidates or report.messages:
                log.info(
                    "purged %d ride(s), %d candidate(s), %d message(s)",
                    report.rides,
                    report.candidates,
                    report.messages,
                )

    return run


def quiet_extractor_logs() -> None:
    """The extractor logs every message in full at INFO; the platform keeps text out of logs."""
    logging.getLogger("whatsapp_extractor.adapters.log_handler").setLevel(logging.WARNING)
