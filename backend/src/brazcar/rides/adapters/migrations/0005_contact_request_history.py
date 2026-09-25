"""A contact request keeps the revealed phone, the driver's shape, and survives the ride (D-140).

Additive: three new columns, backfilled from the still-existing ride when there is one, and the
`ride` foreign key becomes nullable with `SET_NULL` instead of `PROTECT`, so `ForgetRides` no
longer has to delete the request to delete the ride. Idempotent: a row already filled is skipped.
"""

import django.db.models.deletion
from django.apps.registry import Apps
from django.db import migrations, models
from django.db.backends.base.schema import BaseDatabaseSchemaEditor

from brazcar.shared.domain.phone import PhoneNumber


def backfill_from_the_ride(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    del schema_editor
    contact_requests = apps.get_model("rides", "ContactRequestModel").objects
    rides = apps.get_model("rides", "RideModel").objects
    accounts = apps.get_model("accounts", "User").objects
    filled = 0
    for row in contact_requests.filter(phone_revealed="").exclude(ride_id=None):
        ride = rides.filter(id=row.ride_id).first()
        if ride is None:
            continue
        if ride.driver_id is None:
            row.driver_kind = "external"
            row.driver_account_id = None
            row.phone_revealed = PhoneNumber.from_jid_user(ride.driver_phone).e164()
        else:
            row.driver_kind = "registered"
            row.driver_account_id = ride.driver_id
            account = accounts.filter(id=ride.driver_id).first()
            row.phone_revealed = account.phone if account is not None and account.phone else ""
        row.save(update_fields=["phone_revealed", "driver_kind", "driver_account_id"])
        filled += 1
    print(f"rides_contact_request: filled {filled} row(s) from their ride")  # noqa: T201 - operator log


class Migration(migrations.Migration):
    dependencies = [
        ("rides", "0004_ninth_digit"),
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="contactrequestmodel",
            name="phone_revealed",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="contactrequestmodel",
            name="driver_kind",
            field=models.CharField(blank=True, default="", max_length=12),
        ),
        migrations.AddField(
            model_name="contactrequestmodel",
            name="driver_account_id",
            field=models.UUIDField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="contactrequestmodel",
            name="ride",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="contact_requests",
                to="rides.ridemodel",
            ),
        ),
        migrations.RunPython(backfill_from_the_ride, migrations.RunPython.noop),
    ]
