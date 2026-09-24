"""The data migrations of D-138, run against the real tables: SQLite here, Postgres on the heavy gate.

Rows are written the way the code before D-138 wrote them, with the old WhatsApp address; each
migration then runs twice, and the second run must change nothing.
"""

from datetime import UTC, datetime, timedelta
from importlib import import_module
from typing import Protocol
from uuid import uuid4

import pytest
from asgiref.sync import sync_to_async
from django.apps import apps
from hypothesis import given

from brazcar.importing.adapters.models import BlockedSenderModel, CandidateModel, SourceMessageModel
from brazcar.rides.adapters.models import RideModel
from brazcar.rides.adapters.repository import DjangoRideRepository
from brazcar.rides.domain import ExternalDriver, RideOffer
from brazcar.shared.adapters.ninth_digit import canonical_jid_users
from brazcar.shared.domain.phone import PhoneNumber
from tests.contracts import contract_settings
from tests.rides.strategies import imported_rides, published

pytestmark = [
    pytest.mark.contract,
    pytest.mark.django_db(transaction=True),
    pytest.mark.usefixtures("worker_thread_connections_closed"),
]

OLD, NEW = "556199990001", "5561999990001"
OLD_ACCOUNT, NEW_ACCOUNT = "556190000001", "5561990000001"
NOW = datetime(2026, 9, 24, 12, 0, tzinfo=UTC)


class _Migration(Protocol):
    def restore_ninth_digit(self, apps: object, schema_editor: object) -> None: ...


def _run(module: str) -> None:
    migration: _Migration = import_module(module)  # pyright: ignore[reportAssignmentType]
    migration.restore_ninth_digit(apps, None)


def run_importing() -> None:
    _run("brazcar.importing.adapters.migrations.0003_ninth_digit")


def run_rides() -> None:
    _run("brazcar.rides.adapters.migrations.0004_ninth_digit")


def test_only_old_addresses_change_and_what_is_no_phone_is_reported() -> None:
    rewrite = canonical_jid_users([OLD, NEW, "14155552671", "556133334444", "123", OLD])

    assert rewrite.changes == {OLD: NEW}
    assert rewrite.unreadable == ("123",)


def _message(message_id: str, *, account: str, sender: str) -> SourceMessageModel:
    return SourceMessageModel(
        account=account,
        message_id=message_id,
        chat_jid="120363000000000001@g.us",
        sender_phone=sender,
        sender_name="Ana",
        sent_at=NOW,
        text="3 vagas 19:30",
        received_at=NOW,
    )


@sync_to_async
def _importing_scene() -> None:
    CandidateModel.objects.create(
        id=uuid4(),
        sender_phone=OLD,
        text_key="3 vagas 19:30",
        text="3 vagas 19:30",
        group_label="Caronas",
        first_seen_at=NOW,
        last_seen_at=NOW,
        verdict="pending",
    )
    SourceMessageModel.objects.bulk_create(
        [
            _message("alone", account=OLD_ACCOUNT, sender=OLD),
            _message("twice", account=OLD_ACCOUNT, sender=OLD),
            _message("twice", account=NEW_ACCOUNT, sender=NEW),  # the extractor delivered it again
            _message("junk", account=OLD_ACCOUNT, sender="123"),
        ]
    )
    BlockedSenderModel.objects.create(phone=OLD, blocked_at=NOW - timedelta(days=1))


@sync_to_async
def _importing_state() -> tuple[object, ...]:
    return (
        sorted(CandidateModel.objects.values_list("sender_phone", flat=True)),
        sorted(SourceMessageModel.objects.values_list("message_id", "account", "sender_phone")),
        sorted(BlockedSenderModel.objects.values_list("phone", "blocked_at")),
    )


async def test_importing_rows_get_the_ninth_digit_once_and_keep_every_block() -> None:
    await _importing_scene()

    await sync_to_async(run_importing)()
    migrated = await _importing_state()
    await sync_to_async(run_importing)()

    assert await _importing_state() == migrated
    candidates, messages, blocked = migrated
    assert candidates == [NEW]
    assert messages == [
        ("alone", NEW_ACCOUNT, NEW),
        ("junk", NEW_ACCOUNT, "123"),  # no phone at all: left alone, and reported in the log
        ("twice", OLD_ACCOUNT, NEW),  # its twin holds the canonical key: it waits for the purge
        ("twice", NEW_ACCOUNT, NEW),
    ]
    assert blocked == [(OLD, NOW - timedelta(days=1)), (NEW, NOW - timedelta(days=1))]  # both stay blocked


@contract_settings
@given(ride=imported_rides())
async def test_external_drivers_get_the_ninth_digit_once(ride: RideOffer) -> None:
    repository = DjangoRideRepository()
    ride = ride.evolve(
        driver=ExternalDriver(phone=PhoneNumber.from_jid_user(NEW), display_name="Ana"),
    )
    await repository.save(ride, (published(ride),))
    await RideModel.objects.filter(id=ride.id).aupdate(driver_phone=OLD)  # as written before D-138

    await sync_to_async(run_rides)()
    await sync_to_async(run_rides)()

    assert await repository.get(ride.id) == ride
    assert await repository.find_imported(PhoneNumber.from_jid_user(OLD), ride.departure_at) == ride
    await repository.delete(ride.id)
