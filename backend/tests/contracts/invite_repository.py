import asyncio
import secrets
from datetime import UTC, datetime, timedelta

import pytest
from hypothesis import given
from hypothesis import strategies as st

from brazcar.accounts.application import InviteRepository
from brazcar.accounts.domain import Invite, InviteConflictError
from brazcar.shared.domain.phone import PhoneNumber
from tests.accounts.strategies import POLICY, DrawnInvite, Stage, emails, invites, moments, phones

from . import contract_settings

MICROSECOND = timedelta(microseconds=1)
UNSPENT: tuple[Stage, ...] = ("issued", "email_given")
gaps = st.timedeltas(min_value=MICROSECOND, max_value=timedelta(days=30))


class InviteRepositoryContract:
    """Subclass as `TestMyRepository` and implement `make_repository`.

    An example does not get a clean store: tokens are fresh on every draw, and the properties about
    the latest invite of a phone issue theirs after whatever that phone already has.
    """

    def make_repository(self) -> InviteRepository:
        raise NotImplementedError

    async def _after_latest(
        self, repository: InviteRepository, phone: PhoneNumber, base: datetime
    ) -> datetime:
        latest = await repository.latest_for(phone)
        return base if latest is None else max(base, latest.issued_at)

    @contract_settings
    @given(drawn=invites())
    async def test_saved_invite_loads_back_equal_by_either_token(self, drawn: DrawnInvite) -> None:
        repository = self.make_repository()

        await repository.save(drawn.invite)

        assert await repository.by_invite_token(drawn.invite_token) == drawn.invite
        if drawn.email_token is not None:  # consumed too: a second click reads "already used"
            assert await repository.by_email_token(drawn.email_token) == drawn.invite

    async def test_unknown_tokens_and_phone_load_as_none(self) -> None:
        repository = self.make_repository()
        phone = PhoneNumber.parse("+5561900000000")
        invite, token = Invite.issue(phone, datetime(2026, 9, 25, 12, 0, tzinfo=UTC), POLICY)
        await repository.save(invite)

        assert await repository.by_invite_token(secrets.token_urlsafe(32)) is None
        assert await repository.by_email_token(token) is None  # an invite's token is no e-mail link
        assert await repository.by_email_token(secrets.token_urlsafe(32)) is None
        assert await repository.latest_for(PhoneNumber.parse("+5561900000001")) is None

    @contract_settings
    @given(drawn=invites(UNSPENT), email=emails, again=emails)
    async def test_saving_a_newer_version_replaces_the_invite_and_its_email_link(
        self, drawn: DrawnInvite, email: str, again: str
    ) -> None:
        invite = drawn.invite
        repository = self.make_repository()
        await repository.save(invite)

        first, first_token = invite.give_email(email, invite.issued_at, POLICY)
        await repository.save(first)
        second, second_token = first.give_email(again, invite.issued_at, POLICY)
        await repository.save(second)

        assert await repository.by_invite_token(drawn.invite_token) == second
        assert await repository.by_email_token(second_token) == second
        assert await repository.by_email_token(first_token) is None

    @contract_settings
    @given(phone=phones, base=moments, gap=gaps, newer_first=st.booleans())
    async def test_latest_for_is_the_most_recently_issued(
        self, phone: PhoneNumber, base: datetime, gap: timedelta, *, newer_first: bool
    ) -> None:
        repository = self.make_repository()
        start = await self._after_latest(repository, phone, base) + MICROSECOND
        older, _ = Invite.issue(phone, start, POLICY)
        newer, _ = Invite.issue(phone, start + gap, POLICY)

        for invite in (newer, older) if newer_first else (older, newer):
            await repository.save(invite)

        assert await repository.latest_for(phone) == newer

    @contract_settings
    @given(phone=phones, base=moments)
    async def test_a_tie_in_time_goes_to_the_greater_id(self, phone: PhoneNumber, base: datetime) -> None:
        repository = self.make_repository()
        at = await self._after_latest(repository, phone, base) + MICROSECOND
        pair = [Invite.issue(phone, at, POLICY)[0] for _ in range(2)]

        for invite in pair:
            await repository.save(invite)

        assert await repository.latest_for(phone) == max(pair, key=lambda invite: invite.id)

    @contract_settings
    @given(drawn=invites(UNSPENT), email=emails)
    async def test_writing_over_a_stale_version_conflicts(self, drawn: DrawnInvite, email: str) -> None:
        invite = drawn.invite
        repository = self.make_repository()
        await repository.save(invite)
        changed, _ = invite.give_email(email, invite.issued_at, POLICY)
        await repository.save(changed)

        with pytest.raises(InviteConflictError):
            await repository.save(invite)  # the version already written
        with pytest.raises(InviteConflictError):
            await repository.save(changed)  # the same write twice

        assert await repository.by_invite_token(drawn.invite_token) == changed

    @contract_settings
    @given(drawn=invites(UNSPENT), one=emails, other=emails)
    async def test_two_concurrent_writes_of_the_same_version_one_wins(
        self, drawn: DrawnInvite, one: str, other: str
    ) -> None:
        invite = drawn.invite
        repository = self.make_repository()
        await repository.save(invite)
        rivals = [invite.give_email(email, invite.issued_at, POLICY)[0] for email in (one, other)]

        outcomes = await asyncio.gather(*(repository.save(rival) for rival in rivals), return_exceptions=True)

        conflicts = [outcome for outcome in outcomes if isinstance(outcome, InviteConflictError)]
        (winner,) = [rival for rival, outcome in zip(rivals, outcomes, strict=True) if outcome is None]
        assert len(conflicts) == 1
        assert await repository.by_invite_token(drawn.invite_token) == winner
