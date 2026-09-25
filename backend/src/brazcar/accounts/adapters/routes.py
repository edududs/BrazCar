"""Accounts over HTTP. The session (create, destroy) is this adapter's; the rules are the use cases'."""

from dataclasses import dataclass
from datetime import datetime
from http import HTTPStatus
from typing import Self
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
    LogIn,
    RegisterAccount,
    RemoveCar,
    RequestPasswordReset,
    ResetPassword,
    UpdateProfile,
)
from brazcar.accounts.domain import (
    Account,
    Car,
    CarNotFoundError,
    ForeignPhoneNumberError,
    InvalidCredentialsError,
    InvalidResetTokenError,
    NotAMobilePhoneError,
    PhoneAlreadyRegisteredError,
    PlateAlreadyOnAccountError,
    TooManyAttemptsError,
    WrongCurrentPasswordError,
)
from brazcar.shared.adapters.session_auth import session_auth
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
            terms_accepted_at=account.terms_accepted_at,
            cars=[CarOut.of(car) for car in account.cars],
            can_drive=account.can_drive,
        )


class RegisterIn(Schema):
    phone: str
    password: str
    display_name: str
    email: str | None = None
    accepts_terms: bool


class LoginIn(Schema):
    phone: str
    password: str


class CarIn(Schema):
    model: str
    color: str
    plate: str


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
    InvalidPhoneNumberError: "telefone inválido: digite o celular com DDD, como (61) 99999-9999",
    ForeignPhoneNumberError: "por enquanto só números do Brasil",
    NotAMobilePhoneError: "use um número de celular: o contato é pelo WhatsApp",
}

PROFILE_REFUSALS: dict[str, str] = {  # by the field pydantic names in `Account.update_profile`
    "display_name": "nome social não pode ficar vazio",
    "email": "e-mail inválido",
}


@dataclass(frozen=True, slots=True)
class AccountUseCases:
    accounts: AccountRepository  # for "who am I", which has no rule to run
    register: RegisterAccount
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
    _add_entry_routes(router, use_cases)
    _add_own_account_routes(router, use_cases)
    _add_profile_routes(router, use_cases)
    return router


def _add_entry_routes(router: Router, use_cases: AccountUseCases) -> None:
    """Without a session: register, log in, recover the password."""

    @router.post("/register", response={HTTPStatus.CREATED: AccountOut}, operation_id="register_account")
    async def register(request: HttpRequest, data: RegisterIn) -> Status[AccountOut]:
        """Create the account and log it in. The terms must be accepted (D-033)."""
        if not data.accepts_terms:
            raise HttpError(HTTPStatus.UNPROCESSABLE_CONTENT, "os termos precisam ser aceitos")
        _check_password(data.password)
        account = await _register(use_cases.register, data)
        await _start_session(request, account)
        return Status(HTTPStatus.CREATED, AccountOut.of(account))

    @router.post("/login", response=AccountOut, operation_id="log_in")
    async def log_in(request: HttpRequest, data: LoginIn) -> AccountOut:
        try:
            account = await use_cases.log_in(phone=data.phone, password=data.password)
        except InvalidCredentialsError as error:
            raise HttpError(HTTPStatus.UNAUTHORIZED, "telefone ou senha incorretos") from error
        except TooManyAttemptsError as error:
            raise HttpError(HTTPStatus.TOO_MANY_REQUESTS, "muitas tentativas; espere um pouco") from error
        await _start_session(request, account)
        return AccountOut.of(account)

    @router.post("/password-reset", response=Done, operation_id="request_password_reset")
    async def request_password_reset(request: HttpRequest, data: PasswordResetIn) -> Done:
        """Always `ok`: whether the phone has an account or an e-mail is not disclosed."""
        await use_cases.request_password_reset(phone=data.phone)
        return Done()

    @router.post("/password-reset/confirm", response=Done, operation_id="confirm_password_reset")
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

    @router.get("/me", response=AccountOut, auth=session_auth, operation_id="get_me")
    async def me(request: HttpRequest) -> AccountOut:
        account = await use_cases.accounts.get(_account_id(request))
        if account is None:
            raise HttpError(HTTPStatus.UNAUTHORIZED, "conta não encontrada")
        return AccountOut.of(account)

    @router.post("/cars", response=AccountOut, auth=session_auth, operation_id="add_car")
    async def add_car(request: HttpRequest, data: CarIn) -> AccountOut:
        try:
            account = await use_cases.add_car(
                _account_id(request), model=data.model, color=data.color, plate=data.plate
            )
        except PlateAlreadyOnAccountError as error:
            raise HttpError(HTTPStatus.CONFLICT, "esta placa já está na sua conta") from error
        return AccountOut.of(account)

    @router.delete("/cars/{car_id}", response=AccountOut, auth=session_auth, operation_id="remove_car")
    async def remove_car(request: HttpRequest, car_id: UUID) -> AccountOut:
        try:
            account = await use_cases.remove_car(_account_id(request), car_id)
        except CarNotFoundError as error:
            raise HttpError(HTTPStatus.NOT_FOUND, "carro não encontrado") from error
        return AccountOut.of(account)

    @router.delete("/me", response=Done, auth=session_auth, operation_id="delete_account")
    async def delete_account(request: HttpRequest) -> Done:
        await use_cases.delete(_account_id(request))
        await sync_to_async(logout)(request)
        return Done()


