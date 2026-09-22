"""Wires the accounts use cases to their Django adapters. Called once, by `config/api.py`."""

from django.conf import settings
from ninja import Router

from brazcar.accounts.application import (
    AddCar,
    DeleteAccount,
    LogIn,
    RegisterAccount,
    RemoveCar,
    RequestPasswordReset,
    ResetPassword,
)
from brazcar.shared.adapters.clock import SystemClock
from brazcar.shared.adapters.mail import DjangoMailer
from brazcar.shared.adapters.rate_limit import DjangoRateLimiter

from .credentials import DjangoCredentials, DjangoPasswordResetTokens
from .repository import DjangoAccountRepository
from .routes import AccountUseCases, build_router


def accounts_router() -> Router:
    accounts = DjangoAccountRepository()
    credentials = DjangoCredentials()
    tokens = DjangoPasswordResetTokens()
    limiter = DjangoRateLimiter()
    use_cases = AccountUseCases(
        accounts=accounts,
        register=RegisterAccount(accounts, credentials, SystemClock()),
        log_in=LogIn(accounts, credentials, limiter),
        add_car=AddCar(accounts),
        remove_car=RemoveCar(accounts),
        request_password_reset=RequestPasswordReset(
            accounts, tokens, DjangoMailer(), limiter, settings.PASSWORD_RESET_LINK
        ),
        reset_password=ResetPassword(accounts, credentials, tokens),
        delete=DeleteAccount(accounts),
    )
    return build_router(use_cases)
