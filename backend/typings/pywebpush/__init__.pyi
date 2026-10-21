from collections.abc import Mapping
from typing import Protocol

from py_vapid import Vapid01

class _Response(Protocol):
    status_code: int
    reason: str
    text: str
    headers: Mapping[str, str]

class _Session(Protocol):
    def post(
        self,
        url: str,
        *,
        data: bytes | None,
        headers: dict[str, str],
        timeout: float,
    ) -> _Response: ...

class WebPushException(Exception):  # noqa: N818 - the library's own name
    response: object
    @property
    def status_code(self) -> int | None: ...

def webpush(
    subscription_info: Mapping[str, str | Mapping[str, str]],
    data: str | None = None,
    vapid_private_key: Vapid01 | str | None = None,
    vapid_claims: dict[str, str | int] | None = None,
    content_encoding: str = "aes128gcm",
    curl: bool = False,
    timeout: float | None = None,
    ttl: int = 0,
    verbose: bool = False,
    headers: dict[str, str | int | float] | None = None,
    requests_session: _Session | None = None,
) -> object: ...
