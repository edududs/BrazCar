"""`manage.py list_whatsapp_groups`: the groups the paired account is in, to fill WHATSAPP_GROUPS.

Group names come from WhatsApp here, live; the extractor does not store them (D-109).
"""

import asyncio
from typing import override

from django.core.management.base import BaseCommand
from whatsapp_extractor import bootstrap

from brazcar.importing.adapters.composition import extractor_settings
from brazcar.importing.adapters.config import ImportingSettings


class Command(BaseCommand):
    help = "List the groups of the paired account: JID, members and name."

    @override
    def handle(self, *args: object, **options: object) -> None:
        config = ImportingSettings.from_django()
        account = config.require_account()
        groups = asyncio.run(bootstrap.groups_of(extractor_settings(config, account=account), account))
        for group in sorted(groups, key=lambda g: g.name.casefold()):
            self.stdout.write(f"{group.jid}\t{group.participants:>4}\t{group.name}")
        self.stdout.write(f"{len(groups)} group(s)")
