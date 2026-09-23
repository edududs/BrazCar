"""Django settings. Every deployment-specific value comes from the environment."""

import os
import re
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


def _env_version(name: str, *, default: str) -> str:
    value = os.environ.get(name, default).strip()
    if re.fullmatch(r"\d+\.\d+\.\d+", value) is None:
        message = f"{name} must be MAJOR.MINOR.PATCH, got {value!r}"
        raise ImproperlyConfigured(message)
    return value


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

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.staticfiles",
    "corsheaders",
    "ninja",
    "brazcar.shared.adapters",
    "brazcar.search.adapters",
    "brazcar.places.adapters",
    "brazcar.accounts.adapters",
    "brazcar.rides.adapters",
    "brazcar.importing.adapters",
]
AUTH_USER_MODEL = "accounts.User"  # the custom user precedes auth's first migration (D-028)

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "brazcar.shared.adapters.origin_check.OriginCheckMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
]

# Session cookie between sibling origins (ADR-0012). State-changing requests prove their origin
# in `OriginCheckMiddleware`; a CSRF token would not cross origins, so there is none.
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_AGE = 60 * 60 * 24 * 90  # people log in on a phone once and stay
SESSION_COOKIE_NAME = "brazcar_session"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]
PASSWORD_RESET_TIMEOUT = 60 * 60  # one hour for the e-mailed link (D-032)

# E-mail (D-032): the provider is an environment variable, the console when none is given.
EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND",
    "django.core.mail.backends.smtp.EmailBackend"
    if os.environ.get("EMAIL_HOST")
    else "django.core.mail.backends.console.EmailBackend",
)
EMAIL_HOST = os.environ.get("EMAIL_HOST", "")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = _env_bool("EMAIL_USE_TLS", default=True)
DEFAULT_FROM_EMAIL = os.environ.get("EMAIL_FROM", "BrazCar <no-reply@localhost>")
# The front's page that receives the e-mailed token; `{token}` is filled by the use case.
PASSWORD_RESET_LINK = os.environ.get(
    "PASSWORD_RESET_LINK", "http://localhost:5173/redefinir-senha?token={token}"
)

# The front lives on a sibling origin (D-058). Explicit origins only, with credentials (D-059).
CORS_ALLOWED_ORIGINS = _env_list("DJANGO_CORS_ALLOWED_ORIGINS", default=[])
CORS_ALLOW_CREDENTIALS = True

# The knobs of `rides` (D-017, D-031, D-064). Minutes and hours, whole numbers.
RIDE_DEPARTURE_TOLERANCE_MINUTES = int(os.environ.get("RIDE_DEPARTURE_TOLERANCE_MINUTES", "20"))
RIDE_CONTACT_LIMIT = int(os.environ.get("RIDE_CONTACT_LIMIT", "20"))
RIDE_CONTACT_WINDOW_HOURS = int(os.environ.get("RIDE_CONTACT_WINDOW_HOURS", "24"))

# Oldest front the API still serves (D-052, D-105). Below it the app asks for an update. 0.0.0 is no floor.
WEB_MINIMUM_VERSION = _env_version("WEB_MINIMUM_VERSION", default="0.0.0")

# Diagnostic SSE route of the tunnel risk test (D-049). Empty keeps the route off.
SSE_DIAGNOSTICS_TOKEN = os.environ.get("SSE_DIAGNOSTICS_TOKEN", "")

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
        conn_max_age=0,  # no persistent connections under ASGI, as Django advises (ADR-0008)
    ),
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

LOGGING: dict[str, object] = {
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
