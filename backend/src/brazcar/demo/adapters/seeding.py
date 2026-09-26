"""Filling a database with one ride of every situation, for the screens catalogue (D-133).

Everything is written through the use cases and the ports of each context: this module never
touches a table. The only thing it replaces is the interpreter — the verdicts of the imported
candidates are written by hand, so the seed needs no Ollama and always says the same (D-115).

Time is relative to one anchor, the moment the seed runs, so the same situations come out at any
hour of the day. What varies between runs is the clock on the screen, never which ride is open,
full, reopened, cancelled or already gone.
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from brazcar.accounts.application import AccountRepository, AddCar, Credentials, IssueInvite
from brazcar.accounts.domain import Account, account_phone
from brazcar.importing.application import BlockSender, Candidates, IngestMessages, SourceMessages
from brazcar.importing.domain import (
    Accepted,
    Candidate,
    Failed,
    Rejected,
    RejectReason,
    Sender,
    SourceMessage,
)
from brazcar.rides.application import CancelRide, ChangeSeats, EditRide, PublishRide, RepeatRide
from brazcar.rides.application import ImportRide as ImportRideUseCase
from brazcar.rides.application import RequestContact as RequestContactUseCase
from brazcar.rides.domain import (
    DEFAULT_PRICE,
    CatalogStop,
    ExternalDriver,
    FreeTextStop,
    PaymentMethod,
    RideOffer,
    Route,
    Stop,
    WhatsAppOrigin,
)
from brazcar.shared.domain.model import FrozenModel
from brazcar.shared.domain.personal_data import redact_personal_data
from brazcar.shared.domain.phone import PhoneNumber

from . import dataset as data

CASH = frozenset({PaymentMethod.CASH})
PIX = frozenset({PaymentMethod.PIX})
BOTH = frozenset({PaymentMethod.CASH, PaymentMethod.PIX})

MINUTE = timedelta(minutes=1)
MAX_ATTEMPTS = 5  # the ceiling the sweep uses (D-112); here only to read every pending candidate


class Schedule:
    """Minutes from the anchor. Kept apart so a test can read the intent without a database."""

    DEPARTED = -180
    OPEN_SIMPLE = 120
    IMPORTED_EXTERNAL = 150
    OPEN_NOTES = 180
    IMPORTED_FARES = 210
    OPEN_FARES = 240
    IMPORTED_OWNED = 270
    FULL = 300
    OPEN_LONG_NOTES = 330
    REOPENED = 360
    CANCELLED = 420
    TOMORROW_EDITED = 26 * 60
    TOMORROW_EDITED_DELAYED = 26 * 60 + 30
    # Kept under 27h on purpose: at 27h or more, an anchor already late in the evening (21h or
    # past it) pushes the departure past a *second* midnight, so "tomorrow" becomes some third
    # calendar day and the seed no longer covers exactly three days (D-133, seen in practice
    # when the seed ran at 21h and both landed on the same extra day).
    TOMORROW_MANY_STOPS = 26 * 60 + 40
    TOMORROW_REPEATED = 26 * 60 + 50
    OTHER_DAY = 74 * 60


# --- what comes out ------------------------------------------------------------------------------


class SeededAccount(FrozenModel):
    slug: str
    id: UUID
    phone: str
    display_name: str
    password: str
    cars: tuple[UUID, ...] = ()


class SeededRide(FrozenModel):
    slug: str
    id: UUID
    driver: str  # the slug of the account, or the WhatsApp name of an external driver
    departure_at: datetime
    day: date
    status: str
    origin: str
    on_board: bool  # whether the public board lists it: cancelled and departed rides never are


class SeededInvite(FrozenModel):
    """One invite issued for a `suite_phones` entry, its e-mail already given (D-166, D-167): the
    suite finishes the registration itself, `POST /api/accounts/register` with `email_token`."""

    phone: str
    invite_token: str
    email: str
    email_token: str


class DemoManifest(FrozenModel):
    """What the seed made, for whoever drives the screens afterwards.

    Identifiers are born in the domain, so they change between runs; the slugs do not. The end to
    end suite reads this file instead of carrying constants that would rot.
    """

    anchor: datetime
    days: tuple[date, ...]  # the departure days the board shows, earliest first
    group_labels: tuple[str, ...]
    suite_phones: tuple[str, ...]  # free numbers the suite may register itself
    suite_invites: tuple[SeededInvite, ...]  # one per `suite_phones`, aligned by index (D-166, D-167)
    suite_legacy_phones: tuple[str, ...]
    """One seeded account without a confirmed e-mail per project x attempt (D-168), aligned by the
    same index the suite uses for `suitePhoneAt` at `journey = 0` — no journey factor, since these
    accounts exist already and are not signed up by a test. Own accounts for the suite's e-mail
    confirmation journey, so it never contends with the shared, retained `legacy_person`."""
    legacy_person: str  # slug of the one seeded account still without a confirmed e-mail (D-168)
    accounts: tuple[SeededAccount, ...]
    rides: tuple[SeededRide, ...]
    candidates_by_verdict: dict[str, int]

    def account(self, slug: str) -> SeededAccount:
        return next(account for account in self.accounts if account.slug == slug)

    def ride(self, slug: str) -> SeededRide:
        return next(ride for ride in self.rides if ride.slug == slug)


# --- what goes in --------------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class DemoWiring:
    """Every use case and port the seed drives. Built by `wiring.py` from the Django adapters."""

    accounts: AccountRepository
    credentials: Credentials
    add_car: AddCar
    issue_invite: IssueInvite  # its own `invites` repository and clock come along with it
    publish: PublishRide
    edit: EditRide
    change_seats: ChangeSeats
    cancel: CancelRide
    repeat: RepeatRide
    import_ride: ImportRideUseCase
    contact: RequestContactUseCase
    messages: SourceMessages
    ingest: IngestMessages
    candidates: Candidates
    block: BlockSender
    contact_limit: int  # `RideRules.contact_limit`, so one account can spend exactly all of it
    departure_tolerance: timedelta  # `RideRules.departure_tolerance`, to read the status back


@dataclass(frozen=True, slots=True)
class _SeedResult:
    """What each step of `seed` produced, gathered in one piece so `_manifest` reads it, not six
    separate parameters (PLR0913)."""

    accounts: dict[str, Account]
    rides: dict[str, RideOffer]
    verdicts: dict[str, int]
    suite_invites: tuple[SeededInvite, ...]


async def seed(wiring: DemoWiring, *, anchor: datetime) -> DemoManifest:
    """Write the whole demonstration. The caller has already emptied what a previous run left.

    `anchor` is the moment everything is counted from, in the board's own zone (D-094), so that a
    day of a departure is the day the board shows.
    """
    accounts = {person.slug: await _register(wiring, person, anchor=anchor) for person in data.PEOPLE}
    await _suite_legacy_accounts(wiring, anchor=anchor)
    rides = await _published(wiring, accounts, anchor=anchor)
    rides |= await _imported(wiring, anchor=anchor)
    await _contacts(wiring, accounts, rides)
    verdicts = await _group_traffic(wiring, rides, anchor=anchor)
    suite_invites = await _suite_invites(wiring)
    result = _SeedResult(accounts=accounts, rides=rides, verdicts=verdicts, suite_invites=suite_invites)
    return _manifest(result, anchor=anchor, tolerance=wiring.departure_tolerance)


# --- accounts ------------------------------------------------------------------------------------


async def _register(wiring: DemoWiring, person: data.DemoPerson, *, anchor: datetime) -> Account:
    """Through the accounts' ports, not the invite: its e-mail link has nobody to reach here (D-167).
    A person with an e-mail reads as someone who came by invite; one without, as an account from
    before the invite, the way the migration left them."""
    account = (
        Account.register_from_invite(
            phone=account_phone(person.phone),
            email=person.email,
            display_name=person.display_name,
            now=anchor,
        )
        if person.email is not None
        else Account.register(
            phone=person.phone, display_name=person.display_name, email=None, accepted_terms_at=anchor
        )
    )
    await wiring.accounts.save(account)
    await wiring.credentials.register(account.id, data.PASSWORD)
    for car in person.cars:
        account = await wiring.add_car(account.id, model=car.model, color=car.color, plate=car.plate)
    return account


async def _suite_legacy_accounts(wiring: DemoWiring, *, anchor: datetime) -> None:
    """`SUITE_LEGACY_PHONES`, made the same way as `driver_no_car` (D-168): through
    `Account.register`, no e-mail and no car, so each stays held until it confirms one. The end to
    end suite reads their phones back from the manifest, never their identifiers: nothing else of
    theirs is worth naming."""
    for index, phone in enumerate(data.SUITE_LEGACY_PHONES):
        account = Account.register(
            phone=phone,
            display_name=f"Conta antiga da suíte {index}",
            email=None,
            accepted_terms_at=anchor,
        )
        await wiring.accounts.save(account)
        await wiring.credentials.register(account.id, data.PASSWORD)


async def _suite_invites(wiring: DemoWiring) -> tuple[SeededInvite, ...]:
    """One invite per phone the end to end suite may register (D-166): issued and given an e-mail
    straight through the domain, `Invite.give_email`, so no mailer is asked to send anything nobody
    reads. Both tokens are the domain's own random ones; the manifest is the only place they travel
    in the clear. Issued against `wiring.issue_invite`'s own clock — the real one, not `anchor` — so
    the invite (four hours) and its e-mail link (two) are still good however long the suite runs."""
    issue = wiring.issue_invite
    seeded: list[SeededInvite] = []
    for index, phone in enumerate(data.SUITE_PHONES):
        invite, invite_token = await issue(phone=phone)
        email = f"suite-{index}@example.com"
        waiting, email_token = invite.give_email(email, issue.clock.now(), issue.policy)
        await issue.invites.save(waiting)
        seeded.append(
            SeededInvite(phone=phone, invite_token=invite_token, email=email, email_token=email_token)
        )
    return tuple(seeded)


# --- published rides -----------------------------------------------------------------------------


async def _published(
    wiring: DemoWiring, accounts: dict[str, Account], *, anchor: datetime
) -> dict[str, RideOffer]:
    ana = accounts[data.DRIVER_ONE_CAR.slug]
    carlos = accounts[data.DRIVER_TWO_CARS.slug]
    maria = accounts[data.LONG_NAME.slug]
    rides: dict[str, RideOffer] = {}

    rides["open_today_simple"] = await wiring.publish(
        ana.id,
        car_id=ana.cars[0].id,
        route=_catalog("brazlandia", "esplanada"),
        departure_at=_at(anchor, Schedule.OPEN_SIMPLE),
        seats_available=3,
        payment_methods=BOTH,
    )
    rides["open_today_notes"] = await wiring.publish(
        ana.id,
        car_id=ana.cars[0].id,
        route=(
            CatalogStop(place_id="veredas"),
            FreeTextStop(text=data.FREE_TEXT_STOP),
            CatalogStop(place_id="rodoviaria-do-plano"),
        ),
        departure_at=_at(anchor, Schedule.OPEN_NOTES),
        seats_available=2,
        price=Decimal("9.00"),
        payment_methods=PIX,
        notes=data.SHORT_NOTES,
    )
    rides["open_today_fares"] = await wiring.publish(
        carlos.id,
        car_id=carlos.cars[0].id,
        route=tuple(CatalogStop(place_id=place, fare=fare) for place, fare in data.FARE_ROUTE),
        departure_at=_at(anchor, Schedule.OPEN_FARES),
        seats_available=4,
        payment_methods=BOTH,
    )
    rides["open_today_long_notes"] = await wiring.publish(
        ana.id,
        car_id=ana.cars[0].id,
        route=_catalog("brazlandia", "setor-bancario-sul"),
        departure_at=_at(anchor, Schedule.OPEN_LONG_NOTES),
        seats_available=4,
        payment_methods=BOTH,
        notes=data.LONG_NOTES,
    )
    full = await wiring.publish(
        carlos.id,
        car_id=carlos.cars[1].id,
        route=_catalog("setor-tradicional", "setor-comercial-sul"),
        departure_at=_at(anchor, Schedule.FULL),
        seats_available=2,
        payment_methods=CASH,
    )
    rides["full_today"] = await wiring.change_seats(carlos.id, full.id, 0)

    reopened = await wiring.publish(
        ana.id,
        car_id=ana.cars[0].id,
        route=_catalog("ouro-verde", "torre-de-tv"),
        departure_at=_at(anchor, Schedule.REOPENED),
        seats_available=2,
        payment_methods=BOTH,
    )
    await wiring.change_seats(ana.id, reopened.id, 0)
    rides["reopened_today"] = await wiring.change_seats(ana.id, reopened.id, 2)

    cancelled = await wiring.publish(
        ana.id,
        car_id=ana.cars[0].id,
        route=_catalog("rodeador", "unb"),
        departure_at=_at(anchor, Schedule.CANCELLED),
        seats_available=2,
        payment_methods=PIX,
    )
    rides["cancelled_today"] = await wiring.cancel(ana.id, cancelled.id)

    rides["departed_earlier"] = await wiring.publish(
        ana.id,
        car_id=ana.cars[0].id,
        route=_catalog("vila-sao-jose", "ceilandia"),
        departure_at=_at(anchor, Schedule.DEPARTED),
        seats_available=2,
        payment_methods=CASH,
    )

    # A ride with a history worth reading: edited, seats moved, then put off half an hour (D-018).
    edited = await wiring.publish(
        ana.id,
        car_id=ana.cars[0].id,
        route=_catalog("fassincra", "parque-da-cidade"),
        departure_at=_at(anchor, Schedule.TOMORROW_EDITED),
        seats_available=3,
        payment_methods=BOTH,
    )
    edited = await wiring.edit(ana.id, edited.id, price=Decimal("8.50"), notes=data.SHORT_NOTES)
    edited = await wiring.change_seats(ana.id, edited.id, 2)
    rides["tomorrow_edited"] = await wiring.edit(
        ana.id, edited.id, departure_at=_at(anchor, Schedule.TOMORROW_EDITED_DELAYED)
    )

    rides["tomorrow_many_stops"] = await wiring.publish(
        carlos.id,
        car_id=carlos.cars[0].id,
        route=_catalog(*data.MANY_STOPS),
        departure_at=_at(anchor, Schedule.TOMORROW_MANY_STOPS),
        seats_available=4,
        payment_methods=BOTH,
    )
    rides["tomorrow_repeated"] = await wiring.repeat(
        ana.id, rides["open_today_simple"].id, departure_at=_at(anchor, Schedule.TOMORROW_REPEATED)
    )
    rides["other_day"] = await wiring.publish(
        maria.id,
        car_id=maria.cars[0].id,
        route=_catalog("brazlandia", "buriti"),
        departure_at=_at(anchor, Schedule.OTHER_DAY),
        seats_available=1,
        payment_methods=CASH,
    )
    return rides


# --- imported rides ------------------------------------------------------------------------------


async def _imported(wiring: DemoWiring, *, anchor: datetime) -> dict[str, RideOffer]:
    """Three rides read from the groups (ADR-0015): plain, with fares, and one an account owns."""
    external = await wiring.import_ride(
        sender_phone=PhoneNumber.from_jid_user(data.SENDER_EXTERNAL.phone),
        sender_name=data.SENDER_EXTERNAL.display_name,
        origin=_origin(data.MESSAGE_EXTERNAL, anchor=anchor, minutes=-45),
        route=_catalog("setor-tradicional", "esplanada"),
        departure_at=_at(anchor, Schedule.IMPORTED_EXTERNAL),
        seats_available=3,
        price=DEFAULT_PRICE,
        payment_methods=CASH,
    )
    with_fares = await wiring.import_ride(
        sender_phone=PhoneNumber.from_jid_user(data.SENDER_FARES.phone),
        sender_name=data.SENDER_FARES.display_name,
        origin=_origin(data.MESSAGE_WITH_FARES, anchor=anchor, minutes=-40),
        route=(
            CatalogStop(place_id="vila-sao-jose"),
            CatalogStop(place_id="estrutural", fare=Decimal("7.00")),
            CatalogStop(place_id="sia", fare=Decimal("9.00")),
            CatalogStop(place_id="esplanada", fare=Decimal("12.00")),
        ),
        departure_at=_at(anchor, Schedule.IMPORTED_FARES),
        seats_available=2,
        price=DEFAULT_PRICE,
        payment_methods=BOTH,
    )
    owned = await wiring.import_ride(
        sender_phone=PhoneNumber.from_jid_user(data.SENDER_WITH_ACCOUNT.phone),
        sender_name=data.SENDER_WITH_ACCOUNT.display_name,
        origin=_origin(data.MESSAGE_FROM_ACCOUNT, anchor=anchor, minutes=-35),
        route=_catalog("rodeador", "rodoviaria-do-plano"),
        departure_at=_at(anchor, Schedule.IMPORTED_OWNED),
        seats_available=2,
        price=DEFAULT_PRICE,
        payment_methods=BOTH,
    )
    return {
        "imported_external": external.ride,
        "imported_fares": with_fares.ride,
        "imported_owned": owned.ride,
    }


def _origin(text: str, *, anchor: datetime, minutes: int) -> WhatsAppOrigin:
    """The words as the group saw them, redacted exactly as the importing redacts them (D-128)."""
    return WhatsAppOrigin(
        message_text=redact_personal_data(text),
        group_label=data.GROUP_LABEL,
        sent_at=_at(anchor, minutes),
    )


# --- contact requests ----------------------------------------------------------------------------


async def _contacts(wiring: DemoWiring, accounts: dict[str, Account], rides: dict[str, RideOffer]) -> None:
    """One account with a couple of requests, another with the day's whole allowance spent (D-097)."""
    passenger = accounts[data.PASSENGER.slug]
    await wiring.contact(passenger.id, rides["open_today_simple"].id)
    await wiring.contact(passenger.id, rides["open_today_fares"].id)
    await wiring.contact(passenger.id, rides["imported_external"].id)

    spent = accounts[data.LONG_NAME.slug]
    open_rides = [rides["open_today_simple"].id, rides["open_today_notes"].id, rides["reopened_today"].id]
    for index in range(wiring.contact_limit):
        await wiring.contact(spent.id, open_rides[index % len(open_rides)])


