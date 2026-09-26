"""Accounts over HTTP. The session (create, destroy) is this adapter's; the rules are the use cases'."""

from dataclasses import dataclass
from datetime import datetime
from http import HTTPStatus
from typing import Literal, Self
from uuid import UUID

from asgiref.sync import sync_to_async
from django.contrib.auth import alogin, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import HttpRequest
from ninja import Router, Schema
from ninja.errors import HttpError
from ninja.responses import Status
from pydantic import ValidationError

from brazcar.accounts.application import (
    AccountRepository,
    AddCar,
    ChangePassword,
    DeleteAccount,
    GiveInviteEmail,
    InviteView,
    LogIn,
    OpenInvite,
    OpenSignup,
    RegisterFromInvite,
    RemoveCar,
    RequestPasswordReset,
    ResetPassword,
    SignupView,
    UpdateProfile,
)
from brazcar.accounts.domain import (
    Account,
    AccountError,
    Car,
    CarNotFoundError,
    EmailAlreadyRegisteredError,
    ForeignPhoneNumberError,
    InvalidCredentialsError,
    InvalidResetTokenError,
    InviteAlreadyUsedError,
    InviteConflictError,
    InviteExpiredError,
    InviteNotFoundError,
    InviteStatus,
    InviteSupersededError,
    LicensePlate,
    NotAMobilePhoneError,
    PhoneAlreadyRegisteredError,
    PlateAlreadyOnAccountError,
    ShortText,
    TooManyAttemptsError,
    WrongCurrentPasswordError,
)
from brazcar.shared.adapters.api_errors import with_errors
from brazcar.shared.adapters.phone_input import INVALID_PHONE
from brazcar.shared.adapters.session_auth import session_auth, signed_in_account_id
from brazcar.shared.domain.personal_data import masked_email
from brazcar.shared.domain.phone import InvalidPhoneNumberError

from .models import User


class CarOut(Schema):
    id: UUID
    model: str
    color: str
    plate: str  # only the owner sees it: this schema never enters a list payload (D-031)

    @classmethod
    def of(cls, car: Car) -> Self:
        return cls(id=car.id, model=car.model, color=car.color, plate=car.plate)


class AccountOut(Schema):
    """The owner's own view. Nobody else's account comes out of this API."""

    id: UUID
    phone: str  # E.164
    phone_display: str  # "(61) 99999-9999", ready to show (D-137)
    display_name: str
    email: str | None
    email_confirmed: bool  # the account came through the invite, or its e-mail was proven (D-167)
    terms_accepted_at: datetime
    cars: list[CarOut]
    can_drive: bool

    @classmethod
    def of(cls, account: Account) -> Self:
        return cls(
            id=account.id,
            phone=account.phone.e164(),
            phone_display=account.phone.display(),
            display_name=account.display_name,
            email=account.email,
            email_confirmed=account.email_confirmed,
            terms_accepted_at=account.terms_accepted_at,
            cars=[CarOut.of(car) for car in account.cars],
            can_drive=account.can_drive,
        )


class InviteOut(Schema):
    """The invite's page (D-167). Phone and e-mail come masked: a link can be forwarded."""

    status: Literal["open", "awaiting_email_confirmation"]
    phone_masked: str
    expires_at: datetime
    email_masked: str | None  # the e-mail waiting for its link, so the page can offer to retype it

    @classmethod
    def of(cls, view: InviteView) -> Self:
        awaiting = view.status is InviteStatus.AWAITING_EMAIL_CONFIRMATION
        return cls(
            status="awaiting_email_confirmation" if awaiting else "open",
            phone_masked=view.phone.masked(),
            expires_at=view.expires_at,
            email_masked=None if view.email is None else masked_email(view.email),
        )


class InviteEmailIn(Schema):
    email: str  # unconstrained here: the domain reads it, and its refusal gets its own words (D-158)


class SignupOut(Schema):
    """The e-mail link's page: the rest of the registration, phone and e-mail fixed (D-167)."""

    phone_masked: str
    email: str  # the person's own, just proven by opening the link
    email_expires_at: datetime

    @classmethod
    def of(cls, view: SignupView) -> Self:
        return cls(phone_masked=view.phone.masked(), email=view.email, email_expires_at=view.email_expires_at)


class RegisterIn(Schema):
    """No phone and no e-mail: both come from the invite the e-mail link belongs to (D-167)."""

    email_token: str
    password: str
    display_name: str
    accepts_terms: bool


class LoginIn(Schema):
    phone: str
    password: str


class CarIn(Schema):
    """Same restrictions `Car` itself enforces (D-158): ninja refuses malformed input with 422
    before `add_car` ever builds a domain object with it."""

    model: ShortText
    color: ShortText
    plate: LicensePlate


class ProfileIn(Schema):
    """Every field optional: absent means unchanged; a blank e-mail clears it (D-139)."""

    display_name: str | None = None
    email: str | None = None


