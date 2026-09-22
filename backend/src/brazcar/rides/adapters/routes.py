"""Rides over HTTP. The board is public; every change is the driver's; the contact is the only
way the phone and the plate leave (ADR-0006). Status and actions come computed (ADR-0011)."""

import asyncio
import json
from collections.abc import AsyncIterator, Generator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from http import HTTPStatus
from typing import Self
from uuid import UUID

from django.http import HttpRequest, StreamingHttpResponse
from ninja import Field, Query, Router, Schema
from ninja.errors import HttpError
from ninja.responses import Status
from pydantic import ValidationError

from brazcar.rides.application import (
    BoardFilter,
    BoardRevision,
    BoardRide,
    BoardSignal,
    CancelRide,
    ChangeSeats,
    EditRide,
    ListBoard,
    MyRides,
    PublishRide,
    RepeatRide,
    RequestContact,
    ShowRide,
    StopView,
)
from brazcar.rides.domain import (
    Actions,
    CatalogStop,
    ContactLimitError,
    DepartureChangeError,
    FreeTextStop,
    NoCarError,
    NotTheDriverError,
    PaymentMethod,
    RideCancelledError,
    RideError,
    RideLockedError,
    RideNotFoundError,
    RideNotOpenError,
    RideStatus,
    Route,
    Stop,
    UnknownPlaceError,
)
from brazcar.shared.adapters.session_auth import optional_account_id, session_auth
from brazcar.shared.adapters.sse import event_frame, retry_frame, sse_response

HEARTBEAT_SECONDS = 15.0  # a `ping` event, never a comment (D-077)
BROWSER_RETRY_MS = 3000


# --- what goes out ---------------------------------------------------------------------------------


class StopOut(Schema):
    place_id: str | None
    label: str

    @classmethod
    def of(cls, stop: StopView) -> Self:
        return cls(place_id=stop.place_id, label=stop.label)


class ActionsOut(Schema):
    """What the viewer may do. The front only draws these (ADR-0011)."""

    can_edit: bool
    can_change_seats: bool
    can_cancel: bool
    can_repeat: bool
    can_contact: bool
    delay_until: datetime | None

    @classmethod
    def of(cls, actions: Actions) -> Self:
        return cls(
            can_edit=actions.can_edit,
            can_change_seats=actions.can_change_seats,
            can_cancel=actions.can_cancel,
            can_repeat=actions.can_repeat,
            can_contact=actions.can_contact,
            delay_until=actions.delay_until,
        )


class RideOut(Schema):
    """The card. Never the phone, never the plate (D-031)."""

    id: UUID
    driver_name: str
    car_model: str
    car_color: str
    stops: list[StopOut]
    departure_at: datetime
    seats_available: int
    price: Decimal
    payment_methods: list[PaymentMethod]
    status: RideStatus
    actions: ActionsOut
    is_mine: bool

    @classmethod
    def of(cls, ride: BoardRide) -> Self:
        return cls(
            id=ride.id,
            driver_name=ride.driver_name,
            car_model=ride.car_model,
            car_color=ride.car_color,
            stops=[StopOut.of(stop) for stop in ride.stops],
            departure_at=ride.departure_at,
            seats_available=ride.seats_available,
            price=ride.price,
            payment_methods=list(ride.payment_methods),
            status=ride.status,
            actions=ActionsOut.of(ride.actions),
            is_mine=ride.is_mine,
        )


class ContactOut(Schema):
    whatsapp_url: str
    plate: str


class RevisionOut(Schema):
    revision: int


# --- what comes in ---------------------------------------------------------------------------------


class BoardQuery(Schema):
    """The board's filters, as the URL carries them."""

    day: date | None = None
    place_id: str | None = None
    with_seats: bool = False
    max_price: Decimal | None = Field(default=None, gt=0)


class StopIn(Schema):
    """A place of the catalog by identifier, or free text for "other" (D-013). One of the two."""

    place_id: str | None = None
    text: str | None = None


class PublishIn(Schema):
    car_id: UUID
    stops: list[StopIn] = Field(min_length=2)
    departure_at: datetime
    seats_available: int = Field(ge=1, le=8)
    price: Decimal = Field(default=Decimal("7.00"), gt=0)
    payment_methods: list[PaymentMethod] = Field(min_length=1)


class EditIn(Schema):
    """Absent means unchanged."""

    stops: list[StopIn] | None = Field(default=None, min_length=2)
    departure_at: datetime | None = None
    price: Decimal | None = Field(default=None, gt=0)
    payment_methods: list[PaymentMethod] | None = Field(default=None, min_length=1)


class SeatsIn(Schema):
    seats_available: int = Field(ge=0, le=8)


class RepeatIn(Schema):
    departure_at: datetime


