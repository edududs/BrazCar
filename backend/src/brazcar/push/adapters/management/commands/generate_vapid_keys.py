"""`manage.py generate_vapid_keys`: prints a new VAPID pair for the environment file (D-183).
Writes nothing."""

from typing import override

from django.core.management.base import BaseCommand

from brazcar.push.adapters.web_push import generate_vapid_keys


class Command(BaseCommand):
    help = "Print a new VAPID key pair, ready for the environment file."

    @override
    def handle(self, *args: object, **options: object) -> None:
        public, private = generate_vapid_keys()
        self.stdout.write(f"VAPID_PUBLIC_KEY={public}")
        self.stdout.write(f"VAPID_PRIVATE_KEY={private}")
        self.stdout.write(
            "Also set VAPID_CONTACT (mailto:user@domain.tld or https://host). "
            "Replacing the pair invalidates the subscriptions of every device."
        )
