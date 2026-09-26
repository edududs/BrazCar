"""`manage.py seed_demo` (D-133): where it refuses, what it promises, and that it repeats itself.

Seeding is not cheap, so the promises are checked together on one run instead of one run apiece.
"""

from datetime import UTC, datetime
from http import HTTPStatus
from io import StringIO
from pathlib import Path

import pytest
from asgiref.sync import sync_to_async
from django.core.management import call_command
from django.core.management.base import CommandError
from django.http import HttpResponse

from brazcar.accounts.adapters.composition import issue_invite
from brazcar.accounts.adapters.models import InviteModel, User
from brazcar.demo.adapters import dataset as data
from brazcar.demo.adapters.seeding import DemoManifest
from brazcar.feedback.adapters.models import FeedbackModel
from brazcar.feedback.adapters.repository import DjangoFeedbackBox
from brazcar.feedback.domain import Feedback, FeedbackKind
from brazcar.importing.adapters.models import BlockedSenderModel, CandidateModel, SourceMessageModel
from brazcar.rides.adapters.models import ContactRequestModel, RideModel
from brazcar.rides.domain import NOTES_LIMIT, RideStatus
from brazcar.shared.domain.phone import PhoneNumber
from tests.accounts.test_routes import FRONT, Browser, body

CONTACT_LIMIT = 20  # `RideRules.contact_limit` by default (D-097)
DAYS = 3  # hoje, amanhã e outro dia
SUITE_PASSWORD = "correct horse battery"  # forte o bastante para os validadores do Django


@pytest.fixture(autouse=True)
def _front_origin(settings: object) -> None:
    setattr(settings, "CORS_ALLOWED_ORIGINS", [FRONT])  # noqa: B010 - pytest-django's settings proxy


async def _run(*args: str) -> None:
    # The command opens a loop of its own, so it may not share this one's single thread executor.
    await sync_to_async(call_command, thread_sensitive=False)("seed_demo", *args, stdout=StringIO())


def _read(manifest: Path) -> DemoManifest:
    return DemoManifest.model_validate_json(manifest.read_text(encoding="utf-8"))


async def _seed(manifest: Path) -> DemoManifest:
    await sync_to_async(call_command, thread_sensitive=False)("sync_places", stdout=StringIO())
    await _run("--yes-i-know", "--manifest", str(manifest))
    return await sync_to_async(_read, thread_sensitive=False)(manifest)


async def _counts() -> tuple[int, int, int, int, int, int]:
    return (
        await User.objects.acount(),
        await RideModel.objects.acount(),
        await CandidateModel.objects.acount(),
        await SourceMessageModel.objects.acount(),
        await ContactRequestModel.objects.acount(),
        await InviteModel.objects.acount(),
    )


def test_the_longest_note_is_exactly_the_limit() -> None:
    assert len(data.LONG_NOTES) == NOTES_LIMIT


