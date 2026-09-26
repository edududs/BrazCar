"""Who sent the request: the edge's header when one is configured, the socket otherwise (D-172)."""

import pytest
from django.test import RequestFactory

from brazcar.shared.adapters.client_ip import MAX_LENGTH, client_ip

SOCKET = "10.0.0.2"  # the tunnel's own address, behind Cloudflare


def test_unset_the_socket_is_used_and_the_header_ignored(settings: object) -> None:
    setattr(settings, "CLIENT_IP_HEADER", "")  # noqa: B010 - pytest-django's settings proxy

    assert (
        client_ip(RequestFactory().post("/", REMOTE_ADDR=SOCKET, headers={"CF-Connecting-IP": "203.0.113.7"}))
        == SOCKET
    )


@pytest.mark.parametrize(
    ("headers", "expected"),
    [
        ({"CF-Connecting-IP": "203.0.113.7"}, "203.0.113.7"),
        ({"cf-connecting-ip": " 2001:db8::1 "}, "2001:db8::1"),
        ({}, SOCKET),  # a request that did not come through the edge
        ({"CF-Connecting-IP": "  "}, SOCKET),
        ({"CF-Connecting-IP": "x" * 500}, "x" * MAX_LENGTH),  # a forged header keeps the key short
    ],
)
def test_set_the_header_names_the_client(settings: object, headers: dict[str, str], expected: str) -> None:
    setattr(settings, "CLIENT_IP_HEADER", "CF-Connecting-IP")  # noqa: B010

    assert client_ip(RequestFactory().post("/", REMOTE_ADDR=SOCKET, headers=headers)) == expected
