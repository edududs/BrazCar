from asgiref.sync import sync_to_async
from django.db import IntegrityError, transaction
from django.utils import timezone

from brazcar.accounts.domain import Account, AccountId, Car, PhoneAlreadyRegisteredError

from .models import CarModel, User


class DjangoAccountRepository:
    """`AccountRepository` over the ORM: one thread hop and one transaction per write (ADR-0008)."""

    async def get(self, account_id: AccountId) -> Account | None:
        return await sync_to_async(_get)(id=account_id)

    async def by_phone(self, phone: str) -> Account | None:
        return await sync_to_async(_get)(phone=phone)

    async def save(self, account: Account) -> None:
        await sync_to_async(_save)(account)

    async def erase(self, account_id: AccountId) -> None:
        await sync_to_async(_erase)(account_id)


def _get(**lookup: object) -> Account | None:
    row = User.objects.filter(erased_at=None, **lookup).prefetch_related("cars").first()
    return None if row is None else _to_entity(row)


@transaction.atomic
def _save(account: Account) -> None:
    fields = {
        "phone": account.phone,
        "display_name": account.display_name,
        "email": account.email,
        "terms_accepted_at": account.terms_accepted_at,
        "phone_verified_at": account.phone_verified_at,
    }
    try:
        # A savepoint keeps the unique violation from poisoning the outer transaction on Postgres.
        with transaction.atomic():
            User.objects.update_or_create(id=account.id, defaults=fields)
    except IntegrityError as error:
        raise PhoneAlreadyRegisteredError(account.phone) from error
    CarModel.objects.filter(owner_id=account.id).delete()
    CarModel.objects.bulk_create(
        CarModel(
            id=car.id, owner_id=account.id, model=car.model, color=car.color, plate=car.plate, position=n
        )
        for n, car in enumerate(account.cars)
    )


@transaction.atomic
def _erase(account_id: AccountId) -> None:
    CarModel.objects.filter(owner_id=account_id).delete()
    User.objects.filter(id=account_id).update(
        phone=None,
        display_name="",
        email=None,
        password="",
        is_active=False,
        erased_at=timezone.now(),
    )


def _to_entity(row: User) -> Account:
    assert row.phone is not None  # noqa: S101 - `_get` filters erased rows, the only ones without a phone
    return Account(
        id=row.id,
        phone=row.phone,
        display_name=row.display_name,
        email=row.email or None,
        terms_accepted_at=row.terms_accepted_at,
        phone_verified_at=None,
        cars=tuple(Car(id=c.id, model=c.model, color=c.color, plate=c.plate) for c in row.cars.all()),
    )
