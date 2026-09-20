"""Liveness endpoint, polled by the compose healthcheck and by the front."""

from typing import Literal

from django.http import HttpRequest
from ninja import Router, Schema

router = Router(tags=["health"])


class HealthStatus(Schema):
    status: Literal["ok"]


@router.get("/health", response=HealthStatus, operation_id="get_health")
async def get_health(request: HttpRequest) -> HealthStatus:
    return HealthStatus(status="ok")
