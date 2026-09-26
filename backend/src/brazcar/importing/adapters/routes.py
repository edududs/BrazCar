"""The public way out of the importing (D-162, D-172): a driver whose ride came from a group asks to
be removed. No session, since that person never had an account. The answer is the same whether the
phone has rides or not; the note never comes back; the decision is taken by command."""

from http import HTTPStatus

from django.http import HttpRequest
from ninja import Field, Router, Schema
from ninja.errors import HttpError
from ninja.responses import Status
from pydantic import ValidationError

from brazcar.importing.application import RequestRemoval
from brazcar.importing.domain import NOTE_LIMIT, TooManyAttemptsError
from brazcar.shared.adapters.api_errors import with_errors
from brazcar.shared.adapters.api_schemas import Done
from brazcar.shared.adapters.client_ip import client_ip
from brazcar.shared.adapters.phone_input import INVALID_PHONE
from brazcar.shared.domain.phone import InvalidPhoneNumberError

INVALID_NOTE = f"o texto aceita até {NOTE_LIMIT} caracteres"
TOO_MANY = "muitos pedidos daqui hoje; tente amanhã"


class RemovalRequestIn(Schema):
    phone: str
    note: str | None = Field(default=None, max_length=NOTE_LIMIT)


def build_router(ask: RequestRemoval) -> Router:
    router = Router(tags=["importing"])

    @router.post(
        "",
        response=with_errors({HTTPStatus.ACCEPTED: Done}, too_many_requests=True, validation=True),
        operation_id="request_removal",
    )
    async def request_removal(request: HttpRequest, data: RemovalRequestIn) -> Status[Done]:
        """Record a removal request. 202 for every well-formed one, whether the phone has rides on
        the board or not; only the limit per client is told (429)."""
        try:
            await ask(phone=data.phone, note=data.note, client=client_ip(request))
        except InvalidPhoneNumberError as error:
            raise HttpError(HTTPStatus.UNPROCESSABLE_CONTENT, INVALID_PHONE) from error
        except ValidationError as error:
            raise HttpError(HTTPStatus.UNPROCESSABLE_CONTENT, INVALID_NOTE) from error
        except TooManyAttemptsError as error:
            raise HttpError(HTTPStatus.TOO_MANY_REQUESTS, TOO_MANY) from error
        return Status(HTTPStatus.ACCEPTED, Done())

    return router
