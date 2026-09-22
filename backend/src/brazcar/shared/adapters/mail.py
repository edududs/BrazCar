"""`Mailer` over Django's e-mail backend: SMTP in production (Resend, D-032), memory in tests."""

from asgiref.sync import sync_to_async
from django.conf import settings
from django.core.mail import send_mail


class DjangoMailer:
    async def send(self, *, to: str, subject: str, body: str) -> None:
        await sync_to_async(send_mail)(subject, body, settings.DEFAULT_FROM_EMAIL, [to])
