from typing import Annotated

from pydantic import AfterValidator

from .subscription import Frozen


def _title(value: str) -> str:
    if not value.strip():
        message = "title must not be blank"
        raise ValueError(message)
    return value


def _path(value: str) -> str:
    if not value.startswith("/") or value.startswith("//"):
        message = "url must be a path of the front end"
        raise ValueError(message)
    return value


class PushMessage(Frozen):
    """What the service worker shows. `url` is a path, resolved against the worker's own origin."""

    title: Annotated[str, AfterValidator(_title)]
    body: str
    tag: str
    url: Annotated[str, AfterValidator(_path)]
