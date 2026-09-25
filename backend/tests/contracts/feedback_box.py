from datetime import UTC, datetime, timedelta
from uuid import uuid4

from hypothesis import given
from hypothesis import strategies as st

from brazcar.feedback.application import FeedbackBox
from brazcar.feedback.domain import MESSAGE_LIMIT, AccountId, Feedback, FeedbackKind
from brazcar.shared.domain.phone import PhoneNumber
from tests.shared.phone_strategies import brazilian_mobiles

from . import contract_settings

messages = st.text(min_size=1, max_size=MESSAGE_LIMIT).map(str.strip).filter(bool)


class FeedbackBoxContract:
    """Subclass as `TestMyFeedbackBox`; implement `make_box` and, for a real store, `author`."""

    def make_box(self) -> FeedbackBox:
        raise NotImplementedError

    async def author(self) -> AccountId:
        """An account that may send. The fake takes any identifier; the adapter needs a row."""
        return uuid4()

    @contract_settings
    @given(
        kind=st.sampled_from(FeedbackKind),
        message=messages,
        phone=st.none() | brazilian_mobiles,
    )
    async def test_a_kept_opinion_comes_back_whole_from_its_moment_on(
        self, kind: FeedbackKind, message: str, phone: PhoneNumber | None
    ) -> None:
        box = self.make_box()
        about = phone if kind is FeedbackKind.COMPLAINT else None
        at = datetime.now(UTC).replace(microsecond=0)
        sent = Feedback.send(
            author_id=await self.author(),
            kind=kind,
            message=message,
            about_phone=about,
            web_version="0.20.2",
            at=at,
        )

        await box.keep(sent)

        (found,) = [f for f in await box.since(at) if f.id == sent.id]
        later = await box.since(at + timedelta(seconds=1))
        assert found == sent
        assert all(f.id != sent.id for f in later)

    async def test_the_oldest_comes_first(self) -> None:
        box = self.make_box()
        author = await self.author()
        start = datetime.now(UTC).replace(microsecond=0) + timedelta(days=1)
        later, earlier = (
            Feedback.send(
                author_id=author,
                kind=FeedbackKind.PRAISE,
                message=text,
                about_phone=None,
                web_version="0.20.2",
                at=start + timedelta(minutes=minutes),
            )
            for text, minutes in (("depois", 5), ("antes", 0))
        )

        await box.keep(later)
        await box.keep(earlier)

        ids = [f.id for f in await box.since(start)]
        assert ids.index(earlier.id) < ids.index(later.id)
