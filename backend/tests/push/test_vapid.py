import importlib
from io import StringIO
from itertools import product

import pytest
from django.core.exceptions import ImproperlyConfigured
from django.core.management import call_command

from brazcar.push.adapters.web_push import VapidKeys, generate_vapid_keys, vapid_keys

CONTACT = "mailto:ops@example.com"


def test_no_variable_turns_push_off() -> None:
    assert vapid_keys(public="", private="  ", contact="") is None


@pytest.mark.parametrize("filled", [f for f in product([False, True], repeat=3) if 0 < sum(f) < 3])
def test_a_partial_set_names_the_three(filled: tuple[bool, bool, bool]) -> None:
    public, private = generate_vapid_keys()
    values = [public, private, CONTACT]
    given = [value if keep else "" for value, keep in zip(values, filled, strict=True)]
    with pytest.raises(ImproperlyConfigured) as error:
        vapid_keys(public=given[0], private=given[1], contact=given[2])
    for name in ("VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_CONTACT"):
        assert name in str(error.value)


@pytest.mark.parametrize("bad", ["not base64 at all!", "AAAA", "A" * 42])
def test_a_malformed_private_key_is_refused_without_echoing_it(bad: str) -> None:
    public, _ = generate_vapid_keys()
    with pytest.raises(ImproperlyConfigured, match="VAPID_PRIVATE_KEY") as error:
        vapid_keys(public=public, private=bad, contact=CONTACT)
    assert bad not in str(error.value)


def test_a_private_key_of_the_wrong_size_never_leaks() -> None:
    public, private = generate_vapid_keys()
    with pytest.raises(ImproperlyConfigured, match="VAPID_PRIVATE_KEY") as error:
        vapid_keys(public=public, private=private[:-4], contact=CONTACT)
    assert private[:-4] not in str(error.value)


def test_a_public_key_of_another_pair_is_refused() -> None:
    _, private = generate_vapid_keys()
    other_public, _ = generate_vapid_keys()
    with pytest.raises(ImproperlyConfigured, match="VAPID_PUBLIC_KEY") as error:
        vapid_keys(public=other_public, private=private, contact=CONTACT)
    assert "does not belong" in str(error.value)
    assert private not in str(error.value)


@pytest.mark.parametrize("bad", ["AAAA", "not base64!"])
def test_a_malformed_public_key_is_refused(bad: str) -> None:
    _, private = generate_vapid_keys()
    with pytest.raises(ImproperlyConfigured, match="VAPID_PUBLIC_KEY"):
        vapid_keys(public=bad, private=private, contact=CONTACT)


@pytest.mark.parametrize(
    "contact", ["ops@example.com", "mailto:", "mailto:ops", "http://example.com", "https://"]
)
def test_a_bad_contact_is_refused(contact: str) -> None:
    public, private = generate_vapid_keys()
    with pytest.raises(ImproperlyConfigured, match="VAPID_CONTACT"):
        vapid_keys(public=public, private=private, contact=contact)


@pytest.mark.parametrize("contact", [CONTACT, "https://brazcar.example.org"])
def test_a_good_contact_is_accepted(contact: str) -> None:
    public, private = generate_vapid_keys()
    keys = vapid_keys(public=f" {public} ", private=private, contact=contact)
    assert keys == VapidKeys(public_key=public, private_key=private, contact=contact)


def test_the_command_prints_a_pair_the_check_accepts() -> None:
    out = StringIO()
    call_command("generate_vapid_keys", stdout=out)
    lines = out.getvalue().splitlines()
    values = dict(line.split("=", 1) for line in lines if line.startswith("VAPID_"))
    assert set(values) == {"VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"}
    assert any("VAPID_CONTACT" in line for line in lines)
    keys = vapid_keys(public=values["VAPID_PUBLIC_KEY"], private=values["VAPID_PRIVATE_KEY"], contact=CONTACT)
    assert keys is not None


def _reload() -> None:
    import brazcar.config.settings as project_settings  # noqa: PLC0415 - reloaded on purpose

    importlib.reload(project_settings)


def test_the_boot_reads_the_vapid_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    import brazcar.config.settings as project_settings  # noqa: PLC0415 - reloaded on purpose

    public, private = generate_vapid_keys()
    monkeypatch.setenv("VAPID_PUBLIC_KEY", public)
    monkeypatch.setenv("VAPID_PRIVATE_KEY", private)
    monkeypatch.setenv("VAPID_CONTACT", CONTACT)
    importlib.reload(project_settings)
    assert project_settings.PUSH_VAPID is not None
    assert project_settings.PUSH_VAPID.public_key == public
    for name in ("VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_CONTACT"):
        monkeypatch.delenv(name)
    _reload()
    assert project_settings.PUSH_VAPID is None


def test_a_bad_contact_stops_the_boot(monkeypatch: pytest.MonkeyPatch) -> None:
    public, private = generate_vapid_keys()
    monkeypatch.setenv("VAPID_PUBLIC_KEY", public)
    monkeypatch.setenv("VAPID_PRIVATE_KEY", private)
    monkeypatch.setenv("VAPID_CONTACT", "ops@example.com")
    with pytest.raises(ImproperlyConfigured, match="VAPID_CONTACT"):
        _reload()
    for name in ("VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_CONTACT"):
        monkeypatch.delenv(name)
    _reload()
