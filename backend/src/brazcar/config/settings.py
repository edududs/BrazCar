"""Django settings. Every deployment-specific value comes from the environment."""

import os
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured

BACKEND_DIR = Path(__file__).resolve().parents[3]

_TRUE_VALUES = frozenset({"1", "true", "yes", "on"})
_DEV_SECRET_KEY = "dev-only-insecure-key"  # noqa: S105 - only reachable with DJANGO_DEBUG on


def _env_bool(name: str, *, default: bool) -> bool:
    raw = os.environ.get(name)
    return default if raw is None else raw.strip().lower() in _TRUE_VALUES


def _env_list(name: str, *, default: list[str]) -> list[str]:
    raw = os.environ.get(name)
    return default if raw is None else [item.strip() for item in raw.split(",") if item.strip()]


def _secret_key(*, debug: bool) -> str:
    key = os.environ.get("DJANGO_SECRET_KEY")
    if key:
        return key
    if debug:
        return _DEV_SECRET_KEY
    message = "DJANGO_SECRET_KEY is required when DJANGO_DEBUG is off"
    raise ImproperlyConfigured(message)


DEBUG = _env_bool("DJANGO_DEBUG", default=False)
SECRET_KEY = _secret_key(debug=DEBUG)
ALLOWED_HOSTS = _env_list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"] if DEBUG else [])

# No auth, sessions or admin yet: the custom user must exist before their first migration (D-028).
INSTALLED_APPS = [
    "django.contrib.staticfiles",
    "ninja",
    "brazcar.places.adapters",
    "brazcar.accounts.adapters",
    "brazcar.rides.adapters",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "brazcar.config.urls"
ASGI_APPLICATION = "brazcar.config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "APP_DIRS": True,
    },
]

DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{(BACKEND_DIR / 'db.sqlite3').as_posix()}",
        conn_max_age=60,
        conn_health_checks=True,
    ),
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {"()": "brazcar.shared.adapters.json_logging.JsonFormatter"},
    },
    "handlers": {
        "stdout": {
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
            "formatter": "json",
        },
    },
    "root": {"handlers": ["stdout"], "level": os.environ.get("LOG_LEVEL", "INFO")},
    # Django and uvicorn install their own plain-text handlers; hand their records to the root instead.
    "loggers": {
        name: {"handlers": [], "propagate": True} for name in ("django", "uvicorn", "uvicorn.access")
    },
}