# --- group traffic -------------------------------------------------------------------------------


async def _group_traffic(
    wiring: DemoWiring, rides: dict[str, RideOffer], *, anchor: datetime
) -> dict[str, int]:
    """Messages, candidates and one verdict of every kind, so `manage.py candidates` has a page."""
    postings = _postings(anchor=anchor)
    for message in postings:
        await wiring.messages.save(message)
    await wiring.ingest(limit=len(postings) + 1)

    judged_at = anchor - 20 * MINUTE
    verdicts: dict[str, int] = {}
    for candidate in await wiring.candidates.pending(len(postings), max_attempts=MAX_ATTEMPTS):
        verdict = _verdict(candidate, rides)
        if verdict is None:
            verdicts["pending"] = verdicts.get("pending", 0) + 1
            continue
        await wiring.candidates.save(candidate.judge(verdict, at=judged_at))
        verdicts[verdict.kind] = verdicts.get(verdict.kind, 0) + 1
    await wiring.block(PhoneNumber.from_jid_user(data.SENDER_BLOCKED.phone))
    return verdicts


def _postings(*, anchor: datetime) -> tuple[SourceMessage, ...]:
    """One message per situation, plus the same posting in a second group: one candidate, two sources."""
    said = [
        (data.SENDER_EXTERNAL, data.MESSAGE_EXTERNAL, data.GROUP_JID),
        (data.SENDER_EXTERNAL, data.MESSAGE_EXTERNAL, data.GROUP_JID_SECOND),
        (data.SENDER_FARES, data.MESSAGE_WITH_FARES, data.GROUP_JID),
        (data.SENDER_WITH_ACCOUNT, data.MESSAGE_FROM_ACCOUNT, data.GROUP_JID),
        (data.SENDER_FARES, data.MESSAGE_PENDING, data.GROUP_JID_SECOND),
        (data.SENDER_NOISE, data.MESSAGE_NOT_AN_OFFER, data.GROUP_JID),
        (data.SENDER_NOISE, data.MESSAGE_NO_TIME, data.GROUP_JID),
        (data.SENDER_NOISE, data.MESSAGE_NO_SEATS, data.GROUP_JID),
        (data.SENDER_NOISE, data.MESSAGE_FEW_STOPS, data.GROUP_JID),
        (data.SENDER_NOISE, data.MESSAGE_LOW_CONFIDENCE, data.GROUP_JID_SECOND),
        (data.SENDER_NOISE, data.MESSAGE_UNKNOWN_PLACE, data.GROUP_JID_SECOND),
        (data.SENDER_NOISE, data.MESSAGE_FAILED, data.GROUP_JID_SECOND),
    ]
    sent = anchor - 50 * MINUTE
    return tuple(
        SourceMessage(
            account=PhoneNumber.from_jid_user(data.WORKER_ACCOUNT),
            message_id=f"demo-{index:02d}",
            chat_jid=jid,
            sender=Sender(phone=PhoneNumber.from_jid_user(sender.phone), display_name=sender.display_name),
            sent_at=sent + index * MINUTE,
            text=text,
            received_at=sent + index * MINUTE,
        )
        for index, (sender, text, jid) in enumerate(said)
    )


