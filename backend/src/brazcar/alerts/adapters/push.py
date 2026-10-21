"""Push delivery. In this stage the only adapter writes a line and sends nothing."""

import logging

from brazcar.alerts.domain import AccountId, Notice

log = logging.getLogger(__name__)


class LoggingPushSender:
    """`PushSender` that records that a notice would go out: account, tag and url, never the title
    or the body. Nothing is delivered.

    The Web Push adapter enters in the next stage in its place, through the same port.
    """

    async def send(self, owner_id: AccountId, notice: Notice) -> None:
        log.info("alert notice for account %s: tag=%s url=%s", owner_id, notice.tag, notice.url)
