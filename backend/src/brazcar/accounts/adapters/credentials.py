"""`Credentials` and `PasswordResetTokens` on Django's password hashing and token generator."""

from dataclasses import dataclass, field
from uuid import UUID

from asgiref.sync import sync_to_async
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from brazcar.accounts.domain import AccountId

from .models import User


class DjangoCredentials:
    async def register(self, account_id: AccountId, password: str) -> None:
        await sync_to_async(_set_password)(account_id, password)

    async def verify(self, phone: str, password: str) -> AccountId | None:
        return await sync_to_async(_verify)(phone, password)

    async def change(self, account_id: AccountId, password: str) -> None:
        await sync_to_async(_set_password)(account_id, password)


def _set_password(account_id: AccountId, password: str) -> None:
    user = User.objects.get(id=account_id)
    user.set_password(password)
    user.save(update_fields=["password"])


def _verify(phone: str, password: str) -> AccountId | None:
    user = User.objects.filter(phone=phone, is_active=True).first()
    if user is None:
        User().set_password(password)  # same cost whether or not the phone exists
        return None
    return user.id if user.check_password(password) else None


@dataclass(frozen=True, slots=True)
class DjangoPasswordResetTokens:
    """`<uid>.<token>`: the token binds to the password hash and last login, so it dies once used.
    Validity comes from `PASSWORD_RESET_TIMEOUT`."""

    generator: PasswordResetTokenGenerator = field(default_factory=PasswordResetTokenGenerator)

    async def issue(self, account_id: AccountId) -> str:
        return await sync_to_async(self._issue)(account_id)

    async def redeem(self, token: str) -> AccountId | None:
        return await sync_to_async(self._redeem)(token)

    def _issue(self, account_id: AccountId) -> str:
        user = User.objects.get(id=account_id)
        return f"{urlsafe_base64_encode(user.id.bytes)}.{self.generator.make_token(user)}"

    def _redeem(self, token: str) -> AccountId | None:
        encoded_id, _, check = token.partition(".")
        try:
            account_id = UUID(bytes=urlsafe_base64_decode(encoded_id))
        except ValueError:
            return None
        user = User.objects.filter(id=account_id, is_active=True).first()
        if user is None or not self.generator.check_token(user, check):
            return None
        return user.id
