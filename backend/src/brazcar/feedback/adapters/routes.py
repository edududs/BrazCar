"""Sending an opinion about the app. Only a signed-in person sends; nobody reads it back over HTTP:
the team reads with `manage.py feedback` (D-155)."""

from http import HTTPStatus

from django.http import HttpRequest
from ninja import Field, Router, Schema
from ninja.errors import HttpError
from ninja.responses import Status
from ninja.security.base import AuthBase
from pydantic import ValidationError

from brazcar.feedback.application import SendFeedback
from brazcar.feedback.domain import (
    MESSAGE_LIMIT,
    VERSION_LIMIT,
    AboutSomeoneOutsideComplaintError,
    FeedbackKind,
    FeedbackLimitError,
)
from brazcar.shared.adapters.api_errors import with_errors
from brazcar.shared.adapters.phone_input import INVALID_PHONE
from brazcar.shared.adapters.session_auth import signed_in_account_id
from brazcar.shared.domain.phone import InvalidPhoneNumberError


class FeedbackIn(Schema):
    kind: FeedbackKind
    message: str = Field(max_length=MESSAGE_LIMIT)
    about_phone: str | None = None  # only in a complaint about someone
    web_version: str = Field(max_length=VERSION_LIMIT)


def build_router(send: SendFeedback, writer: AuthBase) -> Router:
    """`writer`: an account held until it confirms its e-mail gets 403 (D-168)."""
    router = Router(tags=["feedback"])

    @router.post(
        "",
        response=with_errors(
            {HTTPStatus.NO_CONTENT: None},
            unauthorized=True,
            held=True,
            too_many_requests=True,
            validation=True,
        ),
        auth=writer,
        operation_id="send_feedback",
    )
    async def send_feedback(request: HttpRequest, data: FeedbackIn) -> Status[None]:
        """Keep one opinion. A limit per account; no answer goes back to the person (D-155)."""
        try:
            await send(
                signed_in_account_id(request),
                kind=data.kind,
                message=data.message,
                about_phone=data.about_phone,
                web_version=data.web_version,
            )
        except InvalidPhoneNumberError as error:
            raise HttpError(HTTPStatus.UNPROCESSABLE_CONTENT, INVALID_PHONE) from error
        except AboutSomeoneOutsideComplaintError as error:
            raise HttpError(HTTPStatus.UNPROCESSABLE_CONTENT, "só a reclamação aponta alguém") from error
        except FeedbackLimitError as error:
            raise HttpError(HTTPStatus.TOO_MANY_REQUESTS, "muitas opiniões por hoje; tente amanhã") from error
        except ValidationError as error:
            raise HttpError(HTTPStatus.UNPROCESSABLE_CONTENT, "escreva sua opinião") from error
        return Status(HTTPStatus.NO_CONTENT, None)

    return router
