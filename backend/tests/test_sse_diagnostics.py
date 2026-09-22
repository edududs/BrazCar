import json
from collections.abc import AsyncIterator
from http import HTTPStatus

import pytest
from django.test.client import AsyncClient
from pytest_django.fixtures import Settings

from brazcar.shared.adapters.sse import comment_frame, event_frame
from brazcar.shared.adapters.sse_diagnostics import diagnostic_frames

URL = "/api/diagnostics/sse"
TOKEN = "test-token"


async def take(frames: AsyncIterator[str], count: int) -> list[str]:
    return [await anext(frames) for _ in range(count)]


def test_event_frame_follows_the_wire_format() -> None:
    assert event_frame(event="tick", data="{}", event_id="7") == "id: 7\nevent: tick\ndata: {}\n\n"
    assert event_frame(event="tick", data="{}") == "event: tick\ndata: {}\n\n"
    assert comment_frame("ping") == ": ping\n\n"


async def test_ticks_are_numbered_and_carry_the_server_clock() -> None:
    frames = diagnostic_frames(tick_seconds=0.01, heartbeat_seconds=0)

    retry, first, second = await take(frames, 3)

    assert retry == "retry: 3000\n\n"
    assert first.startswith("id: 1\nevent: tick\ndata: ")
    payloads = [json.loads(frame.split("data: ")[1]) for frame in (first, second)]
    assert [payload["seq"] for payload in payloads] == [1, 2]
    assert payloads[0]["server_time_ms"] <= payloads[1]["server_time_ms"]


async def test_heartbeats_interleave_with_ticks() -> None:
    frames = diagnostic_frames(tick_seconds=0.03, heartbeat_seconds=0.02)

    received = await take(frames, 6)

    assert ": ping\n\n" in received
    assert any("event: tick" in frame for frame in received)


async def test_heartbeat_alone_sends_no_tick() -> None:
    frames = diagnostic_frames(tick_seconds=0, heartbeat_seconds=0.01)

    assert await take(frames, 3) == ["retry: 3000\n\n", ": ping\n\n", ": ping\n\n"]


async def test_heartbeat_can_be_an_event_the_browser_sees() -> None:
    frames = diagnostic_frames(tick_seconds=0, heartbeat_seconds=0.01, heartbeat_kind="event")

    _, heartbeat = await take(frames, 2)

    assert heartbeat.startswith("event: ping\ndata: ")


@pytest.mark.parametrize("configured", ["", TOKEN])
async def test_route_hides_itself_without_the_right_token(settings: Settings, configured: str) -> None:
    settings.SSE_DIAGNOSTICS_TOKEN = configured

    response = await AsyncClient().get(URL, {"token": "wrong"})

    assert response.status_code == HTTPStatus.NOT_FOUND


async def test_route_streams_with_headers_no_proxy_may_buffer(settings: Settings) -> None:
    settings.SSE_DIAGNOSTICS_TOKEN = TOKEN

    response = await AsyncClient().get(URL, {"token": TOKEN})

    assert response.status_code == HTTPStatus.OK
    assert response["Content-Type"] == "text/event-stream"
    assert response["Cache-Control"] == "no-cache, no-transform"
    assert response["X-Accel-Buffering"] == "no"
    assert not response.has_header("Content-Length")


async def test_cors_answers_only_the_configured_origin(settings: Settings) -> None:
    settings.CORS_ALLOWED_ORIGINS = ["https://brazcar.elj-labs.org"]

    allowed = await AsyncClient().get("/api/health", headers={"Origin": "https://brazcar.elj-labs.org"})
    stranger = await AsyncClient().get("/api/health", headers={"Origin": "https://example.org"})

    assert allowed["Access-Control-Allow-Origin"] == "https://brazcar.elj-labs.org"
    assert allowed["Access-Control-Allow-Credentials"] == "true"
    assert not stranger.has_header("Access-Control-Allow-Origin")