class ChangePasswordIn(Schema):
    current_password: str
    new_password: str


class PasswordResetIn(Schema):
    phone: str


class PasswordResetConfirmIn(Schema):
    token: str
    password: str


class Done(Schema):
    ok: bool = True


PHONE_REFUSALS: dict[type[ValueError], str] = {  # one message per reason, in Portuguese
    InvalidPhoneNumberError: INVALID_PHONE,
    ForeignPhoneNumberError: "por enquanto só números do Brasil",
    NotAMobilePhoneError: "use um número de celular: o contato é pelo WhatsApp",
}

INVITE_NOT_FOUND = "convite não encontrado"
EMAIL_TAKEN = "este e-mail já tem conta"
INVITE_USED = "este convite já foi usado"
PHONE_TAKEN = "este telefone já tem conta"
SUPERSEDED = "este convite foi substituído por um convite mais novo"

INVITE_GONE: dict[type[AccountError], str] = {  # the invite's own link, and the e-mail step
    InviteExpiredError: "este convite venceu; peça um novo a quem convidou você",
    InviteSupersededError: SUPERSEDED,
    InviteAlreadyUsedError: INVITE_USED,
    PhoneAlreadyRegisteredError: PHONE_TAKEN,
}
EMAIL_LINK_GONE: dict[type[AccountError], str] = {  # the e-mail's link, and the registration
    InviteExpiredError: "este link venceu; abra o convite de novo e informe o e-mail",
    InviteSupersededError: SUPERSEDED,
    InviteAlreadyUsedError: INVITE_USED,
    PhoneAlreadyRegisteredError: PHONE_TAKEN,
}
GONE = (InviteExpiredError, InviteSupersededError, InviteAlreadyUsedError, PhoneAlreadyRegisteredError)
"""Every way an invite stops serving: 410 on its pages, whose link then has nothing left to do."""

ACCOUNT_FIELD_REFUSALS: dict[str, str] = {  # by the field pydantic names on `Account` itself
    "display_name": "nome social não pode ficar vazio",
    "email": "e-mail inválido",
}
"""Shared by `register` and `update_profile`: both build an `Account` from the same two fields,
so the same domain `pydantic.ValidationError` needs the same translation in either place (D-158)."""


@dataclass(frozen=True, slots=True)
class AccountUseCases:
    accounts: AccountRepository  # for "who am I", which has no rule to run
    open_invite: OpenInvite
    give_invite_email: GiveInviteEmail
    open_signup: OpenSignup
    register: RegisterFromInvite
    log_in: LogIn
    update_profile: UpdateProfile
    change_password: ChangePassword
    add_car: AddCar
    remove_car: RemoveCar
    request_password_reset: RequestPasswordReset
    reset_password: ResetPassword
    delete: DeleteAccount


def build_router(use_cases: AccountUseCases) -> Router:
    router = Router(tags=["accounts"])
    _add_invite_routes(router, use_cases)
    _add_entry_routes(router, use_cases)
    _add_own_account_routes(router, use_cases)
    _add_profile_routes(router, use_cases)
    return router


def _add_invite_routes(router: Router, use_cases: AccountUseCases) -> None:
    """Without a session: the invite's link, the e-mail step and the e-mail's link (D-167). The
    tokens travel in the path; `config/log_filters.py` keeps them out of the request log."""

    @router.get(
        "/invites/{token}",
        response=with_errors(InviteOut, not_found=True, gone=True),
        operation_id="open_invite",
    )
    async def open_invite(request: HttpRequest, token: str) -> InviteOut:
        try:
            view = await use_cases.open_invite(token=token)
        except InviteNotFoundError as error:
            raise HttpError(HTTPStatus.NOT_FOUND, INVITE_NOT_FOUND) from error
        except GONE as error:
            raise HttpError(HTTPStatus.GONE, INVITE_GONE[type(error)]) from error
        return InviteOut.of(view)

    @router.post(
        "/invites/{token}/email",
        response=with_errors(
            {HTTPStatus.ACCEPTED: Done},
            not_found=True,
            conflict=True,
            gone=True,
            too_many_requests=True,
            validation=True,
        ),
        operation_id="give_invite_email",
    )
    async def give_invite_email(request: HttpRequest, token: str, data: InviteEmailIn) -> Status[Done]:
        """Send the e-mail's link. 409 tells an invite holder the address has an account (D-167)."""
        await _give_invite_email(use_cases.give_invite_email, token, data.email)
        return Status(HTTPStatus.ACCEPTED, Done())

    @router.get(
        "/signup/{email_token}",
        response=with_errors(SignupOut, not_found=True, gone=True),
        operation_id="open_signup",
    )
    async def open_signup(request: HttpRequest, email_token: str) -> SignupOut:
        try:
            view = await use_cases.open_signup(email_token=email_token)
        except InviteNotFoundError as error:
            raise HttpError(HTTPStatus.NOT_FOUND, INVITE_NOT_FOUND) from error
        except GONE as error:
            raise HttpError(HTTPStatus.GONE, EMAIL_LINK_GONE[type(error)]) from error
        return SignupOut.of(view)