def _verdict(candidate: Candidate, rides: dict[str, RideOffer]) -> Accepted | Rejected | Failed | None:
    """What the interpreter would have said. None leaves the candidate pending, as one must be."""
    accepted = {
        data.MESSAGE_EXTERNAL: "imported_external",
        data.MESSAGE_WITH_FARES: "imported_fares",
        data.MESSAGE_FROM_ACCOUNT: "imported_owned",
    }
    if candidate.text in accepted:
        return Accepted(ride_id=rides[accepted[candidate.text]].id)
    rejected = {
        data.MESSAGE_NOT_AN_OFFER: (RejectReason.NOT_AN_OFFER, None),
        data.MESSAGE_NO_TIME: (RejectReason.NO_TIME, 0.82),
        data.MESSAGE_NO_SEATS: (RejectReason.NO_SEATS, 0.74),
        data.MESSAGE_FEW_STOPS: (RejectReason.FEW_STOPS, 0.61),
        data.MESSAGE_LOW_CONFIDENCE: (RejectReason.LOW_CONFIDENCE, 0.35),
        data.MESSAGE_UNKNOWN_PLACE: (RejectReason.UNKNOWN_PLACE, 0.71),
    }
    if candidate.text in rejected:
        reason, confidence = rejected[candidate.text]
        return Rejected(reason=reason, confidence=confidence)
    if candidate.text == data.MESSAGE_FAILED:
        return Failed(error="TimeoutError: o interpretador não respondeu", attempts=2)
    return None