def _add_profile_routes(router: Router, use_cases: AccountUseCases) -> None:
    """Editing the own account (D-139): the display name, the e-mail, and the password."""

    @router.patch("/me", response=AccountOut, auth=session_auth, operation_id="update_profile")
    async def update_profile(request: HttpRequest, data: ProfileIn) -> AccountOut:
        """The display name and the e-mail only: the phone and the password have their own path."""
        try:
            account = await use_cases.update_profile(
                _account_id(request), display_name=data.display_name, email=data.email
            )
        except ValidationError as error:
            field = str(error.errors()[0]["loc"][0])
            message = PROFILE_REFUSALS.get(field, "confira os dados informados")
            raise HttpError(HTTPStatus.UNPROCESSABLE_CONTENT, message) from error
        return AccountOut.of(account)

    @router.post("/me/password", response=Done, auth=session_auth, operation_id="change_password")
    async def change_password(request: HttpRequest, data: ChangePasswordIn) -> Done:
        """The current password proves it is really the owner, session or not (D-139)."""
        _check_password(data.new_password)
        try:
            await use_cases.change_password(
                _account_id(request),
                current_password=data.current_password,
                new_password=data.new_password,
            )
        except WrongCurrentPasswordError as error:
            raise HttpError(HTTPStatus.FORBIDDEN, "senha atual não confere") from error
        except TooManyAttemptsError as error:
            raise HttpError(HTTPStatus.TOO_MANY_REQUESTS, "muitas tentativas; espere um pouco") from error
        return Done()


async def _register(register: RegisterAccount, data: RegisterIn) -> Account:
    try:
        return await register(
            phone=data.phone, password=data.password, display_name=data.display_name, email=data.email
        )
    except PhoneAlreadyRegisteredError as error:
        raise HttpError(HTTPStatus.CONFLICT, "este telefone já tem conta") from error
    except (InvalidPhoneNumberError, ForeignPhoneNumberError, NotAMobilePhoneError) as error:
        raise HttpError(HTTPStatus.UNPROCESSABLE_CONTENT, PHONE_REFUSALS[type(error)]) from error


def _account_id(request: HttpRequest) -> UUID:
    account_id: object = getattr(request, "auth", None)  # set by ninja from `session_auth`
    assert isinstance(account_id, UUID)  # noqa: S101 - `session_auth` only ever returns a UUID
    return account_id


async def _start_session(request: HttpRequest, account: Account) -> None:
    user = await User.objects.aget(id=account.id)
    await alogin(request, user)


def _check_password(password: str) -> None:
    try:
        validate_password(password)
    except DjangoValidationError as error:
        raise HttpError(HTTPStatus.UNPROCESSABLE_CONTENT, " ".join(error.messages)) from error
