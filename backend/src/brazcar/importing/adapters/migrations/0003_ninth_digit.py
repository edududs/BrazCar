"""Senders and the paired account written as an old WhatsApp address get the ninth digit (D-138).

Idempotent: a canonical value maps to itself, so a second run changes nothing. A blocked phone keeps
its old row and gains the canonical one, so no block is ever lost. A message whose twin under the
canonical account already exists stays as it was; the purge takes it within a day (D-119).
"""

from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from brazcar.shared.adapters.ninth_digit import canonical_jid_users, report


def restore_ninth_digit(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    del schema_editor
    candidates = apps.get_model("importing", "CandidateModel").objects
    messages = apps.get_model("importing", "SourceMessageModel").objects
    blocked = apps.get_model("importing", "BlockedSenderModel").objects

    rewrite = canonical_jid_users(candidates.values_list("sender_phone", flat=True))
    for old, new in rewrite.changes.items():
        candidates.filter(sender_phone=old).update(sender_phone=new)
    report("importing_candidate.sender_phone", rewrite)

    rewrite = canonical_jid_users(messages.values_list("sender_phone", flat=True))
    for old, new in rewrite.changes.items():
        messages.filter(sender_phone=old).update(sender_phone=new)
    report("importing_source_message.sender_phone", rewrite)

    rewrite = canonical_jid_users(messages.values_list("account", flat=True))
    for old, new in rewrite.changes.items():
        taken = messages.filter(account=new).values("message_id")
        messages.filter(account=old).exclude(message_id__in=taken).update(account=new)
    report("importing_source_message.account", rewrite)

    rewrite = canonical_jid_users(blocked.values_list("phone", flat=True))
    for old, new in rewrite.changes.items():
        blocked.get_or_create(phone=new, defaults={"blocked_at": blocked.get(phone=old).blocked_at})
    report("importing_blocked_sender.phone", rewrite)


class Migration(migrations.Migration):
    dependencies = [("importing", "0002_candidates")]

    operations = [migrations.RunPython(restore_ninth_digit, migrations.RunPython.noop)]
