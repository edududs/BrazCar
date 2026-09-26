"""`RemovalRequests`: a request comes back whole, a decision replaces it, and pending means undecided."""

from datetime import UTC, datetime, timedelta

from hypothesis import given
from hypothesis import strategies as st

from brazcar.importing.application import RemovalRequests
from brazcar.importing.domain import NOTE_LIMIT, RemovalRequest
from brazcar.shared.domain.phone import PhoneNumber
from tests.shared.phone_strategies import brazilian_mobiles

from . import contract_settings

notes = st.text(st.characters(exclude_characters="\x00"), max_size=NOTE_LIMIT).map(str.strip).filter(bool)
foreign = st.sampled_from(["+14155552671", "+351912345678", "+556133334444"]).map(PhoneNumber.parse)
decisions = st.sampled_from(["pending", "approved", "refused"])
START = datetime(2026, 9, 26, 12, 0, tzinfo=UTC)


def decided(request: RemovalRequest, decision: str, at: datetime) -> RemovalRequest:
    match decision:
        case "approved":
            return request.approve(at)
        case "refused":
            return request.refuse(at)
        case _:
            return request


class RemovalRequestsContract:
    """Subclass as `TestMyRemovalRequests` and implement `make_requests`. Rows of other examples may
    be there: every property looks at its own ids only."""

    def make_requests(self) -> RemovalRequests:
        raise NotImplementedError

    @contract_settings
    @given(phone=brazilian_mobiles | foreign, note=st.none() | notes, decision=decisions)
    async def test_a_saved_request_comes_back_whole(
        self, phone: PhoneNumber, note: str | None, decision: str
    ) -> None:
        requests = self.make_requests()
        request = decided(
            RemovalRequest.open(phone=phone, note=note, at=START), decision, START + timedelta(hours=1)
        )

        await requests.save(request)

        assert await requests.get(request.id) == request
        assert (request.id in {r.id for r in await requests.pending()}) is (decision == "pending")
        assert request.id in {r.id for r in await requests.all()}

    async def test_a_decision_replaces_the_request_and_leaves_the_pending(self) -> None:
        requests = self.make_requests()
        phone = PhoneNumber.parse("+5561999990007")
        request = RemovalRequest.open(phone=phone, note="Não quero minhas caronas aqui.", at=START)
        await requests.save(request)
        approved = request.approve(START + timedelta(minutes=5))

        await requests.save(approved)

        assert await requests.get(request.id) == approved
        assert request.id not in {r.id for r in await requests.pending()}
        assert [r for r in await requests.all() if r.id == request.id] == [approved]

    async def test_the_oldest_comes_first(self) -> None:
        requests = self.make_requests()
        phone = PhoneNumber.parse("+5561999990008")
        later = RemovalRequest.open(phone=phone, note=None, at=START + timedelta(days=2, minutes=5))
        earlier = RemovalRequest.open(phone=phone, note=None, at=START + timedelta(days=2))

        await requests.save(later)
        await requests.save(earlier)

        for listed in (await requests.pending(), await requests.all()):
            ids = [r.id for r in listed]
            assert ids.index(earlier.id) < ids.index(later.id)

    async def test_an_unknown_id_is_none(self) -> None:
        requests = self.make_requests()

        assert (
            await requests.get(
                RemovalRequest.open(phone=PhoneNumber.parse("+5561999990009"), note=None, at=START).id
            )
            is None
        )
