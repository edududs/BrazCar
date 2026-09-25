"""No SQL: `phone_revealed` and `driver_kind` drop the `default=""` migration 0005 needed only to
add the columns to existing rows. The model has never declared a default; `makemigrations --check`
flagged the drift since 808f96c and the fast gate now catches it (D-126, D-132).
"""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("rides", "0005_contact_request_history"),
    ]

    operations = [
        migrations.AlterField(
            model_name="contactrequestmodel",
            name="driver_kind",
            field=models.CharField(blank=True, max_length=12),
        ),
        migrations.AlterField(
            model_name="contactrequestmodel",
            name="phone_revealed",
            field=models.CharField(blank=True, max_length=20),
        ),
    ]
