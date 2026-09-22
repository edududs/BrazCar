"""Storage of accounts. `User` is Django's custom user (D-028): the phone identifies it, the
framework keeps the password hash and the session. The domain never sees it."""

import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models


class UserManager(BaseUserManager["User"]):
    """Django's tooling (`createsuperuser`, tests) expects these two."""

    def create_user(self, phone: str, password: str | None = None, **fields: object) -> User:
        user = self.model(phone=phone, **fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, phone: str, password: str | None = None, **fields: object) -> User:
        return self.create_user(phone, password, is_staff=True, is_superuser=True, **fields)


class User(AbstractBaseUser, PermissionsMixin):
    # The domain `Account.id`; one row per account, erased in place on deletion (D-033).
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # E.164. Null, not blank, once erased: `unique` must keep accepting many erased rows.
    phone = models.CharField(max_length=16, unique=True, null=True)  # noqa: DJ001
    display_name = models.CharField(max_length=60, blank=True)
    email = models.EmailField(blank=True, null=True)  # noqa: DJ001 - None means "no e-mail"; the domain says so
    terms_accepted_at = models.DateTimeField()
    phone_verified_at = models.DateTimeField(null=True, blank=True)
    erased_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = ["display_name", "terms_accepted_at"]  # noqa: RUF012 - Django's idiom

    objects = UserManager()  # pyright: ignore[reportIncompatibleVariableOverride] - narrower manager

    # What Django adds at runtime, declared for the type checker.
    cars: models.Manager[CarModel]

    class Meta:
        db_table = "accounts_user"

    def __str__(self) -> str:
        return self.display_name or str(self.id)


class CarModel(models.Model):
    id = models.UUIDField(primary_key=True, editable=False)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="cars")
    model = models.CharField(max_length=60)
    color = models.CharField(max_length=60)
    plate = models.CharField(max_length=7)
    position = models.PositiveSmallIntegerField()

    class Meta:
        db_table = "accounts_car"
        ordering = ("owner_id", "position")
        constraints = (models.UniqueConstraint(fields=("owner", "plate"), name="one_plate_per_account"),)

    def __str__(self) -> str:
        return f"{self.model} {self.plate}"