def _add_entry_routes(router: Router, use_cases: AccountUseCases) -> None:
    """Without a session: register, log in, recover the password."""

    @router.post(
        "/register",
        response=with_errors(
            {HTTPStatus.CREATED: AccountOut}, not_found=True, conflict=True, gone=True, validation=True
        ),
        operation_id="register_account",
    )
    async def register(request: HttpRequest, data: RegisterIn) -> Status[AccountOut]:
        """Finish the account the e-mail link opened and log it in. Terms must be accepted (D-033)."""
        if not data.accepts_terms:
            raise HttpError(HTTPStatus.UNPROCESSABLE_CONTENT, "os termos precisam ser aceitos")
        _check_password(data.password)
        account = await _register(use_cases.register, data)
        await _start_session(request, account)
        return Status(HTTPStatus.CREATED, AccountOut.of(account))

    @router.post(
        "/login",
        response=with_errors(AccountOut, unauthorized=True, too_many_requests=True, validation=True),
        operation_id="log_in",
    )
    async def log_in(request: HttpRequest, data: LoginIn) -> AccountOut:
        try:
            account = await use_cases.log_in(phone=data.phone, password=data.password)
        except InvalidCredentialsError as error:
            raise HttpError(HTTPStatus.UNAUTHORIZED, "telefone ou senha incorretos") from error
        except TooManyAttemptsError as error:
            raise HttpError(HTTPStatus.TOO_MANY_REQUESTS, "muitas tentativas; espere um pouco") from error
        await _start_session(request, account)
        return AccountOut.of(account)

    @router.post(
        "/password-reset", response=with_errors(Done, validation=True), operation_id="request_password_reset"
    )
    async def request_password_reset(request: HttpRequest, data: PasswordResetIn) -> Done:
        """Always `ok`: whether the phone has an account or an e-mail is not disclosed."""
        await use_cases.request_password_reset(phone=data.phone)
        return Done()

    @router.post(
        "/password-reset/confirm",
        response=with_errors(Done, bad_request=True, validation=True),
        operation_id="confirm_password_reset",
    )
    async def confirm_password_reset(request: HttpRequest, data: PasswordResetConfirmIn) -> Done:
        _check_password(data.password)
        try:
            await use_cases.reset_password(token=data.token, password=data.password)
        except InvalidResetTokenError as error:
            raise HttpError(HTTPStatus.BAD_REQUEST, "link inválido ou vencido") from error
        return Done()


def _add_own_account_routes(router: Router, use_cases: AccountUseCases) -> None:
    """With a session: the owner's own account, and nobody else's."""

    @router.post("/logout", response=Done, operation_id="log_out")
    async def log_out(request: HttpRequest) -> Done:
        await sync_to_async(logout)(request)
        return Done()

    @router.get(
        "/me", response=with_errors(AccountOut, unauthorized=True), auth=session_auth, operation_id="get_me"
    )
    async def me(request: HttpRequest) -> AccountOut:
        account = await use_cases.accounts.get(signed_in_account_id(request))
        if account is None:
            raise HttpError(HTTPStatus.UNAUTHORIZED, "conta não encontrada")
        return AccountOut.of(account)

    @router.post(
        "/cars",
        response=with_errors(AccountOut, unauthorized=True, conflict=True, validation=True),
        auth=session_auth,
        operation_id="add_car",
    )
    async def add_car(request: HttpRequest, data: CarIn) -> AccountOut:
        try:
            account = await use_cases.add_car(
                signed_in_account_id(request), model=data.model, color=data.color, plate=data.plate
            )
        except PlateAlreadyOnAccountError as error:
            raise HttpError(HTTPStatus.CONFLICT, "esta placa já está na sua conta") from error
        return AccountOut.of(account)

    @router.delete(
        "/cars/{car_id}",
        response=with_errors(AccountOut, unauthorized=True, not_found=True, validation=True),
        auth=session_auth,
        operation_id="remove_car",
    )
    async def remove_car(request: HttpRequest, car_id: UUID) -> AccountOut:
        try:
            account = await use_cases.remove_car(signed_in_account_id(request), car_id)
        except CarNotFoundError as error:
            raise HttpError(HTTPStatus.NOT_FOUND, "carro não encontrado") from error
        return AccountOut.of(account)

    @router.delete(
        "/me", response=with_errors(Done, unauthorized=True), auth=session_auth, operation_id="delete_account"
    )
    async def delete_account(request: HttpRequest) -> Done:
        await use_cases.delete(signed_in_account_id(request))
        await sync_to_async(logout)(request)
        return Done()


