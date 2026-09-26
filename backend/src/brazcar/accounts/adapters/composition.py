"""Wires the accounts use cases to their Django adapters. Called once, by `config/api.py`."""

from django.conf import settings
from ninja import Router
from ninja.security.base import AuthBase

from brazcar.accounts.application import (
    AddCar,
    ChangePassword,
    ConfirmEmail,
    DeleteAccount,
    GiveInviteEmail,
    IssueInvite,
    LogIn,
    OpenInvite,
    OpenSignup,
    RegisterFromInvite,
    RemoveCar,
    RequestEmailChange,
    RequestPasswordReset,
    ResetPassword,
    UpdateProfile,
)
from brazcar.accounts.domain import InvitePolicy
from brazcar.shared.adapters.clock import SystemClock
from brazcar.shared.adapters.mail import DjangoMailer
from brazcar.shared.adapters.rate_limit import DjangoRateLimiter
from brazcar.shared.adapters.session_auth import gated_session_auth

from .credentials import DjangoCredentials, DjangoEmailConfirmationTokens, DjangoPasswordResetTokens
from .invite_repository import DjangoInviteRepository
from .repository import DjangoAccountRepository
from .routes import AccountUseCases, build_router
from .write_gate import AccountWriteGate


def writer_auth() -> AuthBase:
    """The session of a route that changes state: an account that must confirm its e-mail first
    gets 403 (D-168). Every context's composition takes it from here."""
    return gated_session_auth(AccountWriteGate(DjangoAccountRepository()))


def accounts_router() -> Router:
    accounts = DjangoAccountRepository()
    invites = DjangoInviteRepository()
    credentials = DjangoCredentials()
    tokens = DjangoPasswordResetTokens()
    email_tokens = DjangoEmailConfirmationTokens()
    limiter = DjangoRateLimiter()
    mailer = DjangoMailer()
    clock = SystemClock()
    use_cases = AccountUseCases(
        accounts=accounts,
        open_invite=OpenInvite(invites, accounts, clock),
        give_invite_email=GiveInviteEmail(invites, accounts, mailer, limiter, clock, settings.SIGNUP_LINK),
        open_signup=OpenSignup(invites, accounts, clock),
        register=RegisterFromInvite(invites, accounts, credentials, clock),
        log_in=LogIn(accounts, credentials, limiter),
        update_profile=UpdateProfile(accounts),
        request_email_change=RequestEmailChange(
            accounts, email_tokens, mailer, limiter, clock, settings.EMAIL_CONFIRM_LINK
        ),
        confirm_email=ConfirmEmail(accounts, email_tokens, clock),
        change_password=ChangePassword(accounts, credentials, limiter),
        add_car=AddCar(accounts),
        remove_car=RemoveCar(accounts),
        request_password_reset=RequestPasswordReset(
            accounts, tokens, mailer, limiter, settings.PASSWORD_RESET_LINK
        ),
        reset_password=ResetPassword(accounts, credentials, tokens),
        delete=DeleteAccount(accounts),
    )
    return build_router(use_cases, writer_auth())


def issue_invite(policy: InvitePolicy | None = None) -> IssueInvite:
    """Wires the invite's issuing use case, for `manage.py invite`."""
    invites, accounts, clock = DjangoInviteRepository(), DjangoAccountRepository(), SystemClock()
    return (
        IssueInvite(invites, accounts, clock)
        if policy is None
        else IssueInvite(invites, accounts, clock, policy)
    )
