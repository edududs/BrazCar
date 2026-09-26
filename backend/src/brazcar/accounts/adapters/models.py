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


# `kind` mirrors `InviteProgress`'s pydantic discriminator (`accounts.domain.invite`): "issued",
# "email_given" or "consumed". The columns of a stage the row has not reached stay null; nothing
# is ever cleared once set, so a spent e-mail link still resolves by its digest (D-166).
_NO_PROGRESS = models.Q(
    email__isnull=True,
    email_digest__isnull=True,
    email_given_at__isnull=True,
    email_expires_at__isnull=True,
    account_id__isnull=True,
    consumed_at__isnull=True,
)
_HAS_EMAIL_ONLY = models.Q(
    email__isnull=False,
    email_digest__isnull=False,
    email_given_at__isnull=False,
    email_expires_at__isnull=False,
    account_id__isnull=True,
    consumed_at__isnull=True,
)
_HAS_ACCOUNT = models.Q(
    email__isnull=False, email_digest__isnull=False, account_id__isnull=False, consumed_at__isnull=False
)


class InviteModel(models.Model):
    """One row per invite (D-166). The token itself never lives here, only the digest of it."""

    id = models.UUIDField(primary_key=True, editable=False)
    phone = models.CharField(max_length=16, db_index=True)  # E.164; a phone may own several, over time
    invite_digest = models.CharField(max_length=64, unique=True)
    issued_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    kind = models.CharField(
        max_length=12,
        choices=(("issued", "issued"), ("email_given", "email_given"), ("consumed", "consumed")),
    )
    email = models.EmailField(null=True, blank=True)  # noqa: DJ001 - unset before the e-mail is given
    email_digest = models.CharField(max_length=64, null=True, blank=True, unique=True)
    email_given_at = models.DateTimeField(null=True, blank=True)
    email_expires_at = models.DateTimeField(null=True, blank=True)
    account_id = models.UUIDField(null=True, blank=True)  # set once consumed; a reference, never a join
    consumed_at = models.DateTimeField(null=True, blank=True)
    version = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "accounts_invite"
        indexes = (models.Index(fields=("phone", "issued_at", "id"), name="accounts_invite_latest_idx"),)
        constraints = (
            models.CheckConstraint(
                condition=models.Q(kind__in=("issued", "email_given", "consumed")), name="invite_kind_known"
            ),
            models.CheckConstraint(
                condition=~models.Q(kind="issued") | _NO_PROGRESS, name="invite_issued_has_no_progress"
            ),
            models.CheckConstraint(
                condition=~models.Q(kind="email_given") | _HAS_EMAIL_ONLY,
                name="invite_email_given_has_email_only",
            ),
            models.CheckConstraint(
                condition=~models.Q(kind="consumed") | _HAS_ACCOUNT, name="invite_consumed_has_account"
            ),
        )

    def __str__(self) -> str:
        return f"{self.kind} {self.id}"
