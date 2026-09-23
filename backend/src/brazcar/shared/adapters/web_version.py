"""The oldest front the API still serves (D-052, D-105). The front compares it with its own version."""

from typing import Annotated

from django.conf import settings
from django.http import HttpRequest
from ninja import Router, Schema
from pydantic import Field

router = Router(tags=["health"])


class WebVersionOut(Schema):
    minimum: Annotated[str, Field(pattern=r"^\d+\.\d+\.\d+$")]


@router.get("/web-version", response=WebVersionOut, operation_id="get_web_version")
async def get_web_version(request: HttpRequest) -> WebVersionOut:
    return WebVersionOut(minimum=settings.WEB_MINIMUM_VERSION)