def _add_profile_routes(router: Router, use_cases: AccountUseCases) -> None:
    """Editing the own account (D-139): the display name, the e-mail, and the password."""

    @router.patch(
        "/me",
        response=with_errors(AccountOut, unauthorized=True, conflict=True, validation=True),
        auth=session_auth,
        operation_id="update_profile",
    )
    async def update_profile(request: HttpRequest, data: ProfileIn) -> AccountOut:
        """The display name and the e-mail only: the phone and the password have their own path."""
        try:
            account = await use_cases.update_profile(
                signed_in_account_id(request), display_name=data.display_name, email=data.email
            )
        except EmailAlreadyRegisteredError as error:
            raise HttpError(HTTPStatus.CONFLICT, EMAIL_TAKEN) from error
        except ValidationError as error:
            raise HttpError(HTTPStatus.UNPROCESSABLE_CONTENT, _account_field_refusal(error)) from error
        return AccountOut.of(account)

    @router.post(
        "/me/password",
        response=with_errors(
            Done, unauthorized=True, forbidden=True, too_many_requests=True, validation=True
        ),
        auth=session_auth,
        operation_id="change_password",
    )
    async def change_password(request: HttpRequest, data: ChangePasswordIn) -> Done:
        """The current password proves it is really the owner, session or not (D-139)."""
        _check_password(data.new_password)
        try:
            await use_cases.change_password(
                signed_in_account_id(request),
                current_password=data.current_password,
                new_password=data.new_password,
            )
        except WrongCurrentPasswordError as error:
            raise HttpError(HTTPStatus.FORBIDDEN, "senha atual não confere") from error
        except TooManyAttemptsError as error:
            raise HttpError(HTTPStatus.TOO_MANY_REQUESTS, "muitas tentativas; espere um pouco") from error
        return Done()


async def _register(register: RegisterFromInvite, data: RegisterIn) -> Account:
    """`RegisterIn` leaves `display_name` unconstrained on purpose, the same way `ProfileIn` does:
    `Account` raises `pydantic.ValidationError` when it is blank, and the message it gets is the one
    `update_profile` already gives that field (D-158). An invite that stopped serving is 410, as on
    its pages; one spent by a concurrent request, or a phone or e-mail already taken, is 409 (D-167)."""
    try:
        return await register(
            email_token=data.email_token, display_name=data.display_name, password=data.password
        )
    except InviteNotFoundError as error:
        raise HttpError(HTTPStatus.NOT_FOUND, INVITE_NOT_FOUND) from error
    except (InviteAlreadyUsedError, InviteConflictError) as error:
        raise HttpError(HTTPStatus.CONFLICT, INVITE_USED) from error
    except PhoneAlreadyRegisteredError as error:
        raise HttpError(HTTPStatus.CONFLICT, PHONE_TAKEN) from error
    except EmailAlreadyRegisteredError as error:
        raise HttpError(HTTPStatus.CONFLICT, EMAIL_TAKEN) from error
    except (InviteExpiredError, InviteSupersededError) as error:
        raise HttpError(HTTPStatus.GONE, EMAIL_LINK_GONE[type(error)]) from error
    except ValidationError as error:
        raise HttpError(HTTPStatus.UNPROCESSABLE_CONTENT, _account_field_refusal(error)) from error


async def _give_invite_email(give: GiveInviteEmail, token: str, email: str) -> None:
    try:
        await give(token=token, email=email)
    except InviteNotFoundError as error:
        raise HttpError(HTTPStatus.NOT_FOUND, INVITE_NOT_FOUND) from error
    except EmailAlreadyRegisteredError as error:
        raise HttpError(HTTPStatus.CONFLICT, EMAIL_TAKEN) from error
    except GONE as error:
        raise HttpError(HTTPStatus.GONE, INVITE_GONE[type(error)]) from error
    except TooManyAttemptsError as error:
        message = "muitos envios para este convite; espere um pouco"
        raise HttpError(HTTPStatus.TOO_MANY_REQUESTS, message) from error
    except ValidationError as error:
        raise HttpError(HTTPStatus.UNPROCESSABLE_CONTENT, _account_field_refusal(error)) from error


def _account_field_refusal(error: ValidationError) -> str:
    field = str(error.errors()[0]["loc"][0])
    return ACCOUNT_FIELD_REFUSALS.get(field, "confira os dados informados")


async def _start_session(request: HttpRequest, account: Account) -> None:
    user = await User.objects.aget(id=account.id)
    await alogin(request, user)


def _check_password(password: str) -> None:
    try:
        validate_password(password)
    except DjangoValidationError as error:
        raise HttpError(HTTPStatus.UNPROCESSABLE_CONTENT, " ".join(error.messages)) from error