@dataclass(frozen=True, slots=True)
class RideUseCases:
    board: ListBoard
    mine: MyRides
    show: ShowRide
    publish: PublishRide
    edit: EditRide
    change_seats: ChangeSeats
    cancel: CancelRide
    repeat: RepeatRide
    contact: RequestContact
    revision: BoardRevision
    signal: BoardSignal


def build_router(use_cases: RideUseCases) -> Router:
    router = Router(tags=["rides"])
    _add_board_routes(router, use_cases)
    _add_driver_routes(router, use_cases)
    _add_contact_route(router, use_cases)
    return router


def _add_board_routes(router: Router, use_cases: RideUseCases) -> None:
    """Public. A signed-in viewer gets their own actions; nobody gets a phone or a plate."""

    @router.get("", response=list[RideOut], operation_id="list_board")
    async def list_board(request: HttpRequest, filters: Query[BoardQuery]) -> list[RideOut]:
        """Rides still to depart, earliest first, filtered; a place filter includes what is beneath it."""
        viewer = await optional_account_id(request)
        wanted = BoardFilter(
            day=filters.day,
            place_id=filters.place_id or None,
            with_seats=filters.with_seats,
            max_price=filters.max_price,
        )
        return [RideOut.of(ride) for ride in await use_cases.board(wanted, viewer)]

    @router.get("/revision", response=RevisionOut, operation_id="get_board_revision")
    async def get_revision(request: HttpRequest) -> RevisionOut:
        return RevisionOut(revision=await use_cases.revision.current())

    @router.get("/signal", include_in_schema=False)
    async def stream_signal(request: HttpRequest) -> StreamingHttpResponse:
        """SSE: `revision` when the board changes, `ping` every 15s (ADR-0010, D-077). No ORM held."""
        return sse_response(_signal_frames(use_cases.signal, use_cases.revision))

    @router.get("/mine", response=list[RideOut], auth=session_auth, operation_id="list_my_rides")
    async def list_mine(request: HttpRequest) -> list[RideOut]:
        return [RideOut.of(ride) for ride in await use_cases.mine(_account_id(request))]

    @router.get("/{ride_id}", response=RideOut, operation_id="get_ride")
    async def get_ride(request: HttpRequest, ride_id: UUID) -> RideOut:
        viewer = await optional_account_id(request)
        try:
            return RideOut.of(await use_cases.show(ride_id, viewer))
        except RideNotFoundError as error:
            raise HttpError(HTTPStatus.NOT_FOUND, "carona não encontrada") from error


def _add_driver_routes(router: Router, use_cases: RideUseCases) -> None:
    """With a session, and only the driver's own rides."""

    @router.post("", response={HTTPStatus.CREATED: RideOut}, auth=session_auth, operation_id="publish_ride")
    async def publish(request: HttpRequest, data: PublishIn) -> Status[RideOut]:
        driver_id = _account_id(request)
        with _translated():
            ride = await use_cases.publish(
                driver_id,
                car_id=data.car_id,
                route=_route(data.stops),
                departure_at=data.departure_at,
                seats_available=data.seats_available,
                price=data.price,
                payment_methods=frozenset(data.payment_methods),
            )
        return Status(HTTPStatus.CREATED, RideOut.of(await use_cases.show(ride.id, driver_id)))

    @router.patch("/{ride_id}", response=RideOut, auth=session_auth, operation_id="edit_ride")
    async def edit(request: HttpRequest, ride_id: UUID, data: EditIn) -> RideOut:
        driver_id = _account_id(request)
        with _translated():
            await use_cases.edit(
                driver_id,
                ride_id,
                route=None if data.stops is None else _route(data.stops),
                departure_at=data.departure_at,
                price=data.price,
                payment_methods=None if data.payment_methods is None else frozenset(data.payment_methods),
            )
        return RideOut.of(await use_cases.show(ride_id, driver_id))

    @router.post("/{ride_id}/seats", response=RideOut, auth=session_auth, operation_id="change_seats")
    async def change_seats(request: HttpRequest, ride_id: UUID, data: SeatsIn) -> RideOut:
        """Zero closes the ride; back above zero reopens it (ADR-0003)."""
        driver_id = _account_id(request)
        with _translated():
            await use_cases.change_seats(driver_id, ride_id, data.seats_available)
        return RideOut.of(await use_cases.show(ride_id, driver_id))

    @router.post("/{ride_id}/cancel", response=RideOut, auth=session_auth, operation_id="cancel_ride")
    async def cancel(request: HttpRequest, ride_id: UUID) -> RideOut:
        """Final (D-019). To change one's mind, repeat."""
        driver_id = _account_id(request)
        with _translated():
            await use_cases.cancel(driver_id, ride_id)
        return RideOut.of(await use_cases.show(ride_id, driver_id))

    @router.post(
        "/{ride_id}/repeat",
        response={HTTPStatus.CREATED: RideOut},
        auth=session_auth,
        operation_id="repeat_ride",
    )
    async def repeat(request: HttpRequest, ride_id: UUID, data: RepeatIn) -> Status[RideOut]:
        """A new ride with this one's route, price and payment, on another departure (D-012)."""
        driver_id = _account_id(request)
        with _translated():
            ride = await use_cases.repeat(driver_id, ride_id, departure_at=data.departure_at)
        return Status(HTTPStatus.CREATED, RideOut.of(await use_cases.show(ride.id, driver_id)))


