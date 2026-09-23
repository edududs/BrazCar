"""What `importing` does in 7a: keep the raw messages for a while, then forget them."""

from datetime import timedelta

from .ports import Clock, SourceMessages


class PurgeSourceMessages:
    """The retention rule of D-119: a source message lives `retention` after it was received."""

    def __init__(self, messages: SourceMessages, clock: Clock, retention: timedelta) -> None:
        self._messages = messages
        self._clock = clock
        self._retention = retention

    async def __call__(self) -> int:
        return await self._messages.delete_older_than(self._clock.now() - self._retention)
