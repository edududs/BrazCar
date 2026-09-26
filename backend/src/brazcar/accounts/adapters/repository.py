from asgiref.sync import sync_to_async
from django.db import IntegrityError, transaction
from django.db.models import QuerySet, Value
from django.db.models.functions import Lower
from django.utils import timezone

from brazcar.accounts.domain import (
    Account,
    AccountId,
    Car,
    EmailAlreadyRegisteredError,
    PhoneAlreadyRegisteredError,
)
from brazcar.shared.domain.phone import PhoneNumber

from .models import CarModel, User


class DjangoAccountRepository:
    """`AccountRepository` over the ORM: one thread hop and one transaction per write (ADR-0008)."""

    async def get(self, account_id: AccountId) -> Account | None:
        return await sync_to_async(_get)(id=account_id)

    async def by_phone(self, phone: PhoneNumber) -> Account | None:
        return await sync_to_async(_get)(phone=phone.e164())  # E.164 in the column (D-089)

    async def by_email(self, email: str) -> Account | None:
        return await sync_to_async(_by_email)(email)

    async def save(self, account: Account) -> None:
        await sync_to_async(_save)(account)

    async def erase(self, account_id: AccountId) -> None:
        await sync_to_async(_erase)(account_id)


def _get(**lookup: object) -> Account | None:
    row = User.objects.filter(erased_at=None, **lookup).prefetch_related("cars").first()
    return None if row is None else _to_entity(row)


def _by_email(email: str) -> Account | None:
    row = _with_email(User.objects.filter(erased_at=None), email).prefetch_related("cars").first()
    return None if row is None else _to_entity(row)


def _with_email(rows: QuerySet[User], email: str) -> QuerySet[User]:
    """Lowered on both sides by the database itself, the way `one_account_per_email` compares."""
    return rows.alias(email_lower=Lower("email")).filter(email_lower=Lower(Value(email)))


@transaction.atomic
def _save(account: Account) -> None:
    fields = {
        "phone": account.phone.e164(),
        "display_name": account.display_name,
        "email": account.email,
        "email_confirmed_at": account.email_confirmed_at,
        "terms_accepted_at": account.terms_accepted_at,
        "phone_verified_at": account.phone_verified_at,
    }
    try:
        # A savepoint keeps the unique violation from poisoning the outer transaction on Postgres.
        with transaction.atomic():
            User.objects.update_or_create(id=account.id, defaults=fields)
    except IntegrityError as error:
        taken = _taken(account)
        if taken is None:
            raise
        raise taken from error
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


def _taken(account: Account) -> PhoneAlreadyRegisteredError | EmailAlreadyRegisteredError | None:
    """Which of the two unique values another account holds, asked after the savepoint rolled back:
    the name of the violated constraint reads differently on each database."""
    others = User.objects.exclude(id=account.id)
    if others.filter(phone=account.phone.e164()).exists():
        return PhoneAlreadyRegisteredError(account.phone)
    if account.email is not None and _with_email(others, account.email).exists():
        return EmailAlreadyRegisteredError()
    return None


def _to_entity(row: User) -> Account:
    assert row.phone is not None  # noqa: S101 - `_get` filters erased rows, the only ones without a phone
    return Account(
        id=row.id,
        phone=PhoneNumber.parse(row.phone),
        display_name=row.display_name,
        email=row.email or None,
        email_confirmed_at=row.email_confirmed_at,
        terms_accepted_at=row.terms_accepted_at,
        phone_verified_at=None,
        cars=tuple(Car(id=c.id, model=c.model, color=c.color, plate=c.plate) for c in row.cars.all()),
    )
