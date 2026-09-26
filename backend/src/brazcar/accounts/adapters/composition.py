"""Wires the accounts use cases to their Django adapters. Called once, by `config/api.py`."""

from django.conf import settings
from ninja import Router

from brazcar.accounts.application import (
    AddCar,
    ChangePassword,
    DeleteAccount,
    GiveInviteEmail,
    IssueInvite,
    LogIn,
    OpenInvite,
    OpenSignup,
    RegisterFromInvite,
    RemoveCar,
    RequestPasswordReset,
    ResetPassword,
    UpdateProfile,
)
from brazcar.accounts.domain import InvitePolicy
from brazcar.shared.adapters.clock import SystemClock
from brazcar.shared.adapters.mail import DjangoMailer
from brazcar.shared.adapters.rate_limit import DjangoRateLimiter

from .credentials import DjangoCredentials, DjangoPasswordResetTokens
from .invite_repository import DjangoInviteRepository
from .repository import DjangoAccountRepository
from .routes import AccountUseCases, build_router


def accounts_router() -> Router:
    accounts = DjangoAccountRepository()
    invites = DjangoInviteRepository()
    credentials = DjangoCredentials()
    tokens = DjangoPasswordResetTokens()
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
        change_password=ChangePassword(accounts, credentials, limiter),
        add_car=AddCar(accounts),
        remove_car=RemoveCar(accounts),
        request_password_reset=RequestPasswordReset(
            accounts, tokens, mailer, limiter, settings.PASSWORD_RESET_LINK
        ),
        reset_password=ResetPassword(accounts, credentials, tokens),
        delete=DeleteAccount(accounts),
    )
    return build_router(use_cases)


def issue_invite(policy: InvitePolicy | None = None) -> IssueInvite:
    """Wires the invite's issuing use case, for `manage.py invite`."""
    invites, accounts, clock = DjangoInviteRepository(), DjangoAccountRepository(), SystemClock()
    return (
        IssueInvite(invites, accounts, clock)
        if policy is None
        else IssueInvite(invites, accounts, clock, policy)
    )
