from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import uuid4

from hypothesis import strategies as st

from brazcar.accounts.domain import Account, Car, Invite, InvitePolicy
from tests.shared.phone_strategies import brazilian_mobiles

phones = brazilian_mobiles
plates = st.from_regex(r"[A-Z]{3}[0-9][A-Z0-9][0-9]{2}", fullmatch=True)
short_texts = st.text("abcdefghijklmnopqrstuvwxyzáéíóúãõç ", min_size=1, max_size=20).filter(str.strip)
emails = st.from_regex(r"[a-z]{1,8}@[a-z]{1,8}\.com", fullmatch=True)
moments = st.datetimes(
    min_value=datetime(2026, 1, 1, tzinfo=UTC).replace(tzinfo=None),
    max_value=datetime(2029, 12, 31, tzinfo=UTC).replace(tzinfo=None),
    timezones=st.just(UTC),
)

POLICY = InvitePolicy()

type Stage = Literal["issued", "email_given", "consumed"]
STAGES: tuple[Stage, ...] = ("issued", "email_given", "consumed")


@st.composite
def cars(draw: st.DrawFn) -> Car:
    return Car(id=uuid4(), model=draw(short_texts), color=draw(short_texts), plate=draw(plates))


@st.composite
def accounts(draw: st.DrawFn) -> Account:
    own_cars = draw(st.lists(cars(), max_size=3, unique_by=lambda car: car.plate))
    return Account(
        id=uuid4(),
        phone=draw(phones),
        display_name=draw(short_texts),
        email=draw(st.none() | emails),
        terms_accepted_at=datetime(2026, 9, 22, tzinfo=UTC),
        cars=tuple(own_cars),
    )


@dataclass(frozen=True, slots=True)
class DrawnInvite:
    """An invite at some point of its life, with the tokens its links carry."""

    invite: Invite
    invite_token: str
    email_token: str | None


def within(span: timedelta) -> st.SearchStrategy[timedelta]:
    return st.timedeltas(min_value=timedelta(0), max_value=span)


@st.composite
def invites(draw: st.DrawFn, stages: tuple[Stage, ...] = STAGES) -> DrawnInvite:
    """Issued, with the e-mail given, or consumed: each through the invite's own transitions."""
    invite, invite_token = Invite.issue(draw(phones), draw(moments), POLICY)
    stage = draw(st.sampled_from(stages))
    if stage == "issued":
        return DrawnInvite(invite, invite_token, None)
    given_at = invite.issued_at + draw(within(POLICY.lifetime))
    invite, email_token = invite.give_email(draw(emails), given_at, POLICY)
    if stage == "consumed":
        consumed_at = given_at + draw(within(POLICY.email_link_lifetime))
        invite = invite.consume(email_token, uuid4(), consumed_at)
    return DrawnInvite(invite, invite_token, email_token)