def test_the_demonstration_phones_are_invented_and_all_different() -> None:
    phones = (
        [person.phone for person in data.PEOPLE] + list(data.SUITE_PHONES) + list(data.SUITE_LEGACY_PHONES)
    )

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

    # Contas: uma de cada feitio (D-133), mais as antigas reservadas para a suíte (D-168).
    assert len(seeded.accounts) == len(data.PEOPLE)
    assert await User.objects.acount() == len(data.PEOPLE) + len(data.SUITE_LEGACY_PHONES)
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

    # Convites: um por telefone reservado, alinhado por índice (D-166, D-167).
    assert [invite.phone for invite in seeded.suite_invites] == list(data.SUITE_PHONES)
    assert len({invite.invite_token for invite in seeded.suite_invites}) == len(data.SUITE_PHONES)
    assert len({invite.email_token for invite in seeded.suite_invites}) == len(data.SUITE_PHONES)
    assert await InviteModel.objects.acount() == len(data.SUITE_PHONES)

    # Conta antiga: a única sem e-mail, e não é usada para escrever em nenhuma jornada da suíte.
    assert seeded.legacy_person == data.DRIVER_NO_CAR.slug
    with_email = {person.slug for person in data.PEOPLE if person.email is not None}
    assert with_email == {account.slug for account in seeded.accounts} - {seeded.legacy_person}

    # Contas antigas da própria suíte: uma por projeto x tentativa, sem e-mail (D-168).
    assert seeded.suite_legacy_phones == data.SUITE_LEGACY_PHONES
    assert len(seeded.suite_legacy_phones) == data.SUITE_PROJECTS * data.SUITE_ATTEMPTS
    assert await User.objects.filter(phone__in=data.SUITE_LEGACY_PHONES, email__isnull=True).acount() == len(
        data.SUITE_LEGACY_PHONES
    )


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

    assert await _counts() == (0, 0, 0, 0, 0, 0)


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
async def test_an_opinion_sent_by_a_seeded_account_does_not_block_forgetting(tmp_path: Path) -> None:
    """The end to end suite sends one; the opinion points at the account with `PROTECT`."""
    seeded = await _seed(tmp_path / "manifest.json")
    author = seeded.account(data.DRIVER_ONE_CAR.slug)
    opinion = Feedback.send(
        author_id=author.id,
        kind=FeedbackKind.COMPLAINT,
        message="Não apareceu.",
        about_phone=PhoneNumber.parse("+5561999990002"),
        web_version="0.20.2",
        at=datetime.now(UTC),
    )
    await DjangoFeedbackBox().keep(opinion)

    await _run("--yes-i-know", "--forget")

    assert await FeedbackModel.objects.acount() == 0
    assert await User.objects.acount() == 0


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
async def test_a_suite_invites_email_token_opens_the_signup_page_and_registers(tmp_path: Path) -> None:
    """What the suite itself would do with the manifest's first spare invite (D-166, D-167)."""
    seeded = await _seed(tmp_path / "manifest.json")
    invite = seeded.suite_invites[0]
    client = Browser()

    opened = await client.get(f"/api/accounts/signup/{invite.email_token}")
    registered = await client.post(
        "/api/accounts/register",
        {
            "email_token": invite.email_token,
            "display_name": "Conta da Suíte",
            "password": SUITE_PASSWORD,
            "accepts_terms": True,
        },
    )
    me = await client.get("/api/accounts/me")

    assert opened.status_code == HTTPStatus.OK
    assert body(opened)["email"] == invite.email
    assert registered.status_code == HTTPStatus.CREATED
    assert body(registered)["email"] == invite.email
    assert body(registered)["email_confirmed"] is True
    assert body(registered)["phone"] == invite.phone
    assert me.status_code == HTTPStatus.OK
    assert body(me)["required_action"] is None


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
async def test_only_the_legacy_person_is_held_from_writing(tmp_path: Path) -> None:
    """The seeded account without a confirmed e-mail is 403 with `required_action`; the others
    that the suite signs in to write with are not (D-168)."""
    seeded = await _seed(tmp_path / "manifest.json")
    car = {"model": "Fiesta", "color": "azul", "plate": "DEM8Y88"}

    async def add_car(slug: str) -> HttpResponse:
        account = seeded.account(slug)
        client = Browser()
        signed_in = await client.post(
            "/api/accounts/login", {"phone": account.phone, "password": account.password}
        )
        assert signed_in.status_code == HTTPStatus.OK, signed_in.content
        return await client.post("/api/accounts/cars", car)

    held = await add_car(seeded.legacy_person)
    writing = await add_car(data.DRIVER_TWO_CARS.slug)

    assert held.status_code == HTTPStatus.FORBIDDEN
    assert body(held) == {"detail": "confirme seu e-mail para continuar", "required_action": "confirm_email"}
    assert writing.status_code == HTTPStatus.OK


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
async def test_the_suites_own_legacy_accounts_sign_in_and_are_held_too(tmp_path: Path) -> None:
    """One account without a confirmed e-mail per project x attempt, none of them `legacy_person`:
    the suite's own e-mail confirmation journey never touches the shared, retained account the
    screens catalogue keeps for its page (D-168)."""
    seeded = await _seed(tmp_path / "manifest.json")
    car = {"model": "Fiesta", "color": "azul", "plate": "DEM4X44"}

    for phone in seeded.suite_legacy_phones:
        client = Browser()
        signed_in = await client.post("/api/accounts/login", {"phone": phone, "password": data.PASSWORD})
        held = await client.post("/api/accounts/cars", car)

        assert signed_in.status_code == HTTPStatus.OK, signed_in.content
        assert held.status_code == HTTPStatus.FORBIDDEN
        assert body(held) == {
            "detail": "confirme seu e-mail para continuar",
            "required_action": "confirm_email",
        }


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
async def test_the_invite_email_step_writes_the_signup_link_to_a_file(
    tmp_path: Path, settings: object
) -> None:
    """What the suite's server does when the environment points `EMAIL_BACKEND` at Django's own
    filebased backend and gives it `EMAIL_FILE_PATH` (D-133, D-134): the front's fixture reads the
    registration link off that file, because `mail.outbox` only exists inside this test process."""
    email_dir = tmp_path / "outbox"
    email_dir.mkdir()
    setattr(settings, "EMAIL_BACKEND", "django.core.mail.backends.filebased.EmailBackend")  # noqa: B010
    setattr(settings, "EMAIL_FILE_PATH", str(email_dir))  # noqa: B010
    _, token = await issue_invite()(phone="61 99999-0098")
    client = Browser()

    given = await client.post(f"/api/accounts/invites/{token}/email", {"email": "leitor@example.com"})

    assert given.status_code == HTTPStatus.ACCEPTED
    written = list(email_dir.iterdir())
    assert len(written) == 1
    assert "cadastro?token=" in written[0].read_text(encoding="utf-8")