# --- the manifest --------------------------------------------------------------------------------


def _manifest(result: _SeedResult, *, anchor: datetime, tolerance: timedelta) -> DemoManifest:
    accounts, rides, verdicts, suite_invites = (
        result.accounts,
        result.rides,
        result.verdicts,
        result.suite_invites,
    )
    seeded = tuple(
        SeededRide(
            slug=slug,
            id=ride.id,
            driver=_driver_slug(accounts, ride),
            departure_at=ride.departure_at,
            day=ride.departure_at.date(),
            status=ride.status(anchor, tolerance),
            origin=ride.origin.kind,
            on_board=ride.cancelled_at is None and ride.departure_at >= anchor - tolerance,
        )
        for slug, ride in rides.items()
    )
    return DemoManifest(
        anchor=anchor,
        days=tuple(sorted({ride.day for ride in seeded if ride.on_board})),
        group_labels=(data.GROUP_LABEL, data.GROUP_LABEL_SECOND),
        suite_phones=data.SUITE_PHONES,
        suite_invites=suite_invites,
        suite_legacy_phones=data.SUITE_LEGACY_PHONES,
        legacy_person=data.LEGACY_PERSON,
        accounts=tuple(
            SeededAccount(
                slug=person.slug,
                id=accounts[person.slug].id,
                phone=person.phone,
                display_name=person.display_name,
                password=data.PASSWORD,
                cars=tuple(car.id for car in accounts[person.slug].cars),
            )
            for person in data.PEOPLE
        ),
        rides=seeded,
        candidates_by_verdict=verdicts,
    )


def _driver_slug(accounts: dict[str, Account], ride: RideOffer) -> str:
    if isinstance(ride.driver, ExternalDriver):
        return ride.driver.display_name
    account_id = ride.driver.account_id
    return next(slug for slug, account in accounts.items() if account.id == account_id)


# --- small helpers -------------------------------------------------------------------------------


def _at(anchor: datetime, minutes: int) -> datetime:
    return anchor + minutes * MINUTE


def _catalog(*place_ids: str) -> Route:
    stops: tuple[Stop, ...] = tuple(CatalogStop(place_id=place_id) for place_id in place_ids)
    return stops
