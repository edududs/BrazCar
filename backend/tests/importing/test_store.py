"""The second gate (D-111): what the extractor hands over versus what becomes a source message."""

from datetime import UTC, datetime

from whatsapp_extractor.domain import Content, Jid, Media, MediaKind, MessageKind
from whatsapp_extractor.testing.factories import ALICE, GROUP, make_message

from brazcar.importing.adapters.store import DjangoStore, to_source_message
from brazcar.importing.domain import WatchedGroup

from .fakes import FixedClock, InMemorySourceMessages

ACCOUNT = "5561900000001"
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
    assert source.key == (ACCOUNT, "abc")
    assert source.chat_jid == GROUP.value
    assert source.sender.phone == ALICE.user
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
        account=ACCOUNT,
        groups=[WatchedGroup(jid=GROUP.value, label="Caronas")],
        clock=FixedClock(NOW),
    )

    await store.save(make_message("one"))
    await store.save(make_message("one"))
    await store.save(make_message("two", chat=OTHER_GROUP))

    assert list(messages.rows) == [(ACCOUNT, "one")]
