"""Test settings: the real ones, with the secret the environment would provide."""

import os

os.environ.setdefault("DJANGO_SECRET_KEY", "test-only-key")

from brazcar.config.settings import *  # noqa: F403 - Django's idiom for layered settings
