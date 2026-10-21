from datetime import timedelta
from uuid import uuid4

import pytest
from asgiref.sync import sync_to_async
from django.db import IntegrityError, transaction

from brazcar.accounts.adapters.repository import DjangoAccountRepository
from brazcar.accounts.domain import Account
from brazcar.alerts.adapters.models import NoticeModel
from brazcar.alerts.adapters.repository import DjangoAlertRepository, DjangoNoticeLog
from brazcar.alerts.application import AlertRepository, NoticeLog
from brazcar.alerts.domain import AccountId
from tests.contracts.alert_repository import (
    BEFORE,
    DAY,
    AlertRepositoryContract,
    NoticeLogContract,
    make_alert,
)

from .fakes import InMemoryAlertRepository, InMemoryNoticeLog


class TestInMemoryAlertRepository(AlertRepositoryContract):
    def make_alerts(self) -> AlertRepository:
        return InMemoryAlertRepository()


class TestInMemoryNoticeLog(NoticeLogContract):
    def make_alerts(self) -> AlertRepository:
        return InMemoryAlertRepository()

    def make_notices(self) -> NoticeLog:
        return InMemoryNoticeLog()


async def register() -> AccountId:
    digits = uuid4().int % 10**8
    account = Account.register(
        phone=f"+55619{digits:08d}",
        display_name="Quem avisa",
        email=None,
        accepted_terms_at=BEFORE,
    )
    await DjangoAccountRepository().save(account)
    return account.id


@pytest.mark.contract
@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
class TestDjangoAlertRepository(AlertRepositoryContract):
    def make_alerts(self) -> AlertRepository:
        return DjangoAlertRepository()

    async def owner(self) -> AccountId:
        return await register()

    async def test_an_erased_account_is_skipped_and_swept_even_for_a_future_day(self) -> None:
        alerts = DjangoAlertRepository()
        gone, staying = await register(), await register()
        day = DAY + timedelta(days=300)
        lost, kept = make_alert(gone, day=day), make_alert(staying, day=day)
        await alerts.add(lost)
        await alerts.add(kept)

        await DjangoAccountRepository().erase(gone)

        assert await alerts.of_owner(gone, since=DAY) == ()
        assert await alerts.on_day(day) == (kept,)
        assert await alerts.purge(before=DAY) == 1
        assert await alerts.get(lost.id) is None
        assert await alerts.get(kept.id) == kept

    async def test_remove_takes_the_notices_along(self) -> None:
        alerts, notices = DjangoAlertRepository(), DjangoNoticeLog()
        alert = make_alert(await register())
        await alerts.add(alert)
        await notices.claim(alert.id, uuid4(), at=BEFORE)

        await alerts.remove(alert.id)

        assert await NoticeModel.objects.filter(alert_id=alert.id).acount() == 0

    async def test_purge_takes_the_notices_along_without_counting_them(self) -> None:
        alerts, notices = DjangoAlertRepository(), DjangoNoticeLog()
        alert = make_alert(await register(), day=DAY - timedelta(days=1))
        await alerts.add(alert)
        await notices.claim(alert.id, uuid4(), at=BEFORE)
        await notices.claim(alert.id, uuid4(), at=BEFORE)

        gone = await alerts.purge(before=DAY)

        assert gone == 1
        assert await NoticeModel.objects.filter(alert_id=alert.id).acount() == 0

    async def test_the_database_refuses_a_repeated_pair(self) -> None:
        alerts = DjangoAlertRepository()
        alert = make_alert(await register())
        await alerts.add(alert)
        ride_id = uuid4()
        await NoticeModel.objects.acreate(alert_id=alert.id, ride_id=ride_id, at=BEFORE)

        def insert_again() -> None:
            with transaction.atomic():
                NoticeModel.objects.create(alert_id=alert.id, ride_id=ride_id, at=BEFORE)

        with pytest.raises(IntegrityError):
            await sync_to_async(insert_again)()


@pytest.mark.contract
@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
class TestDjangoNoticeLog(NoticeLogContract):
    def make_alerts(self) -> AlertRepository:
        return DjangoAlertRepository()

    def make_notices(self) -> NoticeLog:
        return DjangoNoticeLog()

    async def owner(self) -> AccountId:
        return await register()
