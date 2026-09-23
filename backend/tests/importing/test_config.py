from datetime import timedelta

import pytest
from django.core.exceptions import ImproperlyConfigured

from brazcar.importing.adapters.composition import extractor_settings
from brazcar.importing.adapters.config import ImportingSettings, PurgeMode, parse_groups
from brazcar.importing.domain import WatchedGroup


def test_groups_are_jid_label_pairs_separated_by_semicolons() -> None:
    parsed = parse_groups(" 120363000000000001@g.us=Caronas Braz ; 556100000000-1484079212@g.us=Caronas 2;")

    assert parsed == (
        WatchedGroup(jid="120363000000000001@g.us", label="Caronas Braz"),
        WatchedGroup(jid="556100000000-1484079212@g.us", label="Caronas 2"),
    )
    assert parse_groups("") == ()


@pytest.mark.parametrize("spec", ["120363000000000001@g.us", "abc@g.us=x", "120363000000000001@g.us="])
def test_a_malformed_entry_refuses_to_start(spec: str) -> None:
    with pytest.raises((ImproperlyConfigured, ValueError)):
        parse_groups(spec)


def test_the_extractor_watches_exactly_the_configured_groups_and_writes_nowhere_by_itself(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EXTRACTOR_ACCOUNT", "1111111111")  # its own env must not leak in
    config = ImportingSettings(
        account="5561900000001",
        session_dsn="session.sqlite3",
        groups=parse_groups("120363000000000001@g.us=Um;120363000000000002@g.us=Dois"),
        purge=PurgeMode.WORKER,
        raw_retention=timedelta(hours=24),
    )

    settings = extractor_settings(config)

    assert settings.account == "5561900000001"
    assert settings.database == "session.sqlite3"
    assert settings.watchlist.chats == {"120363000000000001@g.us", "120363000000000002@g.us"}
    assert settings.watchlist.senders == frozenset()
