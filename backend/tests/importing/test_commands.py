from io import StringIO

import pytest
from asgiref.sync import sync_to_async
from django.core.management import call_command

from brazcar.importing.adapters.repository import DjangoSourceMessages
from tests.contracts.source_messages import fresh


@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
async def test_source_messages_counts_by_group_and_previews_the_latest() -> None:
    messages = DjangoSourceMessages()
    await messages.save(fresh(text="03 VAGAS\nSaindo às 19:30\nEsplanada\nBrazlândia"))
    await messages.save(fresh(text="lotou"))
    out = StringIO()

    await sync_to_async(call_command)("source_messages", "--last", "1", stdout=out)

    lines = out.getvalue().splitlines()
    assert lines[0].endswith("\t2")
    assert lines[1] == "2 message(s) in 1 group(s)"
    assert len(lines) == 3
    assert lines[2].endswith(("lotou", "Brazlândia"))
