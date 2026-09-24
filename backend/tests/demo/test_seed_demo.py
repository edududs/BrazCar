"""`manage.py seed_demo` (D-132): where it refuses, what it promises, and that it repeats itself.

Seeding is not cheap, so the promises are checked together on one run instead of one run apiece.
"""

from io import StringIO
from pathlib import Path

import pytest
from asgiref.sync import sync_to_async
from django.core.management import call_command
from django.core.management.base import CommandError

from brazcar.accounts.adapters.models import User
from brazcar.demo.adapters import dataset as data
from brazcar.demo.adapters.seeding import DemoManifest
from brazcar.importing.adapters.models import BlockedSenderModel, CandidateModel, SourceMessageModel
from brazcar.rides.adapters.models import ContactRequestModel, RideModel
from brazcar.rides.domain import NOTES_LIMIT, RideStatus

CONTACT_LIMIT = 20  # `RideRules.contact_limit` by default (D-097)
DAYS = 3  # hoje, amanhã e outro dia


async def _run(*args: str) -> None:
    # The command opens a loop of its own, so it may not share this one's single thread executor.
    await sync_to_async(call_command, thread_sensitive=False)("seed_demo", *args, stdout=StringIO())


def _read(manifest: Path) -> DemoManifest:
    return DemoManifest.model_validate_json(manifest.read_text(encoding="utf-8"))


async def _seed(manifest: Path) -> DemoManifest:
    await sync_to_async(call_command, thread_sensitive=False)("sync_places", stdout=StringIO())
    await _run("--yes-i-know", "--manifest", str(manifest))
    return await sync_to_async(_read, thread_sensitive=False)(manifest)


async def _counts() -> tuple[int, int, int, int, int]:
    return (
        await User.objects.acount(),
        await RideModel.objects.acount(),
        await CandidateModel.objects.acount(),
        await SourceMessageModel.objects.acount(),
        await ContactRequestModel.objects.acount(),
    )


def test_the_longest_note_is_exactly_the_limit() -> None:
    assert len(data.LONG_NOTES) == NOTES_LIMIT


def test_the_demonstration_phones_are_invented_and_all_different() -> None:
    phones = [person.phone for person in data.PEOPLE] + list(data.SUITE_PHONES)

    assert len(set(phones)) == len(phones)
    assert all(phone.startswith("+55619000000") for phone in phones)
    assert all(sender.phone.startswith("55619") for sender in data.SENDERS)


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
async def test_refuses_outside_debug() -> None:
    with pytest.raises(CommandError, match="DJANGO_DEBUG"):
        await _run()

    assert await User.objects.acount() == 0


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
async def test_seeds_everything_it_promises(tmp_path: Path) -> None:
    seeded = await _seed(tmp_path / "manifest.json")

    # Contas: uma de cada feitio (D-132).
    assert len(seeded.accounts) == len(data.PEOPLE)
    assert await User.objects.acount() == len(data.PEOPLE)
    cars = {account.slug: len(account.cars) for account in seeded.accounts}
    assert cars[data.DRIVER_ONE_CAR.slug] == 1
    assert cars[data.DRIVER_TWO_CARS.slug] == 2
    assert cars[data.DRIVER_NO_CAR.slug] == 0
    assert cars[data.FRESH.slug] == 0

    # Caronas: toda situação calculada (ADR-0003), três dias e as duas origens.
    assert {ride.status for ride in seeded.rides} == {status.value for status in RideStatus}
    assert len(seeded.days) == DAYS
    assert {ride.origin for ride in seeded.rides} == {"published", "whatsapp"}
    assert [ride.slug for ride in seeded.rides if not ride.on_board]
    assert await RideModel.objects.filter(notes=data.LONG_NOTES).acount() == 1

    # Importadas: o texto original redigido, e a de quem tem conta é da dona (D-127, D-128).
    external = await RideModel.objects.aget(id=seeded.ride("imported_external").id)
    assert external.origin_kind == "whatsapp"
    assert external.origin_group_label == data.GROUP_LABEL
    assert "98888-0001" not in external.origin_text
    assert "[…]" in external.origin_text
    assert external.driver_id is None
    owned = await RideModel.objects.aget(id=seeded.ride("imported_owned").id)
    assert owned.driver_id is not None
    assert owned.car_plate == ""

    # Candidatas: um veredito de cada, e a mesma postagem em dois grupos é uma só (D-113).
    assert set(seeded.candidates_by_verdict) == {"accepted", "pending", "rejected", "failed"}
    reasons = {
        reason
        async for reason in CandidateModel.objects.filter(verdict="rejected").values_list("reason", flat=True)
    }
    assert reasons == {
        "few_stops",
        "low_confidence",
        "no_seats",
        "no_time",
        "not_an_offer",
        "unknown_place",
    }
    assert await CandidateModel.objects.filter(sources=2).acount() == 1
    assert await BlockedSenderModel.objects.acount() == 1

    # Contato: uma conta com a cota do dia inteira gasta, outra com alguns pedidos (D-097).
    spent = seeded.account(data.LONG_NAME.slug)
    asked = await ContactRequestModel.objects.filter(requester_id=spent.id).acount()
    assert asked == CONTACT_LIMIT
    assert await ContactRequestModel.objects.acount() > asked


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
async def test_repeats_itself_and_can_forget_everything(tmp_path: Path) -> None:
    first = await _seed(tmp_path / "first.json")
    counts = await _counts()

    second = await _seed(tmp_path / "second.json")

    assert await _counts() == counts
    assert [ride.slug for ride in second.rides] == [ride.slug for ride in first.rides]
    assert second.candidates_by_verdict == first.candidates_by_verdict

    await _run("--yes-i-know", "--forget")

    assert await _counts() == (0, 0, 0, 0, 0)
