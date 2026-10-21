"""Push delivery of the alert notices: through the `push` context when push is on, and a log line
when it is off (D-182)."""

import logging

from brazcar.alerts.domain import AccountId, Notice
from brazcar.push.application import PushToAccount
from brazcar.push.domain import PushMessage

log = logging.getLogger(__name__)


class DevicePushSender:
    """`PushSender` over the `push` context: the notice goes to every device of the account as a
    `PushMessage` with the same four fields. An adapter of `alerts` that uses the application of
    another context, as `RidesBoard` does with `rides` (D-182)."""

    def __init__(self, push: PushToAccount) -> None:
        self._push = push

    async def send(self, owner_id: AccountId, notice: Notice) -> None:
        await self._push(
            owner_id,
            PushMessage(title=notice.title, body=notice.body, tag=notice.tag, url=notice.url),
        )


class LoggingPushSender:
    """`PushSender` of a server with push off (no VAPID keys): records that a notice would go out,
    with account, tag and url, never the title or the body (D-182). Nothing is delivered."""

    async def send(self, owner_id: AccountId, notice: Notice) -> None:
        log.info("alert notice for account %s: tag=%s url=%s", owner_id, notice.tag, notice.url)
