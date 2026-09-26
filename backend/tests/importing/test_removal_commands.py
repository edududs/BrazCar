"""`removal_requests` and `approve_removal` over the real tables (D-172)."""

from datetime import UTC, datetime, timedelta
from io import StringIO
from uuid import UUID

import pytest
from asgiref.sync import sync_to_async
from django.core.management import call_command
from django.core.management.base import CommandError

from brazcar.importing.adapters.management.commands.removal_requests import PERSONAL_DATA_WARNING
from brazcar.importing.adapters.models import CandidateModel, SourceMessageModel
from brazcar.importing.adapters.repository import (
    DjangoBlockedSenders,
    DjangoCandidates,
    DjangoRemovalRequests,
    DjangoSourceMessages,
)
from brazcar.importing.application import IngestMessages
from brazcar.importing.domain import Accepted, Approved, Candidate, Refused, RemovalRequest
from brazcar.rides.adapters.models import RideModel
from brazcar.rides.adapters.repository import DjangoRideRepository
from brazcar.shared.domain.phone import PhoneNumber
from tests.contracts.importing_repositories import GROUP, fresh
from tests.importing.test_purge_statement import imported
from tests.rides.strategies import external

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.usefixtures("worker_thread_connections_closed"),
]

ZE = PhoneNumber.parse("+5561999990009")
BIA = PhoneNumber.parse("+5561999990001")


async def run(command: str, *args: str) -> list[str]:
    out = StringIO()
    # The command opens a loop of its own, so it may not share this one's single thread executor.
    await sync_to_async(call_command, thread_sensitive=False)(command, *args, stdout=out)
    return out.getvalue().splitlines()


async def filed(phone: PhoneNumber = ZE, note: str | None = None, *, minutes_ago: int = 5) -> RemovalRequest:
    request = RemovalRequest.open(
        phone=phone, note=note, at=datetime.now(UTC) - timedelta(minutes=minutes_ago)
    )
    await DjangoRemovalRequests().save(request)
    return request


async def imported_from(phone: PhoneNumber) -> tuple[UUID, Candidate]:
    """An external ride on the board, with the candidate and the message it came from."""
    now = datetime.now(UTC)
    ride = imported(external(phone), now + timedelta(hours=2), now)
    await DjangoRideRepository().save(ride, ())
    message = fresh(phone=phone)
    await DjangoSourceMessages().save(message)
    candidate = Candidate.open(message, group_label="Rota")
    await DjangoCandidates().save(candidate, attaching=message)
    judged = candidate.judge(Accepted(ride_id=ride.id), at=now)
    await DjangoCandidates().save(judged)
    return ride.id, judged


# --- listing ---------------------------------------------------------------------------------------


async def test_lists_the_pending_oldest_first_with_the_phone_masked() -> None:
    older = await filed(ZE, "Não autorizei.", minutes_ago=30)
    newer = await filed(BIA, minutes_ago=5)

    lines = await run("removal_requests")

    assert lines[0].startswith(f"{older.id}\t")
    assert "+5561*****0009" in lines[0]
    assert lines[0].endswith("\tpending")
    assert lines[1] == "  Não autorizei."
    assert lines[2].startswith(f"{newer.id}\t")
    assert lines[-1] == "2 request(s) pending"
    assert ZE.e164() not in "\n".join(lines)


async def test_the_moment_is_in_the_boards_zone() -> None:
    request = RemovalRequest.open(phone=ZE, note=None, at=datetime(2026, 9, 26, 12, 30, tzinfo=UTC))
    await DjangoRemovalRequests().save(request)

    (line, _) = await run("removal_requests")

    assert "\t26/09/2026 09:30\t" in line


async def test_reveal_shows_the_whole_number() -> None:
    await filed(ZE)

    lines = await run("removal_requests", "--reveal")

    assert f"\t{ZE.e164()}\t" in lines[0]


