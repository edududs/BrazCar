"""Words the e-mails of this context share."""

from datetime import timedelta


def in_hours(span: timedelta) -> str:
    """ "1 hora", "2 horas": how long a link lasts, as the message says it."""
    hours = int(span.total_seconds() // 3600)
    return "1 hora" if hours == 1 else f"{hours} horas"
