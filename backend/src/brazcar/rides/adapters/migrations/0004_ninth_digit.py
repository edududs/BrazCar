"""External drivers stored under an old WhatsApp address get the ninth digit (D-138).

A repost of the same departure joins its ride by phone (D-113), and a block forgets a phone's rides
(D-119): both look for the canonical value now. Idempotent: a canonical value maps to itself.
"""

from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from brazcar.shared.adapters.ninth_digit import canonical_jid_users, report


def restore_ninth_digit(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    del schema_editor
    rides = apps.get_model("rides", "RideModel").objects
    rewrite = canonical_jid_users(rides.exclude(driver_phone="").values_list("driver_phone", flat=True))
    for old, new in rewrite.changes.items():
        rides.filter(driver_phone=old).update(driver_phone=new)
    report("rides_ride.driver_phone", rewrite)


class Migration(migrations.Migration):
    dependencies = [("rides", "0003_notes_and_fares")]

    operations = [migrations.RunPython(restore_ninth_digit, migrations.RunPython.noop)]