def _add_contact_route(router: Router, use_cases: RideUseCases) -> None:
    @router.post("/{ride_id}/contact", response=ContactOut, auth=session_auth, operation_id="request_contact")
    async def request_contact(request: HttpRequest, ride_id: UUID) -> ContactOut:
        """Login, a limit per account and a record: then the `wa.me` link and the plate (ADR-0006)."""
        with _translated():
            contact = await use_cases.contact(_account_id(request), ride_id)
        return ContactOut(whatsapp_url=contact.whatsapp_url, plate=contact.plate)


# --- translation -------------------------------------------------------------------------------------


@contextmanager
def _translated() -> Generator[None]:
    """Every refusal of the domain, as the HTTP status and the words the screen shows."""
    try:
        yield
    except DepartureChangeError as error:
        raise HttpError(HTTPStatus.CONFLICT, _DEPARTURE_REASONS[error.reason]) from error
    except (RideError, ValidationError) as error:
        status, words = _REFUSALS.get(
            type(error), (HTTPStatus.UNPROCESSABLE_CONTENT, "confira os dados da carona")
        )
        raise HttpError(status, words) from error


_REFUSALS: dict[type[Exception], tuple[HTTPStatus, str]] = {
    RideNotFoundError: (HTTPStatus.NOT_FOUND, "carona não encontrada"),
    NotTheDriverError: (HTTPStatus.FORBIDDEN, "só o motorista mexe nesta carona"),
    NoCarError: (HTTPStatus.UNPROCESSABLE_CONTENT, "cadastre um carro para publicar"),
    UnknownPlaceError: (HTTPStatus.UNPROCESSABLE_CONTENT, "lugar fora do catálogo"),
    RideCancelledError: (HTTPStatus.CONFLICT, "carona cancelada é definitiva; repita-a"),
    RideLockedError: (HTTPStatus.CONFLICT, "passaram duas horas do horário original; só cancelar"),
    RideNotOpenError: (HTTPStatus.CONFLICT, "esta carona não está aceitando passageiros"),
    ContactLimitError: (HTTPStatus.TOO_MANY_REQUESTS, "muitos pedidos de contato; tente depois"),
}
_DEPARTURE_REASONS = {
    DepartureChangeError.SAME_DAY: "antes de sair, o horário só muda dentro do mesmo dia",
    DepartureChangeError.ONLY_LATER: "depois de sair, a carona só pode atrasar",
    DepartureChangeError.TOO_LATE: "o atraso não passa de duas horas do horário original",
}


def _route(stops: list[StopIn]) -> Route:
    return tuple(_stop(stop) for stop in stops)


def _stop(stop: StopIn) -> Stop:
    if stop.place_id and not stop.text:
        return CatalogStop(place_id=stop.place_id)
    if stop.text and not stop.place_id:
        return FreeTextStop(text=stop.text)
    raise HttpError(HTTPStatus.UNPROCESSABLE_CONTENT, "cada parada é um lugar do catálogo ou um texto")


def _account_id(request: HttpRequest) -> UUID:
    account_id: object = getattr(request, "auth", None)  # set by ninja from `session_auth`
    assert isinstance(account_id, UUID)  # noqa: S101 - `session_auth` only ever returns a UUID
    return account_id


async def _signal_frames(signal: BoardSignal, revision: BoardRevision) -> AsyncIterator[str]:
    """The current revision at once, then each new one; a `ping` fills every quiet 15 seconds."""
    queue: asyncio.Queue[int] = asyncio.Queue()

    async def pump() -> None:
        async for number in signal.subscribe():
            await queue.put(number)

    pumping = asyncio.create_task(pump())
    try:
        yield retry_frame(BROWSER_RETRY_MS)
        yield _revision_frame(await revision.current())
        while True:
            try:
                number = await asyncio.wait_for(queue.get(), HEARTBEAT_SECONDS)
            except TimeoutError:
                yield event_frame(event="ping", data="{}")
            else:
                yield _revision_frame(number)
    finally:
        pumping.cancel()


def _revision_frame(number: int) -> str:
    return event_frame(event="revision", data=json.dumps({"revision": number}), event_id=str(number))
