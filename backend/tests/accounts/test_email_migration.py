"""The data steps of `accounts.0003` (D-167), run against the real tables: SQLite here, Postgres on
the heavy gate. Rows are written the way the code before D-167 wrote them."""

import logging
from collections.abc import Iterator
from datetime import UTC, datetime
from importlib import import_module
from typing import Protocol

import pytest
from django.apps import apps
from django.db import connection

from brazcar.accounts.adapters.models import User

pytestmark = [pytest.mark.contract, pytest.mark.django_db(transaction=True)]

JOINED = datetime(2026, 9, 1, tzinfo=UTC)


class _Migration(Protocol):
    def confirm_existing_emails(self, apps: object, schema_editor: object) -> None: ...

    def refuse_duplicate_emails(self, apps: object, schema_editor: object) -> None: ...


def migration() -> _Migration:
    module: _Migration = import_module("brazcar.accounts.adapters.migrations.0003_email_confirmed_and_unique")  # pyright: ignore[reportAssignmentType]
    return module


def user(phone: str | None, email: str | None, *, erased: bool = False) -> User:
    return User.objects.create(
        phone=phone,
        display_name="Ana",
        email=email,
        terms_accepted_at=JOINED,
        erased_at=JOINED if erased else None,
    )


def test_every_account_with_an_email_is_confirmed_once(caplog: pytest.LogCaptureFixture) -> None:
    with_email = user("+5561999990001", "ana@example.com")
    without = user("+5561999990002", None)
    blank = user("+5561999990003", "")
    erased = user(None, None, erased=True)

    with caplog.at_level(logging.WARNING, logger="brazcar.migrations"):
        migration().confirm_existing_emails(apps, None)
    confirmed_at = User.objects.get(id=with_email.id).email_confirmed_at
    migration().confirm_existing_emails(apps, None)

    assert confirmed_at is not None
    assert User.objects.get(id=with_email.id).email_confirmed_at == confirmed_at  # untouched the 2nd time
    assert [User.objects.get(id=row.id).email_confirmed_at for row in (without, blank, erased)] == [None] * 3
    assert "1 existing account(s)" in caplog.records[0].getMessage()


@pytest.fixture
def without_the_constraint() -> Iterator[None]:
    """The table as it was before the migration, when two accounts could share an e-mail."""
    (constraint,) = User._meta.constraints  # noqa: SLF001 - Django's own way to reach them
    with connection.schema_editor() as editor:
        editor.remove_constraint(User, constraint)
    yield
    User.objects.all().delete()
    with connection.schema_editor() as editor:
        editor.add_constraint(User, constraint)


@pytest.mark.usefixtures("without_the_constraint")
def test_shared_emails_stop_the_migration_and_say_how_many() -> None:
    user("+5561999990001", "ana@example.com")
    user("+5561999990002", "ANA@example.com")
    user("+5561999990003", "Ana@Example.com")
    user("+5561999990004", "bia@example.com")
    user("+5561999990005", "bia@example.com")
    user("+5561999990006", "caio@example.com")

    with pytest.raises(RuntimeError, match=r"2 e-mail address\(es\) shared by 5 accounts"):
        migration().refuse_duplicate_emails(apps, None)


def test_no_shared_email_lets_the_migration_go_on() -> None:
    user("+5561999990001", "ana@example.com")
    user("+5561999990002", None)
    user("+5561999990003", "")
    user("+5561999990004", "")

    migration().refuse_duplicate_emails(apps, None)
