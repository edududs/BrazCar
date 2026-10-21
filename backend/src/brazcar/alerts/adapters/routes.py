"""A person's alerts: "warn me when a ride with seats appears" (D-175). Reading one's own alerts is
not a write, so an account held until it confirms its e-mail still reads them; creating and deleting
go through the write gate (D-168)."""

from datetime import date, datetime, time
from http import HTTPStatus
from typing import Self
from uuid import UUID

from django.http import HttpRequest
from ninja import Field, Router, Schema
from ninja.errors import HttpError
from ninja.responses import Status
from ninja.security.base import AuthBase
from pydantic import ValidationError

from brazcar.alerts.application import CreateAlert, DeleteAlert, ListAlerts
from brazcar.alerts.domain import (
    TEXT_LIMIT,
    AlertDayPastError,
    AlertLimitError,
    AlertNotFoundError,
    AlertWindowError,
    RideAlert,
)
from brazcar.shared.adapters.api_errors import with_errors
from brazcar.shared.adapters.session_auth import session_auth, signed_in_account_id


class AlertIn(Schema):
    text: str | None = Field(default=None, max_length=TEXT_LIMIT)  # "passa por", as the board's `q`
    day: date
    from_time: time | None = None
    until_time: time | None = None


class AlertOut(Schema):
    id: UUID
    text: str | None
    day: date
    from_time: time | None
    until_time: time | None
    created_at: datetime

    @classmethod
    def of(cls, alert: RideAlert) -> Self:
        return cls(
            id=alert.id,
            text=alert.text,
            day=alert.day,
            from_time=alert.from_time,
            until_time=alert.until_time,
            created_at=alert.created_at,
        )


def build_router(
    create: CreateAlert, list_alerts: ListAlerts, delete: DeleteAlert, writer: AuthBase
) -> Router:
    """`writer`: an account held until it confirms its e-mail gets 403 (D-168)."""
    router = Router(tags=["alerts"])

    @router.get(
        "",
        response=with_errors(list[AlertOut], unauthorized=True),
        auth=session_auth,
        operation_id="list_alerts",
    )
    async def list_my_alerts(request: HttpRequest) -> list[AlertOut]:
        """The account's alerts that have not ended, by day and creation."""
        alerts = await list_alerts(signed_in_account_id(request))
        return [AlertOut.of(alert) for alert in alerts]

    @router.post(
        "",
        response=with_errors({HTTPStatus.CREATED: AlertOut}, unauthorized=True, held=True, validation=True),
        auth=writer,
        operation_id="create_alert",
    )
    async def create_my_alert(request: HttpRequest, data: AlertIn) -> Status[AlertOut]:
        """Ask to be warned of a ride with seats on a day, optionally through a place and in a window."""
        try:
            alert = await create(
                signed_in_account_id(request),
                text=data.text,
                day=data.day,
                from_time=data.from_time,
                until_time=data.until_time,
            )
        except AlertDayPastError as error:
            raise HttpError(
                HTTPStatus.UNPROCESSABLE_CONTENT, "escolha hoje ou um dia que ainda não passou"
            ) from error
        except AlertWindowError as error:
            raise HttpError(
                HTTPStatus.UNPROCESSABLE_CONTENT, "o fim do horário não pode vir antes do começo"
            ) from error
        except AlertLimitError as error:
            raise HttpError(
                HTTPStatus.UNPROCESSABLE_CONTENT,
                f"você já tem {error.limit} avisos ativos; apague um para criar outro",
            ) from error
        except ValidationError as error:
            raise HttpError(HTTPStatus.UNPROCESSABLE_CONTENT, "confira os dados do aviso") from error
        return Status(HTTPStatus.CREATED, AlertOut.of(alert))

    @router.delete(
        "/{alert_id}",
        response=with_errors(
            {HTTPStatus.NO_CONTENT: None},
            unauthorized=True,
            held=True,
            not_found=True,
            validation=True,
        ),
        auth=writer,
        operation_id="delete_alert",
    )
    async def delete_my_alert(request: HttpRequest, alert_id: UUID) -> Status[None]:
        """Drop one of the account's own alerts; another account's reads as missing."""
        try:
            await delete(signed_in_account_id(request), alert_id)
        except AlertNotFoundError as error:
            raise HttpError(HTTPStatus.NOT_FOUND, "aviso não encontrado") from error
        return Status(HTTPStatus.NO_CONTENT, None)

    return router
