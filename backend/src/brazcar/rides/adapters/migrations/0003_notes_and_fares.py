"""Notes on a ride (D-129) and a fare per stop (D-131).

Additive: every ride already stored gets blank notes, every stop a null fare, and nothing changes
for them — no fares means the price stays the one that was typed.
"""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("rides", "0002_driver_and_origin")]

    operations = [
        migrations.AddField(
            model_name="ridemodel",
            name="notes",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="stopmodel",
            name="fare",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True),
        ),
    ]
