"""The second gate (D-111): what the extractor hands over versus what becomes a source message."""

from datetime import UTC, datetime

from whatsapp_extractor.domain import Content, Jid, Media, MediaKind, MessageKind
from whatsapp_extractor.testing.factories import ALICE, GROUP, make_message

from brazcar.importing.adapters.store import DjangoStore, to_source_message
from brazcar.importing.application import IngestMessages
from brazcar.importing.domain import WatchedGroup
from brazcar.shared.domain.phone import PhoneNumber

from .fakes import FixedClock, InMemoryBlockedSenders, InMemoryCandidates, InMemorySourceMessages

ACCOUNT = PhoneNumber.from_jid_user("5561900000001")
NOW = datetime(2026, 9, 23, 20, 0, tzinfo=UTC)
WATCHED = frozenset({GROUP.value})
OTHER_GROUP = Jid(user="120363000000000002", server="g.us")
LID_ONLY = Jid(user="99887766554433", server="lid")


def keep(**changes: object) -> bool:
    message = make_message().model_copy(update=changes)
    return to_source_message(message, account=ACCOUNT, watched=WATCHED, received_at=NOW) is not None


def test_a_text_from_someone_else_in_a_watched_group_becomes_a_source_message() -> None:
    source = to_source_message(
        make_message("abc", text="  3 vagas 19:30 "), account=ACCOUNT, watched=WATCHED, received_at=NOW
    )

    assert source is not None
    assert source.key == (ACCOUNT.jid_user(), "abc")
    assert source.chat_jid == GROUP.value
    assert source.sender.phone.jid_user() == ALICE.user
    assert source.sender.display_name == "Alice"
    assert source.text == "3 vagas 19:30"
    assert source.received_at == NOW


def test_everything_else_is_dropped() -> None:
    assert keep()
    assert not keep(chat=make_message(chat=OTHER_GROUP).chat)
    assert not keep(chat=make_message(chat=ALICE).chat)  # a direct chat
    assert not keep(
        kind=MessageKind.MEDIA, content=Content(text="legenda", media=Media(kind=MediaKind.IMAGE))
    )
    assert not keep(kind=MessageKind.REACTION)
    assert not keep(from_me=True)
    assert not keep(is_edit=True)
    assert not keep(content=Content(text="   "))
    assert not keep(sender=make_message(sender=LID_ONLY).sender)


async def test_the_store_writes_what_passes_and_stays_quiet_about_the_rest() -> None:
    messages = InMemorySourceMessages()
    store = DjangoStore(
        messages,
        account=ACCOUNT.jid_user(),
        groups=[WatchedGroup(jid=GROUP.value, label="Caronas")],
        clock=FixedClock(NOW),
    )

    await store.save(make_message("one"))
    await store.save(make_message("one"))
    await store.save(make_message("two", chat=OTHER_GROUP))

    assert list(messages.rows) == [(ACCOUNT.jid_user(), "one")]


def test_a_sender_whose_address_is_no_phone_is_dropped() -> None:
    assert not keep(sender=make_message(sender=Jid(user="5561", server="s.whatsapp.net")).sender)


async def test_the_same_person_with_and_without_the_ninth_digit_is_one_sender() -> None:
    """WhatsApp may address one mobile both ways (D-138): the reposts still join one candidate."""
    messages = InMemorySourceMessages()
    store = DjangoStore(
        messages,
        account="556190000001",  # the paired account may be an old address too
        groups=[WatchedGroup(jid=GROUP.value, label="Caronas")],
        clock=FixedClock(NOW),
    )
    old = Jid(user="556199990001", server="s.whatsapp.net")
    new = Jid(user="5561999990001", server="s.whatsapp.net")

    await store.save(make_message("one", sender=old, text="3 vagas 19:30"))
    await store.save(make_message("two", sender=new, text="3 vagas 19:30"))
    candidates = InMemoryCandidates(messages)
    await IngestMessages(messages, candidates, InMemoryBlockedSenders(), {GROUP.value: "Caronas"})()

    assert {m.sender.phone for m in messages.rows.values()} == {PhoneNumber.parse("(61) 99999-0001")}
    assert {m.account.jid_user() for m in messages.rows.values()} == {"5561990000001"}
    assert [c.sources for c in candidates.rows.values()] == [2]
