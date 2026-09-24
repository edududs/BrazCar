"""The two purge adapters of D-119 apply one rule: the SQL of the pg_cron job and the use case agree.

Postgres only: the statements are the job's, written in Postgres SQL. Installing the job is not a
test: pg_cron only loads in the database it was configured for, never in pytest's copy, so
`manage.py install_purge_schedule` is proven by hand against the compose Postgres (infra/postgres).

The scene: an external ride that left and one still to leave; the accepted candidates of both; a
rejected candidate judged long ago and one judged just now; an unattached message from long ago
and one from just now. What remains after a purge is the same whichever adapter ran it.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

import pytest
from asgiref.sync import sync_to_async
from django.db import connection

from brazcar.importing.adapters.models import CandidateModel, SourceMessageModel
from brazcar.importing.adapters.purge import purge_statements
from brazcar.importing.adapters.repository import DjangoCandidates, DjangoSourceMessages
from brazcar.importing.application import ImportedRide, ImportRules, PurgeImported
from brazcar.importing.domain import Accepted, Candidate, Rejected, RejectReason, RideDraft, Sender
from brazcar.rides.adapters.models import RideModel
from brazcar.rides.adapters.repository import DjangoRideRepository
from brazcar.rides.application import ForgetRides
from brazcar.rides.domain import CatalogStop, ExternalDriver, PaymentMethod, RideId, RideOffer
from brazcar.shared.adapters.board_revision import DjangoBoardRevision
from tests.contracts.importing_repositories import fresh, own_phone
from tests.rides.strategies import external, whatsapp_origin

from .fakes import FixedClock

RETENTION = timedelta(hours=24)
TOLERANCE = timedelta(minutes=10)
RULES = ImportRules(departure_tolerance=TOLERANCE, retention=RETENTION)
postgres_only = pytest.mark.skipif(
    connection.vendor != "postgresql", reason="the job's statements are Postgres SQL"
)


class Scene:
    def __init__(self) -> None:
        self.ride_ids: set[UUID] = set()
        self.candidate_ids: set[UUID] = set()
        self.message_ids: set[str] = set()
        self.rides_left: set[UUID] = set()
        self.candidates_left: set[UUID] = set()
        self.messages_left: set[str] = set()


class _NoSearch:
    """The purge only forgets; nothing here needs an index."""

    async def index(self, ride: RideOffer) -> None:
        del ride

    async def forget(self, ride_id: RideId) -> None:
        del ride_id

    async def matching(self, text: str, among: object) -> frozenset[RideId]:
        del text, among
        return frozenset()


class _RidesBridge:
    """Only what the purge asks of `rides`, over the real repository."""

    def __init__(self) -> None:
        self.repository = DjangoRideRepository()
        self.forget = ForgetRides(self.repository, _NoSearch())

    async def forget_departed(self, before: datetime) -> tuple[UUID, ...]:
        ids = await self.repository.external_rides(departed_before=before)
        await self.forget(ids)
        return ids

    async def forget_from(self, phone: str) -> tuple[UUID, ...]:
        raise NotImplementedError

    async def create(
        self, *, sender: Sender, message_text: str, group_label: str, sent_at: datetime, draft: RideDraft
    ) -> ImportedRide:
        raise NotImplementedError


def imported(driver: ExternalDriver, departure: datetime, now: datetime) -> RideOffer:
    return RideOffer.import_offer(
        driver=driver,
        origin=whatsapp_origin(now - timedelta(hours=2)),
        route=(CatalogStop(place_id="brazlandia"), CatalogStop(place_id="esplanada")),
        departure_at=departure,
        seats_available=2,
        price=Decimal("7.00"),
        payment_methods=frozenset({PaymentMethod.PIX}),
        now=now - timedelta(hours=2),
    ).ride


async def build_scene(now: datetime) -> Scene:
    rides = DjangoRideRepository()
    messages, candidates = DjangoSourceMessages(), DjangoCandidates()
    scene = Scene()
    gone = imported(external(own_phone()), now - TOLERANCE - timedelta(minutes=1), now)
    live = imported(external(own_phone()), now + timedelta(hours=1), now)
    for ride in (gone, live):
        await rides.save(ride, ())
    scene.ride_ids, scene.rides_left = {gone.id, live.id}, {live.id}

    def judged(verdict: Accepted | Rejected, at: datetime) -> Candidate:
        return Candidate.open(fresh(phone=own_phone()), group_label="Rota").judge(verdict, at=at)

    accepted_gone = judged(Accepted(ride_id=gone.id), now - timedelta(hours=2))
    accepted_live = judged(Accepted(ride_id=live.id), now - timedelta(hours=2))
    rejected_old = judged(Rejected(reason=RejectReason.NOT_AN_OFFER), now - RETENTION - timedelta(minutes=1))
    rejected_new = judged(Rejected(reason=RejectReason.NOT_AN_OFFER), now - timedelta(minutes=1))
    for candidate in (accepted_gone, accepted_live, rejected_old, rejected_new):
        await candidates.save(candidate)
    scene.candidate_ids = {accepted_gone.id, accepted_live.id, rejected_old.id, rejected_new.id}
    scene.candidates_left = {accepted_live.id, rejected_new.id}

    old = fresh(phone=own_phone(), received_at=now - RETENTION - timedelta(minutes=1))
    new = fresh(phone=own_phone(), received_at=now - timedelta(minutes=1))
    for message in (old, new):
        await messages.save(message)
    scene.message_ids, scene.messages_left = {old.message_id, new.message_id}, {new.message_id}
    return scene


def remaining(scene: Scene) -> tuple[set[UUID], set[UUID], set[str]]:
    return (
        set(RideModel.objects.filter(id__in=scene.ride_ids).values_list("id", flat=True)),
        set(CandidateModel.objects.filter(id__in=scene.candidate_ids).values_list("id", flat=True)),
        set(
            SourceMessageModel.objects.filter(message_id__in=scene.message_ids).values_list(
                "message_id", flat=True
            )
        ),
    )


def run_statements() -> None:
    with connection.cursor() as cursor:
        for statement in purge_statements(retention=RETENTION, tolerance=TOLERANCE):
            cursor.execute(statement)


@postgres_only
@pytest.mark.contract
@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
@pytest.mark.parametrize("adapter", ["pg_cron statements", "use case"])
async def test_both_purges_leave_the_same_rows(adapter: str) -> None:
    now = datetime.now(tz=UTC)
    scene = await build_scene(now)
    revision = DjangoBoardRevision()
    before = await revision.current()

    if adapter == "use case":
        purge = PurgeImported(
            DjangoSourceMessages(), DjangoCandidates(), _RidesBridge(), FixedClock(now), RULES
        )
        await purge()
    else:
        await sync_to_async(run_statements)()

    rides_left, candidates_left, messages_left = await sync_to_async(remaining)(scene)
    assert rides_left == scene.rides_left
    assert candidates_left == scene.candidates_left
    assert messages_left == scene.messages_left
    assert await revision.current() == before + 1  # one ride went: the board changed
