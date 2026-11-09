"""Public state of the importing (D-193). Always 200 while the API lives: the state is in the body,
which carries nothing but the status and the reason. The liveness probe stays `/api/health`."""

from typing import Literal

from django.http import HttpRequest
from ninja import Router, Schema

from brazcar.importing.application import CheckImportingHealth


class ImportingHealthOut(Schema):
    status: Literal["ok", "degraded", "off"]
    reason: Literal["parser_failing", "no_recent_messages"] | None


def build_health_router(check: CheckImportingHealth) -> Router:
    router = Router(tags=["health"])

    @router.get("/health/importing", response=ImportingHealthOut, operation_id="get_importing_health")
    async def get_importing_health(request: HttpRequest) -> ImportingHealthOut:
        health = await check()
        reason = None if health.reason is None else health.reason.value
        return ImportingHealthOut(status=health.status.value, reason=reason)

    return router
