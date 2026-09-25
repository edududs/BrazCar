"""Wires the feedback use cases to their adapters. Called once, by `config/api.py`."""

from datetime import timedelta

from django.conf import settings
from ninja import Router

from brazcar.feedback.application import FeedbackRules, SendFeedback
from brazcar.shared.adapters.clock import SystemClock
from brazcar.shared.adapters.rate_limit import DjangoRateLimiter

from .repository import DjangoFeedbackBox
from .routes import build_router


def feedback_router() -> Router:
    rules = FeedbackRules(
        limit=settings.FEEDBACK_LIMIT, window=timedelta(hours=settings.FEEDBACK_WINDOW_HOURS)
    )
    return build_router(SendFeedback(DjangoFeedbackBox(), DjangoRateLimiter(), SystemClock(), rules))
