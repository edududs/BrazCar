"""The e-mail becomes confirmed and unique per account, case aside (D-160, D-167).

Every account not erased that already has an e-mail is marked confirmed at the moment of the
migration: it was the only e-mail those accounts ever had, and it already recovers their password
(D-092). Before the constraint, duplicates are looked for; if any, the migration stops and says how
many, without choosing which account keeps the address - that is a person's call, not a script's.
"""

import logging

import django.db.models.functions.text
from django.db import migrations, models
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps
from django.db.models.functions import Lower
from django.utils import timezone

log = logging.getLogger("brazcar.migrations")

_HAS_EMAIL = models.Q(email__isnull=False) & ~models.Q(email="")


def confirm_existing_emails(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    del schema_editor
    users = apps.get_model("accounts", "User").objects
    confirmed = users.filter(_HAS_EMAIL, erased_at=None, email_confirmed_at=None).update(
        email_confirmed_at=timezone.now()
    )
    log.warning("e-mail confirmed (D-167): %d existing account(s) with an e-mail marked confirmed", confirmed)


def refuse_duplicate_emails(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    del schema_editor
    users = apps.get_model("accounts", "User").objects
    shared = (
        users.filter(_HAS_EMAIL)
        .values(email_lower=Lower("email"))
        .annotate(owners=models.Count("id"))
        .filter(owners__gt=1)
    )
    addresses = len(shared)
    if addresses:
        accounts = sum(row["owners"] for row in shared)
        message = (
            f"unique e-mail (D-167): {addresses} e-mail address(es) shared by {accounts} accounts, "
            "case aside. Decide by hand which account keeps each address, clear it from the others, "
            "then migrate again."
        )
        raise RuntimeError(message)


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_invite"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="email_confirmed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(confirm_existing_emails, migrations.RunPython.noop),
        migrations.RunPython(refuse_duplicate_emails, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="user",
            constraint=models.UniqueConstraint(
                django.db.models.functions.text.Lower("email"),
                condition=models.Q(("email__isnull", False), models.Q(("email", ""), _negated=True)),
                name="one_account_per_email",
            ),
        ),
    ]