async def test_a_note_with_personal_data_is_flagged_but_kept_as_written() -> None:
    await filed(ZE, "Me liga no 61 99999-0003 que eu explico.")

    lines = await run("removal_requests")

    assert lines[1] == "  Me liga no 61 99999-0003 que eu explico."
    assert lines[2] == PERSONAL_DATA_WARNING


async def test_all_adds_the_decided_with_their_decision() -> None:
    pending = await filed(ZE, minutes_ago=30)
    refused = await filed(BIA, minutes_ago=20)
    await DjangoRemovalRequests().save(refused.refuse(datetime.now(UTC)))

    only_pending = await run("removal_requests")
    everything = await run("removal_requests", "--all")

    assert [line.split("\t")[0] for line in only_pending[:-1]] == [str(pending.id)]
    assert everything[1].startswith(f"{refused.id}\t")
    assert "\trefused " in everything[1]
    assert everything[-1] == "2 request(s)"


# --- deciding --------------------------------------------------------------------------------------


async def test_approving_removes_the_imported_rides_of_that_phone_and_blocks_it() -> None:
    ze_ride, ze_candidate = await imported_from(ZE)
    bia_ride, _ = await imported_from(BIA)
    request = await filed(ZE)

    lines = await run("approve_removal", str(request.id))

    assert lines == ["approved; the phone is blocked; removed 1 ride(s), 1 candidate(s), 0 message(s)"]
    assert not await RideModel.objects.filter(id=ze_ride).aexists()
    assert await RideModel.objects.filter(id=bia_ride).aexists()
    assert not await CandidateModel.objects.filter(id=ze_candidate.id).aexists()
    assert await DjangoBlockedSenders().is_blocked(ZE)
    stored = await DjangoRemovalRequests().get(request.id)
    assert stored is not None
    assert isinstance(stored.decision, Approved)


async def test_after_approval_nothing_of_that_phone_is_imported_again() -> None:
    request = await filed(ZE)
    await run("approve_removal", str(request.id))
    messages = DjangoSourceMessages()
    await messages.save(fresh(phone=ZE))

    await IngestMessages(messages, DjangoCandidates(), DjangoBlockedSenders(), {GROUP: "Rota"})()

    assert not await SourceMessageModel.objects.filter(sender_phone=ZE.jid_user()).aexists()
    assert not await CandidateModel.objects.filter(sender_phone=ZE.jid_user()).aexists()


async def test_approving_again_does_nothing_more() -> None:
    request = await filed(ZE)
    await run("approve_removal", str(request.id))

    assert await run("approve_removal", str(request.id)) == ["already approved; nothing to do"]


async def test_refuse_records_the_refusal_and_removes_nothing() -> None:
    ride, _ = await imported_from(ZE)
    request = await filed(ZE)

    first = await run("approve_removal", str(request.id), "--refuse")
    again = await run("approve_removal", str(request.id), "--refuse")

    assert first == ["refused; nothing removed"]
    assert again == ["already refused; nothing to do"]
    assert await RideModel.objects.filter(id=ride).aexists()
    assert not await DjangoBlockedSenders().is_blocked(ZE)
    stored = await DjangoRemovalRequests().get(request.id)
    assert stored is not None
    assert isinstance(stored.decision, Refused)


async def test_the_opposite_decision_is_refused() -> None:
    request = await filed(ZE)
    await run("approve_removal", str(request.id), "--refuse")

    with pytest.raises(CommandError, match="already refused"):
        await run("approve_removal", str(request.id))
    assert not await DjangoBlockedSenders().is_blocked(ZE)


@pytest.mark.parametrize("raw", ["not-an-id", "7d0f9a52-6f8e-4c2b-9d7a-3f1b2c4d5e6f"])
async def test_an_unknown_id_is_a_command_error(raw: str) -> None:
    with pytest.raises(CommandError):
        await run("approve_removal", raw)
