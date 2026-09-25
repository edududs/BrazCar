"""Proves the migration-drift gate (D-126, D-132): `poe migrations-check` inside `poe check`.

`makemigrations --check --dry-run` exits non-zero when a model moved without a migration to match
it (`sys.exit(1)`, not a catchable domain error), and prints nothing else worth asserting on.
"""

import pytest
from django.core.management import call_command

from brazcar.rides.adapters.models import ContactRequestModel


@pytest.mark.django_db
def test_the_gate_passes_today() -> None:
    """Every model already has the migration that matches it (migration 0006)."""
    call_command("makemigrations", check=True, dry_run=True)


@pytest.mark.django_db
def test_the_gate_fails_a_model_changed_without_a_migration() -> None:
    """Nudge one live field out of sync with its migration, the way 808f96c did by accident."""
    field = ContactRequestModel._meta.get_field("driver_kind")  # noqa: SLF001 - the only handle on a live field
    original_max_length = field.max_length
    field.max_length = (original_max_length or 0) + 1
    try:
        with pytest.raises(SystemExit):
            call_command("makemigrations", check=True, dry_run=True)
    finally:
        field.max_length = original_max_length
